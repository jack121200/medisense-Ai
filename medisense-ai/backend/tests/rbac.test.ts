import { requireRole, requireOwnership } from '../src/middleware/rbac.middleware';
import { AppError } from '../src/utils/apiResponse';

// Mock the Prisma singleton so these tests run with no live database —
// this is the highest-leverage test in the suite since rbac.middleware.ts
// is now shared across 8+ routers (see Phase 1.1/1.2).
jest.mock('../src/config/database', () => ({
    prisma: {
        patient: { findFirst: jest.fn(), findUnique: jest.fn() },
        vitalsReading: { findUnique: jest.fn() },
        alert: { findUnique: jest.fn() },
        invoice: { findUnique: jest.fn() },
        consultation: { findUnique: jest.fn() },
        labTestRequest: { findUnique: jest.fn() },
        labTestResult: { findUnique: jest.fn() },
        mLPrediction: { findUnique: jest.fn() },
        aiDoctorCall: { findUnique: jest.fn() },
    },
}));

import { prisma } from '../src/config/database';

function mockReqRes(user: { id: string; role: string } | undefined, params: Record<string, string> = {}) {
    const req: any = { user, params, body: {}, query: {} };
    const res: any = {};
    const next = jest.fn();
    return { req, res, next };
}

describe('requireRole', () => {
    it('blocks unauthenticated requests', () => {
        const { req, res, next } = mockReqRes(undefined);
        requireRole('ADMIN')(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
    });

    it('blocks a role not in the allow-list', () => {
        const { req, res, next } = mockReqRes({ id: 'u1', role: 'PATIENT' });
        requireRole('ADMIN', 'DOCTOR')(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect((next.mock.calls[0][0] as AppError).statusCode).toBe(403);
    });

    it('allows a role in the allow-list', () => {
        const { req, res, next } = mockReqRes({ id: 'u1', role: 'DOCTOR' });
        requireRole('ADMIN', 'DOCTOR')(req, res, next);
        expect(next).toHaveBeenCalledWith(); // called with no args = pass-through
    });
});

describe('requireOwnership', () => {
    const findFirst = prisma.patient.findFirst as jest.Mock;
    const findUnique = prisma.patient.findUnique as jest.Mock;

    it('lets staff in allowRoles through without an ownership check', async () => {
        const { req, res, next } = mockReqRes({ id: 'staff1', role: 'DOCTOR' }, { patientId: 'p1' });
        await requireOwnership('patient', { allowRoles: ['DOCTOR'] })(req, res, next);
        expect(next).toHaveBeenCalledWith();
        expect(findFirst).not.toHaveBeenCalled();
    });

    it('blocks a role that is neither staff nor PATIENT', async () => {
        const { req, res, next } = mockReqRes({ id: 'u1', role: 'ANALYST' }, { patientId: 'p1' });
        await requireOwnership('patient', { allowRoles: ['DOCTOR'] })(req, res, next);
        expect((next.mock.calls[0][0] as AppError).statusCode).toBe(403);
    });

    it('404s when the calling patient has no linked Patient record', async () => {
        findFirst.mockResolvedValueOnce(null); // resolveOwnPatientId
        const { req, res, next } = mockReqRes({ id: 'u1', role: 'PATIENT' }, { patientId: 'p1' });
        await requireOwnership('patient')(req, res, next);
        expect((next.mock.calls[0][0] as AppError).statusCode).toBe(404);
        expect((next.mock.calls[0][0] as AppError).errorCode).toBe('PATIENT_NOT_FOUND');
    });

    it('404s (not 403) when the target resource does not exist — avoids leaking existence', async () => {
        findFirst.mockResolvedValueOnce({ id: 'own-patient-id' });
        findUnique.mockResolvedValueOnce(null); // resourceResolvers.patient
        const { req, res, next } = mockReqRes({ id: 'u1', role: 'PATIENT' }, { patientId: 'nonexistent' });
        await requireOwnership('patient')(req, res, next);
        expect((next.mock.calls[0][0] as AppError).statusCode).toBe(404);
    });

    it("403s when a patient targets someone else's record", async () => {
        findFirst.mockResolvedValueOnce({ id: 'own-patient-id' });
        findUnique.mockResolvedValueOnce({ id: 'someone-elses-patient-id' });
        const { req, res, next } = mockReqRes({ id: 'u1', role: 'PATIENT' }, { patientId: 'someone-elses-patient-id' });
        await requireOwnership('patient')(req, res, next);
        expect((next.mock.calls[0][0] as AppError).statusCode).toBe(403);
    });

    it('allows a patient to access their own record', async () => {
        findFirst.mockResolvedValueOnce({ id: 'own-patient-id' });
        findUnique.mockResolvedValueOnce({ id: 'own-patient-id' });
        const { req, res, next } = mockReqRes({ id: 'u1', role: 'PATIENT' }, { patientId: 'own-patient-id' });
        await requireOwnership('patient')(req, res, next);
        expect(next).toHaveBeenCalledWith();
    });
});
