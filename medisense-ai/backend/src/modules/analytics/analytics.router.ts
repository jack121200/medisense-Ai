import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/dashboard', analyticsController.getDashboard);
router.get('/admissions/trend', analyticsController.getAdmissionTrend);
router.get('/ward/occupancy', analyticsController.getWardOccupancy);
router.get('/risk/distribution', analyticsController.getRiskDistribution);
router.get('/eda/distributions', analyticsController.getEDA);
router.get('/stats/summary', analyticsController.getStats);
router.get('/hypothesis/results', analyticsController.getHypothesis);
router.get('/big-data/report', analyticsController.getBigData);

export default router;
