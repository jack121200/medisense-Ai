import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole, requireOwnership } from '../../middleware/rbac.middleware';
import { uploadLabPdf } from '../../middleware/upload.middleware';
import { labService } from './lab.service';
import { sendSuccess } from '../../utils/apiResponse';
import { prisma } from '../../config/database';

const router = Router();
router.use(authenticate);

const READ_STAFF = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN'] as const;

// GET /pending — for lab tech dashboard (all pending/in-progress tests)
router.get('/pending', requireRole('LAB_TECHNICIAN', 'ADMIN'), async (req, res, next) => {
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

// GET / — all with optional filters, staff worklist
router.get('/', requireRole(...READ_STAFF), async (req, res, next) => {
    try {
        sendSuccess(res, await labService.getAll({
            patientId: req.query.patientId as string,
            status: req.query.status as string,
        }));
    } catch (e) { next(e); }
});

// GET /:id — the owning patient may view their own result
router.get('/:id', requireOwnership('labReport', { allowRoles: [...READ_STAFF] }), async (req, res, next) => {
    try { sendSuccess(res, await labService.getById(req.params.id)); } catch (e) { next(e); }
});

// POST / — doctor orders a lab test
router.post('/', requireRole('DOCTOR', 'ADMIN'), async (req, res, next) => {
    try {
        const data = await labService.createRequest({ ...req.body, orderedByDocId: (req as any).user.id });
        sendSuccess(res, data, 'Lab test request created', 201);
    } catch (e) { next(e); }
});

// PATCH /:id/accept — lab tech accepts
router.patch('/:id/accept', requireRole('LAB_TECHNICIAN', 'ADMIN'), async (req, res, next) => {
    try { sendSuccess(res, await labService.accept(req.params.id), 'Test accepted'); } catch (e) { next(e); }
});

// PATCH /:id/sample-collected
router.patch('/:id/sample-collected', requireRole('LAB_TECHNICIAN', 'ADMIN'), async (req, res, next) => {
    try { sendSuccess(res, await labService.markSampleCollected(req.params.id), 'Sample collected'); } catch (e) { next(e); }
});

// POST /:id/results — upload structured numeric results (optional)
router.post('/:id/results', requireRole('LAB_TECHNICIAN', 'ADMIN'), async (req, res, next) => {
    try {
        const data = await labService.uploadResult(req.params.id, req.body);
        sendSuccess(res, data, 'Results uploaded and AI analysis complete');
    } catch (e) { next(e); }
});

// POST /:id/upload-pdf — lab tech uploads scanned PDF report
router.post('/:id/upload-pdf', requireRole('LAB_TECHNICIAN', 'ADMIN'), uploadLabPdf.single('pdf'), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'PDF file is required' });
        // Only the internal disk filename is stored — never a directly
        // fetchable URL. Downloads always go through the authenticated
        // route below.
        const data = await labService.uploadPdfReport(req.params.id, file.filename, req.body.note);
        sendSuccess(res, data, 'PDF report uploaded successfully');
    } catch (e) { next(e); }
});

// GET /:id/reports/file — authenticated, ownership-checked file stream.
// Replaces the old unauthenticated express.static('/uploads') mount (see 1.3):
// a lab report is no longer fetchable by a guessable filename, only by the
// owning patient or clinical staff, via this route.
router.get('/:id/reports/file', requireOwnership('labReport', { allowRoles: [...READ_STAFF] }), async (req, res, next) => {
    try {
        await labService.streamReportFile(req.params.id, res);
    } catch (e) { next(e); }
});

export { router as labRouter };
