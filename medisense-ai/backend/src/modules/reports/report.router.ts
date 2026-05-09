import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { reportService } from './report.service';
import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/patient/:patientId', asyncHandler(async (req: AuthRequest, res: Response) => {
    await reportService.generatePatientPDF(req.params.patientId, res);
}));

export default router;
