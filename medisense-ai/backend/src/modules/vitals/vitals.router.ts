import { Router } from 'express';
import { vitalsController } from './vitals.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole, requireOwnership } from '../../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

const STAFF_CLINICAL = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'] as const;
const STAFF_READ = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'ANALYST'] as const;

// Recording a reading is a staff/device action, not a patient self-report.
router.post('/', requireRole(...STAFF_CLINICAL), vitalsController.record);
router.get('/patient/:patientId', requireOwnership('vitals', { allowRoles: [...STAFF_READ] }), vitalsController.getForPatient);
router.get('/patient/:patientId/latest', requireOwnership('vitals', { allowRoles: [...STAFF_READ] }), vitalsController.getLatest);
// Aggregate/global alert views are staff-only.
router.get('/alerts', requireRole(...STAFF_READ), vitalsController.getAlerts);
router.patch('/alerts/:id/resolve', requireRole(...STAFF_CLINICAL), vitalsController.resolveAlert);

export default router;
