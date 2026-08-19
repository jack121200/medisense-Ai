import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { alertService } from './alert.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';

export const alertController = {
    list: asyncHandler(async (req: AuthRequest, res: Response) => {
        const { alerts, pagination } = await alertService.list(req.query as any);
        sendSuccess(res, alerts, 'Alerts retrieved', 200, pagination);
    }),
    getUnreadCount: asyncHandler(async (_req: AuthRequest, res: Response) => {
        const count = await alertService.getUnreadCount();
        sendSuccess(res, { count });
    }),
    markRead: asyncHandler(async (req: AuthRequest, res: Response) => {
        const alert = await alertService.markRead(req.params.id);
        sendSuccess(res, alert, 'Alert marked as read');
    }),
    resolve: asyncHandler(async (req: AuthRequest, res: Response) => {
        const alert = await alertService.resolve(req.params.id, req.user!.id);
        sendSuccess(res, alert, 'Alert resolved');
    }),
    markAllRead: asyncHandler(async (_req: AuthRequest, res: Response) => {
        await alertService.markAllRead();
        sendSuccess(res, null, 'All alerts marked as read');
    }),
};
