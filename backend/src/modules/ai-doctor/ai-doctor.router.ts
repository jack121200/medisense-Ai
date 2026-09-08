import { Router } from 'express';
import { aiDoctorController } from './ai-doctor.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { verifyVapiWebhook } from '../../middleware/vapiWebhook.middleware';
import { aiDoctorCallLimiter } from '../../middleware/rateLimiter.middleware';

const router = Router();

/**
 * POST /api/v1/ai-doctor/start-call
 * Patient starts a new AI Doctor voice call.
 * Returns vapiCallId + publicKey to the frontend SDK.
 */
router.post(
    '/start-call',
    authenticate,
    requireRole('PATIENT'),
    aiDoctorCallLimiter,
    aiDoctorController.startCall
);

/**
 * POST /api/v1/ai-doctor/webhook
 * Vapi webhook — receives end-of-call report (transcript + summary).
 * No authenticated user — Vapi server sends this, NOT the patient — but
 * verifyVapiWebhook confirms the request actually came from Vapi via a
 * shared-secret header before any handler code runs.
 */
router.post('/webhook', verifyVapiWebhook, aiDoctorController.handleWebhook);

/**
 * POST /api/v1/ai-doctor/save-call
 * Frontend calls this after the call ends to persist the call record + trigger Groq suggestions.
 */
router.post(
    '/save-call',
    authenticate,
    requireRole('PATIENT'),
    aiDoctorController.saveCall
);

/**
 * GET /api/v1/ai-doctor/calls?page=1&limit=10
 * Get paginated call history for the logged-in patient.
 */
router.get(
    '/calls',
    authenticate,
    requireRole('PATIENT'),
    aiDoctorController.getCalls
);

/**
 * GET /api/v1/ai-doctor/calls/:id
 * Get single call with full transcript (patient-owned only).
 */
router.get(
    '/calls/:id',
    authenticate,
    requireRole('PATIENT'),
    aiDoctorController.getCallById
);

export default router;
