import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole, requireOwnership } from '../../middleware/rbac.middleware';
import { consultationService } from './consultation.service';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();
router.use(authenticate);

const CLINICAL_STAFF = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'] as const;
const READ_STAFF = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] as const;

// Create consultation (doctor starts session)
router.post('/', requireRole(...CLINICAL_STAFF), async (req, res, next) => {
    try {
        const data = await consultationService.create({ ...req.body, doctorId: req.body.doctorId || (req as any).user.id });
        sendSuccess(res, data, 'Consultation created', 201);
    } catch (e) { next(e); }
});

// Get consultation by ID (full detail) — the owning patient may view their own
router.get('/:id', requireOwnership('consultation', { allowRoles: [...READ_STAFF] }), async (req, res, next) => {
    try { sendSuccess(res, await consultationService.getById(req.params.id)); } catch (e) { next(e); }
});

// Doctor's today list — staff worklist
router.get('/doctor/:doctorId', requireRole(...READ_STAFF), async (req, res, next) => {
    try { sendSuccess(res, await consultationService.getByDoctor(req.params.doctorId, req.query.date as string)); } catch (e) { next(e); }
});

// Patient's consultation history — the owning patient may view their own
router.get('/patient/:patientId', requireOwnership('consultation', { allowRoles: [...READ_STAFF] }), async (req, res, next) => {
    try { sendSuccess(res, await consultationService.getByPatient(req.params.patientId)); } catch (e) { next(e); }
});

// Update (add symptoms, diagnosis, notes, AI result) — clinical staff only.
// Only these fields: the body used to go straight to Prisma, so a caller
// could reassign the consultation's patient or doctor.
router.patch('/:id', requireRole(...CLINICAL_STAFF), async (req, res, next) => {
    try {
        const { symptoms, notes, diagnosis, aiDiseasePred, status } = req.body;
        sendSuccess(res, await consultationService.update(req.params.id, { symptoms, notes, diagnosis, aiDiseasePred, status }));
    } catch (e) { next(e); }
});

// Save prescription — clinical staff only
router.post('/:id/prescription', requireRole(...CLINICAL_STAFF), async (req, res, next) => {
    try {
        const data = await consultationService.savePrescription(req.params.id, req.body);
        sendSuccess(res, data, 'Prescription saved');
    } catch (e) { next(e); }
});

// Close consultation and auto-generate bill — clinical staff only
router.post('/:id/close', requireRole(...CLINICAL_STAFF), async (req, res, next) => {
    try {
        const data = await consultationService.closeAndBill(req.params.id);
        sendSuccess(res, data, 'Consultation closed and bill generated');
    } catch (e) { next(e); }
});

export { router as consultationRouter };
