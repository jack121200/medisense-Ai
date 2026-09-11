import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { notificationService } from './notification.service';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();

// Every handler goes through asyncHandler: Express 4 does not catch a
// rejected promise from an async handler, so a database error here used to
// leave the request hanging with no response.

// GET /api/v1/notifications — list current user's notifications
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, await notificationService.listForUser(req.user!.id));
}));

// GET /api/v1/notifications/unread-count
router.get('/unread-count', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, { count: await notificationService.getUnreadCount(req.user!.id) });
}));

// PATCH /api/v1/notifications/:id/read — scoped to the caller's own notifications
router.patch('/:id/read', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
    await notificationService.markRead(req.params.id, req.user!.id);
    sendSuccess(res, { message: 'Marked as read' });
}));

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
    await notificationService.markAllRead(req.user!.id);
    sendSuccess(res, { message: 'All marked as read' });
}));

export default router;
