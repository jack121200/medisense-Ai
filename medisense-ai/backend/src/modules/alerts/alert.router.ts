import { Router } from 'express';
import { alertController } from './alert.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', alertController.list);
router.get('/unread/count', alertController.getUnreadCount);
router.patch('/read-all', alertController.markAllRead);
router.patch('/:id/read', alertController.markRead);
router.patch('/:id/resolve', alertController.resolve);

export default router;
