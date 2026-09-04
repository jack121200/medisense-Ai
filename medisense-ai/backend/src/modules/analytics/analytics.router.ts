import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

// All analytics here are hospital-wide aggregates — never patient-scoped,
// so there's nothing for requireOwnership to check; staff-only is correct.
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'ANALYST'));

router.get('/dashboard', analyticsController.getDashboard);
router.get('/admissions/trend', analyticsController.getAdmissionTrend);
router.get('/ward/occupancy', analyticsController.getWardOccupancy);
router.get('/risk/distribution', analyticsController.getRiskDistribution);
router.get('/eda/distributions', analyticsController.getEDA);
router.get('/stats/summary', analyticsController.getStats);
router.get('/hypothesis/results', analyticsController.getHypothesis);
router.get('/big-data/report', analyticsController.getBigData);

export default router;
