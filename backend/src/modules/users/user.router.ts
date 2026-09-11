import { Router } from 'express';
import crypto from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../config/database';
import { AppError, sendSuccess, sendCreated } from '../../utils/apiResponse';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../../middleware/auth.middleware';
import { Response } from 'express';
import { writeAuditLog } from '../../lib/auditLog';

const router = Router();
router.use(authenticate, requireAdmin);

const USER_SELECT = {
    id: true, email: true, firstName: true, lastName: true, role: true,
    department: true, isActive: true, lastLoginAt: true, createdAt: true,
} as const;

// Staff roles this route may assign. PATIENT accounts come from patient
// self-registration, which also creates the linked Patient record — one made
// here would be a patient login with no chart behind it.
const ASSIGNABLE_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'ANALYST', 'RECEPTIONIST', 'LAB_TECHNICIAN'];
// Only a super admin may create, promote or modify administrators; otherwise
// any admin could mint a super admin and escalate past their own access.
const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN'];

function assertCanAssign(actorRole: string, role: unknown): UserRole {
    if (typeof role !== 'string' || !ASSIGNABLE_ROLES.includes(role as UserRole)) {
        throw new AppError(`Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`, 400, 'INVALID_ROLE');
    }
    if (ADMIN_ROLES.includes(role as UserRole) && actorRole !== 'SUPER_ADMIN') {
        throw new AppError('Only a super admin can assign administrator roles', 403, 'FORBIDDEN');
    }
    return role as UserRole;
}

/** The account being modified, after the checks every write shares. */
async function loadModifiableUser(req: AuthRequest) {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
    if (!target) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (ADMIN_ROLES.includes(target.role) && req.user!.role !== 'SUPER_ADMIN') {
        throw new AppError('Only a super admin can modify an administrator account', 403, 'FORBIDDEN');
    }
    return target;
}

router.get('/', asyncHandler(async (_req: AuthRequest, res: Response) => {
    const users = await prisma.user.findMany({ select: USER_SELECT, orderBy: { createdAt: 'desc' } });
    sendSuccess(res, users);
}));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password, firstName, lastName, department } = req.body;
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
        throw new AppError('A valid email is required', 400, 'VALIDATION_ERROR');
    }
    if (!firstName || !lastName) throw new AppError('First and last name are required', 400, 'VALIDATION_ERROR');
    if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
        throw new AppError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }
    const role = assertCanAssign(req.user!.role, req.body.role ?? 'DOCTOR');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');

    // No shared default password: either the admin supplies one, or a strong
    // random one-time password is generated and returned in this response
    // only — never logged, never stored anywhere but the hash.
    const generatedPassword = password ? null : crypto.randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(password || generatedPassword!, 12);

    const user = await prisma.user.create({
        data: { email, passwordHash, firstName, lastName, role, department: department || null },
        select: USER_SELECT,
    });
    await writeAuditLog({ userId: req.user!.id, action: 'USER_CREATE', resource: 'User', resourceId: user.id, details: { role: user.role }, req });
    sendCreated(res, generatedPassword ? { ...user, generatedPassword } : user);
}));

// Only these fields are editable. The body used to go straight to Prisma,
// which let a caller write any column — passwordHash included.
router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { firstName, lastName, department, isActive } = req.body;
    const data: Prisma.UserUpdateInput = {};
    if (firstName !== undefined) data.firstName = String(firstName);
    if (lastName !== undefined) data.lastName = String(lastName);
    if (department !== undefined) data.department = department ? String(department) : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (req.body.role !== undefined) data.role = assertCanAssign(req.user!.role, req.body.role);

    if (req.params.id === req.user!.id && (data.isActive === false || data.role !== undefined)) {
        throw new AppError('You cannot deactivate your own account or change your own role', 400, 'SELF_MODIFICATION');
    }
    const target = await loadModifiableUser(req);
    if (target.role === 'PATIENT' && data.role !== undefined) {
        throw new AppError('A patient account cannot be converted to a staff account', 400, 'INVALID_ROLE');
    }

    const user = await prisma.user.update({ where: { id: target.id }, data, select: USER_SELECT });
    await writeAuditLog({ userId: req.user!.id, action: 'USER_UPDATE', resource: 'User', resourceId: user.id, details: data as Record<string, unknown>, req });
    sendSuccess(res, user, 'User updated');
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.params.id === req.user!.id) {
        throw new AppError('You cannot deactivate your own account', 400, 'SELF_MODIFICATION');
    }
    const target = await loadModifiableUser(req);
    await prisma.user.update({ where: { id: target.id }, data: { isActive: false } });
    await writeAuditLog({ userId: req.user!.id, action: 'USER_DEACTIVATE', resource: 'User', resourceId: target.id, req });
    sendSuccess(res, null, 'User deactivated');
}));

router.get('/:id/audit-logs', asyncHandler(async (req: AuthRequest, res: Response) => {
    const logs = await prisma.auditLog.findMany({
        where: { userId: req.params.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    sendSuccess(res, logs);
}));

export default router;
