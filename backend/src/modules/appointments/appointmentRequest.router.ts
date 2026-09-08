import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { appointmentRequestService } from './appointmentRequest.service';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();

// POST /api/v1/appointment-requests — patient creates request
router.post('/', authenticate, requireRole('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await appointmentRequestService.create({
            patientUserId: (req as any).user.id,
            doctorId: req.body.doctorId,
            requestedDate: req.body.requestedDate,
            timeSlot: req.body.timeSlot,
            reason: req.body.reason,
        });
        sendSuccess(res, result, 'Appointment request created', 201);
    } catch (e) { next(e); }
});


// POST /api/v1/appointment-requests/staff-book — receptionist/admin books
// directly on behalf of a patient (walk-in/phone booking), immediately
// confirmed — no separate patient-approval step, since staff initiated it.
router.post('/staff-book', authenticate, requireRole('RECEPTIONIST', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await appointmentRequestService.createByStaff({
            patientId: req.body.patientId,
            doctorId: req.body.doctorId,
            requestedDate: req.body.requestedDate,
            timeSlot: req.body.timeSlot,
            reason: req.body.reason,
        });
        sendSuccess(res, result, 'Appointment booked', 201);
    } catch (e) { next(e); }
});

// GET /api/v1/appointment-requests — receptionist sees all, patient sees their own
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        if (user.role === 'RECEPTIONIST' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
            const result = await appointmentRequestService.listAll(req.query.status as string);
            return sendSuccess(res, result);
        }
        if (user.role === 'PATIENT') {
            const result = await appointmentRequestService.listForPatient(user.id);
            return sendSuccess(res, result);
        }
        if (user.role === 'DOCTOR') {
            const result = await appointmentRequestService.listForDoctor(user.id);
            return sendSuccess(res, result);
        }
        sendSuccess(res, []);
    } catch (e) { next(e); }
});

// PATCH /api/v1/appointment-requests/:id/approve — receptionist approves
router.patch('/:id/approve', authenticate, requireRole('RECEPTIONIST', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await appointmentRequestService.approve(req.params.id);
        sendSuccess(res, result);
    } catch (e) { next(e); }
});

// PATCH /api/v1/appointment-requests/:id/reject — receptionist rejects with counter-offer
router.patch('/:id/reject', authenticate, requireRole('RECEPTIONIST', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { counterDate, counterSlot, note } = req.body;
        const result = await appointmentRequestService.reject(req.params.id, counterDate, counterSlot, note);
        sendSuccess(res, result);
    } catch (e) { next(e); }
});

// PATCH /api/v1/appointment-requests/:id/respond — patient accepts or declines counter-offer
router.patch('/:id/respond', authenticate, requireRole('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await appointmentRequestService.patientRespond(
            req.params.id,
            (req as any).user.id,
            req.body.accept,
        );
        sendSuccess(res, result);
    } catch (e) { next(e); }
});

export default router;
