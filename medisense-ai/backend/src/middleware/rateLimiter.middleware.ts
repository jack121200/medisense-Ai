import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse';

export const defaultRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        sendError(res, 'Too many requests, please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
    },
});

export const authRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        sendError(res, 'Too many authentication attempts, please wait 1 minute.', 429, 'AUTH_RATE_LIMIT');
    },
});

export const mlRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        sendError(res, 'ML prediction rate limit reached.', 429, 'ML_RATE_LIMIT');
    },
});
