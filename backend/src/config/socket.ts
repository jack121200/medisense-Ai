import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { logger } from './logger';
import { prisma } from './database';

let io: SocketIOServer | null = null;

// Every connection is authenticated and placed in its rooms by the server.
//
// Previously the handshake token was never checked and clients joined
// whatever rooms they named: anyone — logged in or not — could join another
// user's room and receive their prescriptions, invoices and appointments, or
// join a role room ('RECEPTIONIST') and receive every invoice. Clinical
// alerts, risk escalations and all patients' vitals were broadcast to every
// connected socket, patients included.

interface SocketUser { id: string; role: string }

const STAFF_ROOM = 'staff';

function userOf(socket: Socket): SocketUser {
    return socket.data.user as SocketUser;
}

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

    // Same checks as the HTTP `authenticate` middleware: a valid access token
    // for an account that still exists and is active.
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (typeof token !== 'string' || !token) return next(new Error('UNAUTHORIZED'));
            const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { id: string };
            const user = await prisma.user.findUnique({
                where: { id: decoded.id, isActive: true },
                select: { id: true, role: true },
            });
            if (!user) return next(new Error('UNAUTHORIZED'));
            socket.data.user = { id: user.id, role: user.role } satisfies SocketUser;
            next();
        } catch {
            next(new Error('UNAUTHORIZED'));
        }
    });

    io.on('connection', (socket) => {
        const user = userOf(socket);
        socket.join(`user:${user.id}`);
        socket.join(`role:${user.role}`);
        if (user.role !== 'PATIENT') socket.join(STAFF_ROOM);
        logger.info(`🔌 Socket connected: ${socket.id} (${user.role})`);

        // Live vitals for one patient. Staff may follow any patient; a patient
        // only their own record.
        socket.on('join:patient-room', async (patientId: unknown) => {
            if (typeof patientId !== 'string' || !patientId) return;
            if (user.role !== 'PATIENT') {
                socket.join(`patient:${patientId}`);
                return;
            }
            try {
                const own = await prisma.patient.findFirst({ where: { userId: user.id }, select: { id: true } });
                if (own?.id === patientId) socket.join(`patient:${patientId}`);
            } catch (err: any) {
                logger.warn(`Socket patient-room check failed: ${err?.message}`);
            }
        });

        socket.on('leave:patient', (patientId: unknown) => {
            if (typeof patientId === 'string') socket.leave(`patient:${patientId}`);
        });

        // Ward room — staff only
        socket.on('join:ward', (ward: unknown) => {
            if (user.role !== 'PATIENT' && typeof ward === 'string') socket.join(`ward:${ward}`);
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

function emitToStaff(event: string, data: Record<string, unknown>): void {
    getIO().to(STAFF_ROOM).emit(event, data);
}

// ── Vitals & Alerts ───────────────────────────────────────────────────────────
// Clinical data about other people: staff only, never every connection.

export function emitVitalsUpdate(patientId: string, data: Record<string, unknown>): void {
    getIO().to(`patient:${patientId}`).emit('vitals:update', { patientId, ...data });
    emitToStaff('vitals:update:global', { patientId, ...data });
}

export function emitNewAlert(alertData: Record<string, unknown>): void {
    emitToStaff('alert:new', alertData);
}

export function emitRiskEscalation(data: Record<string, unknown>): void {
    emitToStaff('risk:escalated', data);
}

export function emitModelRetrained(data: Record<string, unknown>): void {
    emitToStaff('model:retrained', data);
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
