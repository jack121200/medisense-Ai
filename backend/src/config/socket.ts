import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { env } from './env';
import { logger } from './logger';

let io: SocketIOServer | null = null;

export function initSocketIO(server: HTTPServer): SocketIOServer {
    io = new SocketIOServer(server, {
        cors: {
            // Dev origins only outside production — this previously allowed
            // localhost through even on a deployed instance, unlike app.ts
            // which already gated them.
            origin: env.NODE_ENV === 'production'
                ? [env.FRONTEND_URL]
                : [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
        logger.info(`🔌 Socket connected: ${socket.id}`);

        // User-specific room (for targeted notifications)
        socket.on('join:user-room', (userId: string) => {
            socket.join(`user:${userId}`);
        });

        // Legacy patient room
        socket.on('join:patient-room', (patientId: string) => {
            socket.join(`patient:${patientId}`);
        });

        // Ward room
        socket.on('join:ward', (ward: string) => {
            socket.join(`ward:${ward}`);
        });

        // Role broadcast room (e.g. 'RECEPTIONIST', 'LAB_TECHNICIAN', 'DOCTOR')
        socket.on('join:role-room', (role: string) => {
            socket.join(`role:${role}`);
        });

        socket.on('disconnect', () => {
            logger.info(`🔌 Socket disconnected: ${socket.id}`);
        });
    });

    return io;
}

export function getIO(): SocketIOServer {
    if (!io) throw new Error('Socket.IO not initialized');
    return io;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function emitToUser(userId: string, event: string, data: Record<string, unknown>): void {
    getIO().to(`user:${userId}`).emit(event, data);
}

function emitToRole(role: string, event: string, data: Record<string, unknown>): void {
    getIO().to(`role:${role}`).emit(event, data);
}

// ── Vitals & Alerts ───────────────────────────────────────────────────────────

export function emitVitalsUpdate(patientId: string, data: Record<string, unknown>): void {
    getIO().to(`patient:${patientId}`).emit('vitals:update', { patientId, ...data });
    getIO().emit('vitals:update:global', { patientId, ...data });
}

export function emitNewAlert(alertData: Record<string, unknown>): void {
    getIO().emit('alert:new', alertData);
}

export function emitRiskEscalation(data: Record<string, unknown>): void {
    getIO().emit('risk:escalated', data);
}

export function emitModelRetrained(data: Record<string, unknown>): void {
    getIO().emit('model:retrained', data);
}

// ── In-app Notification ───────────────────────────────────────────────────────

export function emitNotification(userId: string, notification: Record<string, unknown>): void {
    emitToUser(userId, 'notification:new', notification);
}

// ── Appointment Request Flow ──────────────────────────────────────────────────

/** Patient submitted new appointment request → all receptionists see it instantly */
export function emitAppointmentRequestCreated(data: Record<string, unknown>): void {
    emitToRole('RECEPTIONIST', 'appointment_request:new', data);
}

/** Receptionist approved → patient + doctor get notified */
export function emitAppointmentApproved(patientUserId: string, doctorId: string, data: Record<string, unknown>): void {
    emitToUser(patientUserId, 'appointment_request:approved', data);
    emitToUser(doctorId, 'appointment_request:approved', data);
}

/** Receptionist rejected + counter-offered → patient sees Accept/Decline */
export function emitAppointmentCounterOffer(patientUserId: string, data: Record<string, unknown>): void {
    emitToUser(patientUserId, 'appointment_request:counter_offer', data);
}

/** Patient accepted/declined counter-offer → receptionist + doctor know */
export function emitPatientResponded(doctorId: string, data: Record<string, unknown>): void {
    emitToRole('RECEPTIONIST', 'appointment_request:patient_responded', data);
    emitToUser(doctorId, 'appointment_request:patient_responded', data);
}

// ── Consultation ──────────────────────────────────────────────────────────────

/** Doctor completed consultation → patient sees it in their portal */
export function emitConsultationCompleted(patientUserId: string, data: Record<string, unknown>): void {
    emitToUser(patientUserId, 'consultation:completed', data);
}

// ── Prescription ──────────────────────────────────────────────────────────────

/** Doctor wrote prescription → patient + lab tech get real-time update */
export function emitPrescriptionCreated(patientUserId: string, data: Record<string, unknown>): void {
    emitToUser(patientUserId, 'prescription:new', data);
}

// ── Lab Tests ─────────────────────────────────────────────────────────────────

/** Doctor ordered lab tests → ALL lab techs + patient notified */
export function emitLabOrderCreated(patientUserId: string, data: Record<string, unknown>): void {
    emitToRole('LAB_TECHNICIAN', 'lab_order:new', data);
    emitToUser(patientUserId, 'lab_order:created_for_you', data);
}

/** Lab tech uploaded PDF report → patient gets it instantly */
export function emitLabReportUploaded(patientUserId: string, data: Record<string, unknown>): void {
    emitToUser(patientUserId, 'lab_report:uploaded', data);
}

// ── Billing ───────────────────────────────────────────────────────────────────

/** Invoice/fee created → patient + receptionists */
export function emitInvoiceCreated(patientUserId: string, data: Record<string, unknown>): void {
    emitToUser(patientUserId, 'invoice:new', data);
    emitToRole('RECEPTIONIST', 'invoice:new', data);
}
