import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { analyticsService } from './analytics.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';

export const analyticsController = {
    getDashboard: asyncHandler(async (_req: AuthRequest, res: Response) => {
        sendSuccess(res, await analyticsService.getDashboard());
    }),
    getAdmissionTrend: asyncHandler(async (req: AuthRequest, res: Response) => {
        sendSuccess(res, await analyticsService.getAdmissionTrend(req.query.period as string));
    }),
    getWardOccupancy: asyncHandler(async (_req: AuthRequest, res: Response) => {
        sendSuccess(res, await analyticsService.getWardOccupancy());
    }),
    getRiskDistribution: asyncHandler(async (_req: AuthRequest, res: Response) => {
        sendSuccess(res, await analyticsService.getRiskDistributionOverTime());
    }),
    getEDA: asyncHandler(async (_req: AuthRequest, res: Response) => {
        sendSuccess(res, await analyticsService.getEDAData());
    }),
    getStats: asyncHandler(async (_req: AuthRequest, res: Response) => {
        sendSuccess(res, await analyticsService.getStatsSummary());
    }),
    getHypothesis: asyncHandler(async (_req: AuthRequest, res: Response) => {
        sendSuccess(res, await analyticsService.getHypothesisResults());
    }),
    getBigData: asyncHandler(async (_req: AuthRequest, res: Response) => {
        sendSuccess(res, await analyticsService.getBigDataReport());
    }),
};
