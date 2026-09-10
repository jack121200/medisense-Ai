import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireOwnership } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { reportService } from './report.service';
import { generateAiDoctorCallPDF } from './aiDoctorReport';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// A patient may generate their own report; staff may generate any patient's.
router.post('/patient/:patientId', requireOwnership('patient'), asyncHandler(async (req: AuthRequest, res: Response) => {
    await reportService.generatePatientPDF(req.params.patientId, res);
}));

// Consultation PDF for one AI Doctor call. requireOwnership('aiDoctorCall')
// resolves the call to its owning patient, so a patient can download their
// own consultation and staff can download any — the same rule the rest of
// the patient-scoped routes use.
router.get('/ai-doctor-call/:id', requireOwnership('aiDoctorCall'), asyncHandler(async (req: AuthRequest, res: Response) => {
    await generateAiDoctorCallPDF(req.params.id, res);
}));

export default router;
