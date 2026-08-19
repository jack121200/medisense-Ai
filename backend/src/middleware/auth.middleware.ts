import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/apiResponse';
import { prisma } from '../config/database';

export interface AuthRequest extends Request {
    user?: { id: string; email: string; role: string };
}

export const authenticate = async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new AppError('No token provided', 401, 'UNAUTHORIZED');
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
            id: string;
            email: string;
            role: string;
        };

        const user = await prisma.user.findUnique({
            where: { id: decoded.id, isActive: true },
            select: { id: true, email: true, role: true, isActive: true },
        });

        if (!user) {
            throw new AppError('User not found or inactive', 401, 'UNAUTHORIZED');
        }

        req.user = { id: user.id, email: user.email, role: user.role };
        next();
    } catch (error) {
        if (error instanceof AppError) return next(error);
        next(new AppError('Invalid or expired token', 401, 'TOKEN_INVALID'));
    }
};

/** Role guard — use after authenticate */
export const authorize = (...roles: string[]) => (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
): void => {
    if (!req.user || !roles.includes(req.user.role)) {
        return next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
    }
    next();
};
