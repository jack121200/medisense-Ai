import { prisma } from '../config/database';
import { AuthRequest } from './auth.middleware';

/**
 * Every resource type that `requireOwnership` can guard. Adding a new
 * ownership-checked route means adding one entry here — routers never
 * hand-roll their own "does this belong to me" query.
 */
export type ResourceType =
    | 'patient'
    | 'vitals'
    | 'alert'
    | 'billing'
    | 'consultation'
    | 'labReport'
    | 'mlPrediction'
    | 'aiDoctorCall';

/**
 * Resolves the id of the request's target resource (from params/body/query,
 * per-resource) to the `Patient.id` that owns it. Returns null if the
 * resource doesn't exist — requireOwnership treats that as 404, not 403,
 * so we don't leak whether a given id belongs to someone else.
 */
type Resolver = (req: AuthRequest) => Promise<string | null>;

function paramOrBody(req: AuthRequest, key: string): string | undefined {
    return (req.params?.[key] as string) || (req.body?.[key] as string) || (req.query?.[key] as string);
}

export const resourceResolvers: Record<ResourceType, Resolver> = {
    patient: async (req) => {
        const id = paramOrBody(req, 'patientId') ?? paramOrBody(req, 'id');
        if (!id) return null;
        const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
        return patient?.id ?? null;
    },

    vitals: async (req) => {
        // Reads (GET /patient/:patientId) carry the patient id directly;
        // writes on a single reading (PATCH /alerts/:id/resolve-style routes)
        // carry the reading id and need a lookup.
        const patientId = paramOrBody(req, 'patientId');
        if (patientId) return patientId;
        const id = paramOrBody(req, 'id');
        if (!id) return null;
        const reading = await prisma.vitalsReading.findUnique({ where: { id }, select: { patientId: true } });
        return reading?.patientId ?? null;
    },

    alert: async (req) => {
        const id = paramOrBody(req, 'id');
        if (!id) return null;
        const alert = await prisma.alert.findUnique({ where: { id }, select: { patientId: true } });
        return alert?.patientId ?? null;
    },

    billing: async (req) => {
        const id = paramOrBody(req, 'id');
        if (!id) return null;
        const invoice = await prisma.invoice.findUnique({ where: { id }, select: { patientId: true } });
        return invoice?.patientId ?? null;
    },

    consultation: async (req) => {
        const patientId = paramOrBody(req, 'patientId');
        if (patientId) return patientId;
        const id = paramOrBody(req, 'id');
        if (!id) return null;
        const consultation = await prisma.consultation.findUnique({ where: { id }, select: { patientId: true } });
        return consultation?.patientId ?? null;
    },

    labReport: async (req) => {
        const id = paramOrBody(req, 'id');
        if (!id) return null;
        // id may refer to either the LabTestRequest or its LabTestResult —
        // try the request first (covers list/detail/status routes), fall
        // back to the result (covers the file-download route by result id).
        const request = await prisma.labTestRequest.findUnique({ where: { id }, select: { patientId: true } });
        if (request) return request.patientId;
        const result = await prisma.labTestResult.findUnique({
            where: { id },
            select: { request: { select: { patientId: true } } },
        });
        return result?.request.patientId ?? null;
    },

    mlPrediction: async (req) => {
        const patientId = paramOrBody(req, 'patientId');
        if (patientId) return patientId;
        const id = paramOrBody(req, 'id') ?? paramOrBody(req, 'predictionId');
        if (!id) return null;
        const prediction = await prisma.mLPrediction.findUnique({ where: { id }, select: { patientId: true } });
        return prediction?.patientId ?? null;
    },

    aiDoctorCall: async (req) => {
        const id = paramOrBody(req, 'id');
        if (!id) return null;
        const call = await prisma.aiDoctorCall.findUnique({ where: { id }, select: { patientId: true } });
        return call?.patientId ?? null;
    },
};

/** Resolves the logged-in user's own Patient.id, for PATIENT-role callers. */
export async function resolveOwnPatientId(userId: string): Promise<string | null> {
    const patient = await prisma.patient.findFirst({ where: { userId }, select: { id: true } });
    return patient?.id ?? null;
}
