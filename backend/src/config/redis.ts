import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis(env.REDIS_URL, {
            retryStrategy: (times) => {
                if (times > 10) return null;
                return Math.min(times * 100, 3000);
            },
            maxRetriesPerRequest: 3,
        });
        redisClient.on('connect', () => logger.info('✅ Redis connected'));
        redisClient.on('error', (err) => logger.error('❌ Redis error:', err));
    }
    return redisClient;
}

export const redis = getRedisClient();

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
}

export async function cacheDel(key: string): Promise<void> {
    await redis.del(key);
}
