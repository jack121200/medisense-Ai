import { prisma } from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import {
    emitAppointmentRequestCreated,
    emitAppointmentApproved,
    emitAppointmentCounterOffer,
    emitPatientResponded,
} from '../../config/socket';
import { notificationService } from '../notifications/notification.service';

const SLOT_LABELS: Record<string, string> = {
    MORNING: '9:00 AM – 12:00 PM',
    NOON: '12:00 PM – 3:00 PM',
    NIGHT: '6:00 PM – 9:00 PM',
    LATE_NIGHT: '9:00 PM – 12:00 AM',
};

export const appointmentRequestService = {
    /** Patient creates an appointment request */
    async create(data: {
        patientUserId: string;   // User.id of the logged-in patient
        doctorId: string;        // User.id of the chosen doctor
        requestedDate: string;
        timeSlot: string;
        reason?: string;
    }) {
        // Find the Patient record linked to this user
        const patient = await prisma.patient.findUnique({
            where: { userId: data.patientUserId },
        });
        if (!patient) throw new AppError('Patient profile not found. Please complete your profile first.', 404, 'NO_PROFILE');

        const doctor = await prisma.user.findUnique({
            where: { id: data.doctorId, role: 'DOCTOR' },
            select: { id: true, firstName: true, lastName: true, specialization: true },
        });
        if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');

        const request = await prisma.appointmentRequest.create({
            data: {
                patientId: patient.id,
                doctorId: data.doctorId,
                requestedDate: new Date(data.requestedDate),
                timeSlot: data.timeSlot as any,
                reason: data.reason,
                status: 'PENDING',
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
            },
        });

        // Real-time: notify all receptionists
        emitAppointmentRequestCreated({
            id: request.id,
            patient: request.patient,
            doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
            specialization: doctor.specialization,
            requestedDate: data.requestedDate,
            timeSlot: data.timeSlot,
            slotLabel: SLOT_LABELS[data.timeSlot] || data.timeSlot,
            reason: data.reason,
        });

        return request;
    },

    /** List all appointment requests (for receptionist) */
    async listAll(status?: string) {
        return prisma.appointmentRequest.findMany({
            where: status ? { status: status as any } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true, userId: true } },
            },
        });
    },

    /** List requests for a specific patient */
    async listForPatient(patientUserId: string) {
        const patient = await prisma.patient.findUnique({ where: { userId: patientUserId } });
        if (!patient) return [];

        const requests = await prisma.appointmentRequest.findMany({
            where: { patientId: patient.id },
            orderBy: { createdAt: 'desc' },
        });

        // Enrich with doctor info
        const doctorIds = [...new Set(requests.map(r => r.doctorId))];
        const doctors = await prisma.user.findMany({
            where: { id: { in: doctorIds } },
            select: { id: true, firstName: true, lastName: true, specialization: true, consultationFee: true },
        });
        const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d]));

        return requests.map(r => ({
            ...r,
            doctor: doctorMap[r.doctorId] || null,
            slotLabel: SLOT_LABELS[r.timeSlot] || r.timeSlot,
            counterSlotLabel: r.counterSlot ? SLOT_LABELS[r.counterSlot] || r.counterSlot : null,
        }));
    },

    /** List approved requests for a specific doctor (their queue) */
    async listForDoctor(doctorId: string) {
        return prisma.appointmentRequest.findMany({
            where: { doctorId, status: { in: ['APPROVED', 'PATIENT_ACCEPTED'] } },
            orderBy: { requestedDate: 'asc' },
            include: {
                patient: {
                    select: {
                        id: true, firstName: true, lastName: true, patientCode: true,
                        dateOfBirth: true, gender: true, bloodGroup: true, phone: true,
                        hasDiabetes: true, hasHypertension: true, hasHeartDisease: true,
                        allergies: true, currentMedications: true, medicalHistory: true,
                    },
                },
            },
        });
    },

    /** Receptionist: approve a request */
    async approve(id: string) {
        const req = await prisma.appointmentRequest.findUnique({
            where: { id },
            include: { patient: { select: { userId: true, firstName: true, lastName: true } } },
        });
        if (!req) throw new AppError('Request not found', 404, 'NOT_FOUND');
        if (req.status !== 'PENDING') throw new AppError('Request is no longer pending', 400, 'INVALID_STATUS');

        const updated = await prisma.appointmentRequest.update({
            where: { id },
            data: { status: 'APPROVED', approvedAt: new Date() },
        });

        const doctor = await prisma.user.findUnique({
            where: { id: req.doctorId },
            select: { id: true, firstName: true, lastName: true, specialization: true },
        });

        const patientUserId = req.patient.userId;
        if (patientUserId) {
            // Real-time notification
            emitAppointmentApproved(patientUserId, req.doctorId, {
                requestId: id,
                doctorName: `Dr. ${doctor?.firstName} ${doctor?.lastName}`,
                specialization: doctor?.specialization,
                date: req.requestedDate,
                slot: req.timeSlot,
                slotLabel: SLOT_LABELS[req.timeSlot] || req.timeSlot,
            });

            // Persistent notification
            await notificationService.create(
                patientUserId,
                '✅ Appointment Confirmed!',
                `Your appointment with Dr. ${doctor?.firstName} ${doctor?.lastName} (${doctor?.specialization}) on ${new Date(req.requestedDate).toDateString()} — ${SLOT_LABELS[req.timeSlot]} has been approved.`,
                'SUCCESS',
                { appointmentRequestId: id },
            );
        }

        return updated;
    },

    /** Receptionist: reject + counter-offer */
    async reject(id: string, counterDate: string, counterSlot: string, note?: string) {
        const req = await prisma.appointmentRequest.findUnique({
            where: { id },
            include: { patient: { select: { userId: true } } },
        });
        if (!req) throw new AppError('Request not found', 404, 'NOT_FOUND');
        if (req.status !== 'PENDING') throw new AppError('Request is no longer pending', 400, 'INVALID_STATUS');

        const updated = await prisma.appointmentRequest.update({
            where: { id },
            data: {
                status: 'COUNTER_OFFERED',
                counterDate: new Date(counterDate),
                counterSlot: counterSlot as any,
                receptionistNote: note,
                rejectedAt: new Date(),
            },
        });

        const doctor = await prisma.user.findUnique({
            where: { id: req.doctorId },
            select: { firstName: true, lastName: true, specialization: true },
        });

        const patientUserId = req.patient.userId;
        if (patientUserId) {
            emitAppointmentCounterOffer(patientUserId, {
                requestId: id,
                doctorName: `Dr. ${doctor?.firstName} ${doctor?.lastName}`,
                originalDate: req.requestedDate,
                originalSlot: req.timeSlot,
                counterDate,
                counterSlot,
                counterSlotLabel: SLOT_LABELS[counterSlot] || counterSlot,
                note,
            });

            await notificationService.create(
                patientUserId,
                '⏰ Appointment Rescheduled',
                `Dr. ${doctor?.firstName} is not available at your requested time. A new slot has been suggested: ${new Date(counterDate).toDateString()} — ${SLOT_LABELS[counterSlot]}. Please accept or decline.`,
                'ACTION_REQUIRED',
                { appointmentRequestId: id },
            );
        }

        return updated;
    },

    /** Patient: accept or decline a counter-offer */
    async patientRespond(id: string, patientUserId: string, accept: boolean) {
        const req = await prisma.appointmentRequest.findUnique({
            where: { id },
            include: { patient: { select: { userId: true } } },
        });
        if (!req) throw new AppError('Request not found', 404, 'NOT_FOUND');
        if (req.patient.userId !== patientUserId) throw new AppError('Forbidden', 403, 'FORBIDDEN');
        if (req.status !== 'COUNTER_OFFERED') throw new AppError('No counter-offer to respond to', 400, 'INVALID_STATUS');

        const newStatus = accept ? 'PATIENT_ACCEPTED' : 'PATIENT_DECLINED';
        const updated = await prisma.appointmentRequest.update({
            where: { id },
            data: {
                status: newStatus as any,
                ...(accept ? { approvedAt: new Date() } : {}),
            },
        });

        emitPatientResponded(req.doctorId, {
            requestId: id,
            patientUserId,
            accepted: accept,
            counterDate: req.counterDate,
            counterSlot: req.counterSlot,
        });

        return updated;
    },
};
