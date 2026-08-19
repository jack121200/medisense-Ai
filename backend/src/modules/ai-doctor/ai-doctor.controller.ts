import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { aiDoctorService } from './ai-doctor.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { logger } from '../../config/logger';

export const aiDoctorController = {

    /**
     * POST /api/v1/ai-doctor/start-call
     * Patient calls this to get Vapi call config. Returns publicKey + vapiCallId.
     */
    startCall: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user!.id;
        const preCallData = req.body as {
            reason?: string;
            reportText?: string;
            additionalNotes?: string;
        };
        const result = await aiDoctorService.startCall(userId, preCallData);
        sendSuccess(res, result, 'AI Doctor call initiated');
    }),

    /**
     * GET /api/v1/ai-doctor/patient-context
     * Vapi tool call endpoint — fetches live patient data during a call.
     * Auth is via the Bearer token passed in the tool call headers.
     */
    getPatientContext: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user!.id;
        const context = await aiDoctorService.getPatientContext(userId);
        res.json(context); // Vapi expects raw JSON (not our sendSuccess wrapper)
    }),

    /**
     * POST /api/v1/ai-doctor/webhook
     * Vapi webhook — receives end-of-call report with transcript and summary.
     * No auth middleware here — Vapi sends this, not the user.
     */
    handleWebhook: asyncHandler(async (req: AuthRequest, res: Response) => {
        logger.info('[AI Doctor Webhook] Received:', JSON.stringify(req.body).slice(0, 200));
        const result = await aiDoctorService.handleWebhook(req.body);
        res.json(result);
    }),

    /**
     * POST /api/v1/ai-doctor/calls/save
     * Frontend calls this after call ends to persist the call record.
     */
    saveCall: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user!.id;
        const result = await aiDoctorService.saveCall(userId, req.body);
        sendSuccess(res, result, 'Call saved successfully');
    }),

    /**
     * GET /api/v1/ai-doctor/calls?page=1&limit=10
     * Returns paginated list of completed AI doctor calls for logged-in patient.
     */
    getCalls: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user!.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const { calls, pagination } = await aiDoctorService.getCalls(userId, page, limit);
        sendSuccess(res, calls, 'Call history retrieved', 200, pagination);
    }),

    /**
     * GET /api/v1/ai-doctor/calls/:id
     * Returns a single call with full transcript for logged-in patient.
     */
    getCallById: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user!.id;
        const call = await aiDoctorService.getCallById(req.params.id, userId);
        sendSuccess(res, call, 'Call details retrieved');
    }),
};
