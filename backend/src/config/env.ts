import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('5000'),
    FRONTEND_URL: z.string().default('http://localhost:3000'),
    DATABASE_URL: z.string(),
    REDIS_URL: z.string(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),
    ML_SERVICE_URL: z.string().default('http://localhost:8000'),
    ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
    MINIO_ENDPOINT: z.string().default('localhost'),
    MINIO_PORT: z.string().default('9000'),
    // No more weak hardcoded defaults (was 'minioadmin'/'minioadmin123') —
    // every environment must supply its own values.
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_SECRET_KEY: z.string().min(1),
    MINIO_BUCKET: z.string().default('medisense-files'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    // Vapi — AI Doctor Voice Agent
    VAPI_API_KEY: z.string().min(1),
    VAPI_PUBLIC_KEY: z.string().min(1),
    // Required — used to verify the /ai-doctor/webhook route actually came
    // from Vapi (shared-secret header check, see ai-doctor webhook middleware).
    VAPI_WEBHOOK_SECRET: z.string().min(1),
    // Shared secret the ML service checks on every internal request from
    // this backend, so ml-service can stop trusting "reachable == allowed"
    // now that it's no longer exposed on a host port (Phase 1.8).
    ML_SERVICE_INTERNAL_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
