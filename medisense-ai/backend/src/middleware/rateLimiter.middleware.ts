import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse';

export const defaultRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // High limit for local/dev usage
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        sendError(res, 'Too many requests, please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
    },
});

// General auth endpoints (register/refresh/logout) — not login, which has
// its own much stricter limiter below since it's the brute-force target.
export const authRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        sendError(res, 'Too many requests, please wait 1 minute.', 429, 'AUTH_RATE_LIMIT');
    },
});

/**
 * Login-specific limiter — 200/min was far too permissive to meaningfully
 * slow a password-guessing attack (up to ~288k attempts/day from one IP).
 * Keyed by IP + the attempted email, so an attacker spraying many emails
 * from one IP is still capped per-target, and this is layered underneath
 * the Redis-backed per-account lockout in auth.service.ts for defense in
 * depth against distributed IPs.
 */
export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${req.ip}:${(req.body?.email || '').toLowerCase()}`,
    handler: (_req, res) => {
        sendError(res, 'Too many login attempts. Please wait 15 minutes and try again.', 429, 'LOGIN_RATE_LIMIT');
    },
});

// Public, unauthenticated patient self-registration needs its own cap —
// previously had none at all.
export const registrationRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        sendError(res, 'Too many registration attempts from this network. Please try again later.', 429, 'REGISTRATION_RATE_LIMIT');
    },
});

// AI Doctor calls are real billable usage (Vapi + Groq + Deepgram + Azure
// per call) — cap per authenticated user, not just per IP.
export const aiDoctorCallLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => req.user?.id || req.ip,
    handler: (_req, res) => {
        sendError(res, 'AI Doctor call limit reached for this hour. Please try again later.', 429, 'AI_DOCTOR_RATE_LIMIT');
    },
});

export const mlRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000, // High limit for ML predictions & real-time analytics
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        sendError(res, 'ML prediction rate limit reached.', 429, 'ML_RATE_LIMIT');
    },
});
