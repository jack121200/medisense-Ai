import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { AppError } from '../utils/apiResponse';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'DOCTOR' | 'NURSE' | 'ANALYST';

export const requireRole = (...roles: Role[]) => {
    return (req: AuthRequest, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new AppError('Not authenticated', 401, 'UNAUTHORIZED'));
        }
        if (!roles.includes(req.user.role as Role)) {
            return next(
                new AppError(
                    `Access denied. Required roles: ${roles.join(', ')}`,
                    403,
                    'FORBIDDEN'
                )
            );
        }
        next();
    };
};

export const requireAdmin = requireRole('ADMIN', 'SUPER_ADMIN');
export const requireDoctor = requireRole('DOCTOR', 'ADMIN', 'SUPER_ADMIN');
export const requireNurse = requireRole('NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN');
