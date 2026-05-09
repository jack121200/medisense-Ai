import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { labService } from './lab.service';
import { sendSuccess } from '../../utils/apiResponse';
import { prisma } from '../../config/database';

const router = Router();
router.use(authenticate);

// GET /pending — for lab tech dashboard (all pending/in-progress tests)
router.get('/pending', authorize('LAB_TECHNICIAN', 'ADMIN'), async (req, res, next) => {
    try { sendSuccess(res, await labService.getPending()); } catch (e) { next(e); }
});

// GET /my — patient sees their own lab test requests and results
router.get('/my', async (req, res, next) => {
    try {
        const user = (req as any).user;
        const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
        if (!patient) return sendSuccess(res, []);
        sendSuccess(res, await labService.getAll({ patientId: patient.id }));
    } catch (e) { next(e); }
});

// GET / — all with optional filters (doctor/admin)
router.get('/', async (req, res, next) => {
    try {
        sendSuccess(res, await labService.getAll({
            patientId: req.query.patientId as string,
            status: req.query.status as string,
        }));
    } catch (e) { next(e); }
});

// GET /:id
router.get('/:id', async (req, res, next) => {
    try { sendSuccess(res, await labService.getById(req.params.id)); } catch (e) { next(e); }
});

// POST / — doctor orders a lab test
router.post('/', authorize('DOCTOR', 'ADMIN'), async (req, res, next) => {
    try {
        const data = await labService.createRequest({ ...req.body, orderedByDocId: (req as any).user.id });
        sendSuccess(res, data, 'Lab test request created', 201);
    } catch (e) { next(e); }
});

// PATCH /:id/accept — lab tech accepts
router.patch('/:id/accept', authorize('LAB_TECHNICIAN', 'ADMIN'), async (req, res, next) => {
    try { sendSuccess(res, await labService.accept(req.params.id), 'Test accepted'); } catch (e) { next(e); }
});

// PATCH /:id/sample-collected
router.patch('/:id/sample-collected', authorize('LAB_TECHNICIAN', 'ADMIN'), async (req, res, next) => {
    try { sendSuccess(res, await labService.markSampleCollected(req.params.id), 'Sample collected'); } catch (e) { next(e); }
});

// POST /:id/results — upload structured numeric results (optional)
router.post('/:id/results', authorize('LAB_TECHNICIAN', 'ADMIN'), async (req, res, next) => {
    try {
        const data = await labService.uploadResult(req.params.id, req.body);
        sendSuccess(res, data, 'Results uploaded and AI analysis complete');
    } catch (e) { next(e); }
});

// POST /:id/upload-pdf — lab tech uploads scanned PDF report
router.post('/:id/upload-pdf', authorize('LAB_TECHNICIAN', 'ADMIN'), async (req, res, next) => {
    try {
        const { fileUrl, note } = req.body;
        if (!fileUrl) return res.status(400).json({ error: 'fileUrl is required' });
        const data = await labService.uploadPdfReport(req.params.id, fileUrl, note);
        sendSuccess(res, data, 'PDF report uploaded successfully');
    } catch (e) { next(e); }
});

export { router as labRouter };
