import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireOwnership } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { reportService } from './report.service';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// A patient may generate their own report; staff may generate any patient's.
router.post('/patient/:patientId', requireOwnership('patient'), asyncHandler(async (req: AuthRequest, res: Response) => {
    await reportService.generatePatientPDF(req.params.patientId, res);
}));

export default router;
