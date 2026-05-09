import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { AppError, sendError } from '../utils/apiResponse';

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    if (err instanceof AppError) {
        logger.warn(`AppError [${err.statusCode}] ${err.message} — ${req.method} ${req.path}`);
        sendError(res, err.message, err.statusCode, err.errorCode);
        return;
    }

    // Prisma errors
    const prismaError = err as { code?: string; meta?: { target?: string[] } };
    if (prismaError.code === 'P2002') {
        sendError(res, `Duplicate value for: ${prismaError.meta?.target?.join(', ')}`, 409, 'DUPLICATE');
        return;
    }
    if (prismaError.code === 'P2025') {
        sendError(res, 'Record not found', 404, 'NOT_FOUND');
        return;
    }

    logger.error('Unhandled error:', err);
    sendError(res, 'Internal server error', 500, 'INTERNAL_ERROR');
};
