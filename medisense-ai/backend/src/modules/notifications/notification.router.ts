import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { notificationService } from './notification.service';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();

// GET /api/v1/notifications — list current user's notifications
router.get('/', authenticate, async (req: Request, res: Response) => {
    const notifications = await notificationService.listForUser((req as any).user.id);
    sendSuccess(res, notifications);
});

// GET /api/v1/notifications/unread-count
router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
    const count = await notificationService.getUnreadCount((req as any).user.id);
    sendSuccess(res, { count });
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', authenticate, async (req: Request, res: Response) => {
    await notificationService.markRead(req.params.id, (req as any).user.id);
    sendSuccess(res, { message: 'Marked as read' });
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', authenticate, async (req: Request, res: Response) => {
    await notificationService.markAllRead((req as any).user.id);
    sendSuccess(res, { message: 'All marked as read' });
});

export default router;
