import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from './auth.middleware';
import { AppError } from '../utils/apiResponse';
import { ResourceType, resourceResolvers, resolveOwnPatientId } from './resourceResolvers';

/**
 * Single source of truth for roles — sourced from the Prisma-generated
 * UserRole enum so this can never silently drift out of sync with
 * schema.prisma the way the old role.middleware.ts did (it was missing
 * RECEPTIONIST/LAB_TECHNICIAN/PATIENT).
 */
export type Role = UserRole;

const STAFF_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'ANALYST', 'RECEPTIONIST', 'LAB_TECHNICIAN'];

/**
 * Role-only guard — use for endpoints where any member of the listed
 * roles may proceed regardless of which specific patient/record is
 * involved (e.g. staff-only aggregate views, admin actions).
 * Must run after `authenticate`.
 */
export const requireRole = (...roles: Role[]) => {
    return (req: AuthRequest, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new AppError('Not authenticated', 401, 'UNAUTHORIZED'));
        }
        if (!roles.includes(req.user.role as Role)) {
            return next(new AppError(`Access denied. Required roles: ${roles.join(', ')}`, 403, 'FORBIDDEN'));
        }
        next();
    };
};

export const requireAdmin = requireRole('ADMIN', 'SUPER_ADMIN');
export const requireDoctor = requireRole('DOCTOR', 'ADMIN', 'SUPER_ADMIN');

interface OwnershipOptions {
    /**
     * Roles that may access ANY matching resource, not just their own —
     * defaults to all non-patient staff roles. Narrow this per-route
     * where a resource shouldn't be visible to every staff role (e.g.
     * billing shouldn't be opened to LAB_TECHNICIAN).
     */
    allowRoles?: Role[];
}

/**
 * Ownership guard — use for any endpoint that reads or writes a single
 * patient-scoped resource. Staff in `allowRoles` pass through unconditionally;
 * a PATIENT-role caller is only let through if the resource resolves to
 * their own linked Patient record. Everyone else gets 403; a resource that
 * doesn't exist returns 404 (not 403) so we don't leak existence of other
 * patients' records. Must run after `authenticate`.
 */
export const requireOwnership = (resourceType: ResourceType, opts: OwnershipOptions = {}) => {
    const allowRoles = opts.allowRoles ?? STAFF_ROLES;

    return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                return next(new AppError('Not authenticated', 401, 'UNAUTHORIZED'));
            }

            const role = req.user.role as Role;

            if (allowRoles.includes(role)) {
                return next();
            }

            if (role !== 'PATIENT') {
                return next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
            }

            const [ownPatientId, resourceOwnerPatientId] = await Promise.all([
                resolveOwnPatientId(req.user.id),
                resourceResolvers[resourceType](req),
            ]);

            if (!ownPatientId) {
                return next(new AppError('Patient profile not found for this user', 404, 'PATIENT_NOT_FOUND'));
            }

            if (!resourceOwnerPatientId) {
                return next(new AppError('Resource not found', 404, 'NOT_FOUND'));
            }

            if (resourceOwnerPatientId !== ownPatientId) {
                return next(new AppError('You do not have permission to access this resource', 403, 'FORBIDDEN'));
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};
