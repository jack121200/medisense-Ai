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
    KAFKA_BROKER: z.string().default('localhost:9092'),
    KAFKA_VITALS_TOPIC: z.string().default('patient-vitals'),
    KAFKA_ALERTS_TOPIC: z.string().default('medical-alerts'),
    ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
    MINIO_ENDPOINT: z.string().default('localhost'),
    MINIO_PORT: z.string().default('9000'),
    MINIO_ACCESS_KEY: z.string().default('minioadmin'),
    MINIO_SECRET_KEY: z.string().default('minioadmin123'),
    MINIO_BUCKET: z.string().default('medisense-files'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    // Vapi — AI Doctor Voice Agent
    VAPI_API_KEY: z.string().min(1),
    VAPI_PUBLIC_KEY: z.string().min(1),
    VAPI_WEBHOOK_SECRET: z.string().optional(), // for webhook signature verification
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
