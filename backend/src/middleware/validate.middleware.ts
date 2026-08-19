import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/apiResponse';

export const validate = (schema: ZodSchema) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        if (!result.success) {
            const errors = result.error.flatten();
            return next(
                new AppError(
                    `Validation failed: ${JSON.stringify(errors.fieldErrors)}`,
                    400,
                    'VALIDATION_ERROR'
                )
            );
        }
        next();
    };
};
