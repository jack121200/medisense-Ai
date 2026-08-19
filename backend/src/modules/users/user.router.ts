import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../config/database';
import { AppError, sendSuccess, sendCreated } from '../../utils/apiResponse';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../../middleware/auth.middleware';
import { Response } from 'express';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', asyncHandler(async (_req: AuthRequest, res: Response) => {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, firstName: true, lastName: true, role: true, department: true, isActive: true, lastLoginAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, users);
}));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password, firstName, lastName, role, department } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');

    // No more hardcoded fallback password — either the admin supplies one,
    // or we generate a strong random one-time password and return it in
    // the response (never logged, never stored anywhere but the hash).
    const generatedPassword = password ? null : crypto.randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(password || generatedPassword!, 12);

    const user = await prisma.user.create({
        data: { email, passwordHash, firstName, lastName, role: role || 'DOCTOR', department },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    sendCreated(res, generatedPassword ? { ...user, generatedPassword } : user);
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.update({
        where: { id: req.params.id },
        data: req.body,
        select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    sendSuccess(res, user, 'User updated');
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
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
