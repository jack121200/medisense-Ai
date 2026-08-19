import { Response } from 'express';

export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public errorCode: string = 'INTERNAL_ERROR'
    ) {
        super(message);
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    errorCode?: string;
}

export function sendSuccess<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode = 200,
    pagination?: ApiResponse['pagination']
): void {
    const response: ApiResponse<T> = { success: true, message, data };
    if (pagination) response.pagination = pagination;
    res.status(statusCode).json(response);
}

export function sendError(
    res: Response,
    message: string,
    statusCode = 500,
    errorCode = 'INTERNAL_ERROR'
): void {
    const response: ApiResponse = { success: false, message, errorCode };
    res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): void {
    sendSuccess(res, data, message, 201);
}
