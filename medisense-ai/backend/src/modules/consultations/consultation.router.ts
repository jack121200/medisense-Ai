import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { consultationService } from './consultation.service';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();
router.use(authenticate);

// Create consultation (doctor starts session)
router.post('/', async (req, res, next) => {
    try {
        const data = await consultationService.create({ ...req.body, doctorId: req.body.doctorId || (req as any).user.id });
        sendSuccess(res, data, 'Consultation created', 201);
    } catch (e) { next(e); }
});

// Get consultation by ID (full detail)
router.get('/:id', async (req, res, next) => {
    try { sendSuccess(res, await consultationService.getById(req.params.id)); } catch (e) { next(e); }
});

// Doctor's today list
router.get('/doctor/:doctorId', async (req, res, next) => {
    try { sendSuccess(res, await consultationService.getByDoctor(req.params.doctorId, req.query.date as string)); } catch (e) { next(e); }
});

// Patient's consultation history
router.get('/patient/:patientId', async (req, res, next) => {
    try { sendSuccess(res, await consultationService.getByPatient(req.params.patientId)); } catch (e) { next(e); }
});

// Update (add symptoms, diagnosis, notes, AI result)
router.patch('/:id', async (req, res, next) => {
    try { sendSuccess(res, await consultationService.update(req.params.id, req.body)); } catch (e) { next(e); }
});

// Save prescription
router.post('/:id/prescription', async (req, res, next) => {
    try {
        const data = await consultationService.savePrescription(req.params.id, req.body);
        sendSuccess(res, data, 'Prescription saved');
    } catch (e) { next(e); }
});

// Close consultation and auto-generate bill
router.post('/:id/close', async (req, res, next) => {
    try {
        const data = await consultationService.closeAndBill(req.params.id, req.body.patientId);
        sendSuccess(res, data, 'Consultation closed and bill generated');
    } catch (e) { next(e); }
});

export { router as consultationRouter };
