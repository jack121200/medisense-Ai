import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env';
import { connectDatabase } from './config/database';
import { initSocketIO } from './config/socket';
import { swaggerSpec } from './config/swagger';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler.middleware';
import { defaultRateLimiter } from './middleware/rateLimiter.middleware';

// Routes
import authRouter from './modules/auth/auth.router';
import patientRouter from './modules/patients/patient.router';
import vitalsRouter from './modules/vitals/vitals.router';
import mlRouter from './modules/ml/ml.router';
import analyticsRouter from './modules/analytics/analytics.router';
import alertRouter from './modules/alerts/alert.router';
import reportRouter from './modules/reports/report.router';
import userRouter from './modules/users/user.router';
import { consultationRouter } from './modules/consultations/consultation.router';
import { labRouter } from './modules/lab/lab.router';
import { billingRouter } from './modules/billing/billing.router';
// NEW routes
import notificationRouter from './modules/notifications/notification.router';
import appointmentRequestRouter from './modules/appointments/appointmentRequest.router';
import doctorsRouter from './modules/users/doctors.router';
import aiDoctorRouter from './modules/ai-doctor/ai-doctor.router';


// ─── Real-time vitals simulator ──────────────────────
import { startVitalsSimulator } from './jobs/vitalsSimulator';

const app = express();
const server = http.createServer(app);

// ─── Socket.IO ─────────────────────────────────────
initSocketIO(server);

// ─── Core Middleware ────────────────────────────────
// CSP was previously disabled outright. Swagger UI (mounted below at
// /api/docs) needs inline script/style to render, so those are scoped to
// that concern rather than left open by disabling CSP for the whole app.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
        },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
}));

// Dev-only origins are only allowed outside production — the original list
// allowed them unconditionally, including in a deployed environment.
const ALLOWED_ORIGINS = [
    env.FRONTEND_URL,
    ...(env.NODE_ENV !== 'production' ? [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:5173',
    ] : []),
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(defaultRateLimiter);

// ─── Swagger UI ─────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'MediSense AI API',
    customCss: '.swagger-ui .topbar { background: #0A0E1A; }',
}));

// Lab report PDFs are intentionally NOT served as static files — a static
// mount here would make them fetchable by anyone who learns/guesses a
// filename, unauthenticated. They're served exclusively through the
// ownership-checked GET /api/v1/lab/:id/reports/file route instead.

// ─── Health check ───────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'medisense-backend', timestamp: new Date() });
});

// ─── API Routes ────────────────────────────────────
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/patients', patientRouter);
app.use('/api/v1/patient', patientRouter);  // alias: patient portal self-service routes
app.use('/api/v1/vitals', vitalsRouter);
app.use('/api/v1/ml', mlRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/alerts', alertRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/consultations', consultationRouter);
app.use('/api/v1/lab', labRouter);
app.use('/api/v1/billing', billingRouter);
// New routes
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/appointment-requests', appointmentRequestRouter);
app.use('/api/v1/doctors', doctorsRouter);
app.use('/api/v1/ai-doctor', aiDoctorRouter);


// ─── 404 handler ────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found', errorCode: 'NOT_FOUND' });
});

// ─── Global error handler ────────────────────────────
app.use(errorHandler);

// ─── Start server ────────────────────────────────────
async function bootstrap() {
    try {
        await connectDatabase();

        server.listen(Number(env.PORT), () => {
            logger.info(`🚀 MediSense AI Backend running on http://localhost:${env.PORT}`);
            logger.info(`📚 Swagger docs: http://localhost:${env.PORT}/api/docs`);
        });

        // Start real-time vitals simulator
        if (env.NODE_ENV !== 'test') {
            await startVitalsSimulator();
        }
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

bootstrap();

export { app, server };
