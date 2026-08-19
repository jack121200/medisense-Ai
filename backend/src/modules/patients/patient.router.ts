import { Router, Request, Response, NextFunction } from 'express';
import { patientController } from './patient.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole, requireOwnership } from '../../middleware/rbac.middleware';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/apiResponse';
import { appointmentRequestService } from '../appointments/appointmentRequest.service';

const router = Router();

router.use(authenticate);

// Roles that manage patient records (create/edit/delete/list-all).
// RECEPTIONIST can register/list patients but not edit clinical fields;
// LAB_TECHNICIAN/ANALYST only need read access via requireOwnership below.
const STAFF_MANAGE = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] as const;
const STAFF_READ_ANY = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'ANALYST'] as const;

// ─── Patient Self-Service Routes (for Patient Portal) ──────────────────────────
// Mounted at /api/v1/patient/* (singular) — return data for the logged-in patient.

// GET /api/v1/patient/my-profile
router.get('/my-profile', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        const patient = await prisma.patient.findFirst({
            where: { userId, isActive: true },
        });
        sendSuccess(res, patient || null);
    } catch (e) { next(e); }
});

// GET /api/v1/patient/my-appointments
// Reuses the existing appointmentRequestService which correctly enriches with doctor info
router.get('/my-appointments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        const appointments = await appointmentRequestService.listForPatient(userId);
        sendSuccess(res, appointments);
    } catch (e) { next(e); }
});

// GET /api/v1/patient/my-bills
router.get('/my-bills', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        const patient = await prisma.patient.findFirst({ where: { userId, isActive: true } });
        if (!patient) return sendSuccess(res, []);
        const bills = await prisma.invoice.findMany({
            where: { patientId: patient.id },
            orderBy: { createdAt: 'desc' },
            include: { items: true },
        });
        sendSuccess(res, bills);
    } catch (e) { next(e); }
});

// GET /api/v1/patient/my-prescriptions
router.get('/my-prescriptions', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        const patient = await prisma.patient.findFirst({ where: { userId, isActive: true } });
        if (!patient) return sendSuccess(res, []);
        const consultations = await prisma.consultation.findMany({
            where: { patientId: patient.id },
            orderBy: { createdAt: 'desc' },
            include: {
                prescription: { include: { items: true } },
            },
        });
        sendSuccess(res, consultations);
    } catch (e) { next(e); }
});

// ─── Standard Doctor/Admin Patient Mgmt Routes ─────────────────────────────────
// These are mounted at BOTH /api/v1/patients/* and /api/v1/patient/*
// The self-service routes above take priority (defined first).

router.get('/high-risk', requireRole(...STAFF_READ_ANY), patientController.getHighRisk);
router.get('/', requireRole(...STAFF_READ_ANY), patientController.list);
router.post('/', requireRole(...STAFF_MANAGE), patientController.create);
router.get('/:id', requireOwnership('patient', { allowRoles: [...STAFF_READ_ANY] }), patientController.getById);
router.patch('/:id', requireRole(...STAFF_MANAGE), patientController.update);
router.delete('/:id', requireRole(...STAFF_MANAGE), patientController.softDelete);
router.get('/:id/admissions', requireOwnership('patient', { allowRoles: [...STAFF_READ_ANY] }), patientController.getAdmissions);
router.post('/:id/admissions', requireRole(...STAFF_MANAGE), patientController.createAdmission);
router.get('/:id/vitals', requireOwnership('patient', { allowRoles: [...STAFF_READ_ANY] }), patientController.getVitals);
router.get('/:id/timeline', requireOwnership('patient', { allowRoles: [...STAFF_READ_ANY] }), patientController.getTimeline);

export default router;
