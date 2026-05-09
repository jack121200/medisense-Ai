import { Router } from 'express';
import { vitalsController } from './vitals.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/', vitalsController.record);
router.get('/patient/:patientId', vitalsController.getForPatient);
router.get('/patient/:patientId/latest', vitalsController.getLatest);
router.get('/alerts', vitalsController.getAlerts);
router.patch('/alerts/:id/resolve', vitalsController.resolveAlert);

export default router;
