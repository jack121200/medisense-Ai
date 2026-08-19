import { Router } from 'express';
import { alertController } from './alert.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

// Clinical alerts are a staff-facing worklist, not patient-visible data.
const STAFF = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'ANALYST'] as const;

router.use(requireRole(...STAFF));

router.get('/', alertController.list);
router.get('/unread/count', alertController.getUnreadCount);
router.patch('/read-all', alertController.markAllRead);
router.patch('/:id/read', alertController.markRead);
router.patch('/:id/resolve', alertController.resolve);

export default router;
