import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { vitalsService } from './vitals.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../../utils/apiResponse';

export const vitalsController = {
    record: asyncHandler(async (req: AuthRequest, res: Response) => {
        const reading = await vitalsService.recordVitals(req.body);
        sendCreated(res, reading, 'Vitals recorded');
    }),

    getForPatient: asyncHandler(async (req: AuthRequest, res: Response) => {
        const vitals = await vitalsService.getForPatient(req.params.patientId, req.query as any);
        sendSuccess(res, vitals);
    }),

    getLatest: asyncHandler(async (req: AuthRequest, res: Response) => {
        const reading = await vitalsService.getLatest(req.params.patientId);
        sendSuccess(res, reading);
    }),

    getAlerts: asyncHandler(async (_req: AuthRequest, res: Response) => {
        const alerts = await vitalsService.getActiveAlerts();
        sendSuccess(res, alerts);
    }),

    resolveAlert: asyncHandler(async (req: AuthRequest, res: Response) => {
        const alert = await vitalsService.resolveAlert(req.params.id, req.user!.id);
        sendSuccess(res, alert, 'Alert resolved');
    }),
};
