import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from '../utils/apiResponse';

/**
 * Verifies that a POST to /ai-doctor/webhook actually came from Vapi.
 *
 * Vapi's mechanism: the "Server URL Secret" configured on your Vapi
 * assistant/account is sent back on every webhook call in the
 * `x-vapi-secret` header, and you compare it directly against the value
 * you configured (VAPI_WEBHOOK_SECRET here) — it is a shared-secret check,
 * not an HMAC signature over the body. Before deploying, re-confirm this
 * against Vapi's current webhook docs (dashboard → your assistant →
 * Advanced → Server URL Secret) in case the header name/mechanism changes.
 */
export function verifyVapiWebhook(req: Request, _res: Response, next: NextFunction): void {
    const provided = req.header('x-vapi-secret') ?? '';
    const expected = env.VAPI_WEBHOOK_SECRET;

    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);

    const valid =
        providedBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(providedBuf, expectedBuf);

    if (!valid) {
        return next(new AppError('Invalid webhook signature', 401, 'UNAUTHORIZED'));
    }

    next();
}
