import { Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { sendError } from '../utils/apiResponse';
import { logger } from '../config/logger';
import { AuthRequest } from './auth.middleware';

/**
 * The per-user limiter on /ai-doctor/start-call (aiDoctorCallLimiter)
 * stops one account from running up a bill, but nothing previously
 * stopped total spend across ALL users — every AI Doctor call is real,
 * billable usage across Vapi + Groq + Deepgram + whichever TTS provider
 * is configured. This is a blunt, capstone-appropriate global daily cap:
 * once the whole app has started N calls today, every new call is
 * rejected until the counter resets at midnight UTC, regardless of who's
 * asking. Tune AI_DOCTOR_DAILY_CALL_CAP for your actual budget.
 */
const DEFAULT_DAILY_CAP = 50;

function todayKey(): string {
    const d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    return `ai-doctor-calls:global:${d}`;
}

export async function globalAiDoctorCostCap(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const cap = Number(process.env.AI_DOCTOR_DAILY_CALL_CAP) || DEFAULT_DAILY_CAP;
    const key = todayKey();

    try {
        const count = await redis.incr(key);
        if (count === 1) {
            // First call of the day for this key — expire it a little after
            // midnight so a slow clock skew can't leave a stale counter.
            await redis.expire(key, 26 * 60 * 60);
        }

        if (count > cap) {
            logger.warn(`AI Doctor global daily call cap reached (${cap}) — rejecting new call`);
            sendError(res, 'AI Doctor has reached its daily call limit for today. Please try again tomorrow.', 503, 'GLOBAL_CALL_CAP_REACHED');
            return;
        }

        next();
    } catch (err) {
        // If Redis itself is down, fail OPEN rather than blocking every AI
        // Doctor call in the app — a cost cap that also becomes an outage
        // trigger is worse than the risk it's guarding against.
        logger.error('globalAiDoctorCostCap: Redis error, failing open', err);
        next();
    }
}

/** For the /api/v1/ai-doctor/usage-today endpoint — lets the frontend show remaining quota. */
export async function getTodayAiDoctorCallCount(): Promise<{ count: number; cap: number }> {
    const cap = Number(process.env.AI_DOCTOR_DAILY_CALL_CAP) || DEFAULT_DAILY_CAP;
    const raw = await redis.get(todayKey());
    return { count: raw ? parseInt(raw, 10) : 0, cap };
}
