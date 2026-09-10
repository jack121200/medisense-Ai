import { PassThrough } from 'stream';
import { Response } from 'express';

const mockFindUnique = jest.fn();
jest.mock('../src/config/database', () => ({
    prisma: { aiDoctorCall: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}));

import { generateAiDoctorCallPDF } from '../src/modules/reports/aiDoctorReport';

const patient = {
    firstName: 'Ramesh', lastName: 'Gupta', patientCode: 'PAT-2026-001',
    gender: 'MALE', dateOfBirth: new Date('1954-03-11'),
    currentMedications: 'Amlodipine 5mg', allergies: 'Penicillin',
};

const fullCall = {
    id: 'call-abc-123',
    startedAt: new Date('2026-09-10T10:30:00Z'),
    durationSecs: 372,
    doctorSuggestions: {
        summary: 'Burning epigastric discomfort for two weeks, worse after late meals.',
        possible_conditions: ['Gastro-oesophageal reflux', 'Functional dyspepsia'],
        recommended_actions: ['Amla juice 20ml each morning for 3 weeks', 'Dinner by 7:30pm'],
        red_flags: ['Burning chest pain can be cardiac — reassess if it occurs on exertion'],
        follow_up: 'Reassess in 2 weeks',
        urgency: 'SOON',
    },
    preCallData: { reason: 'Pet mein jalan aur khatti dakar, 2 hafte se' },
    patient,
};

/** Renders the PDF to a buffer so tests can assert on real output. */
async function render(call: unknown): Promise<Buffer> {
    mockFindUnique.mockResolvedValue(call);
    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    stream.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>(resolve => stream.on('end', () => resolve()));

    const res = stream as unknown as Response;
    (res as unknown as { setHeader: () => void }).setHeader = () => { /* not needed off-express */ };

    await generateAiDoctorCallPDF('call-abc-123', res);
    await done;
    return Buffer.concat(chunks);
}

describe('generateAiDoctorCallPDF', () => {
    beforeEach(() => mockFindUnique.mockReset());

    it('produces a valid PDF', async () => {
        const pdf = await render(fullCall);
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
        expect(pdf.length).toBeGreaterThan(1000);
    });

    it('renders without throwing when the assessment is missing entirely', async () => {
        // A call that drops before enough conversation is captured saves with
        // no doctorSuggestions — the PDF still has to render for that patient.
        const pdf = await render({ ...fullCall, doctorSuggestions: null, preCallData: null });
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('renders when optional assessment fields are absent', async () => {
        const pdf = await render({
            ...fullCall,
            durationSecs: null,
            doctorSuggestions: { summary: 'Short consultation.', urgency: 'ROUTINE' },
        });
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('rejects a consultation id that does not exist', async () => {
        mockFindUnique.mockResolvedValue(null);
        const res = new PassThrough() as unknown as Response;
        (res as unknown as { setHeader: () => void }).setHeader = () => { /* noop */ };
        await expect(generateAiDoctorCallPDF('missing', res)).rejects.toThrow('Consultation not found');
    });

    it('handles a patient with no recorded allergies or medications', async () => {
        const pdf = await render({
            ...fullCall,
            patient: { ...patient, allergies: null, currentMedications: null, dateOfBirth: null },
        });
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });
});
