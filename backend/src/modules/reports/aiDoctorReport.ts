import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/apiResponse';

/**
 * Consultation report PDF for a single AI Doctor call.
 *
 * The structured assessment previously existed only as JSON rendered inside
 * the app, so a patient had nothing to take to a physical appointment and a
 * doctor had nothing to file. This renders the same assessment as a document
 * that carries its own provenance — what produced it, what it is not, and
 * what to do in an emergency — because a printed page outlives the UI
 * context that would otherwise explain those things.
 */

// Matches the "Clinical Teal" palette in frontend/src/index.css. Kept as
// literals because pdfkit has no access to the stylesheet.
const INK = '#0B2B3B';
const OCEAN = '#0D5C7E';
const MUTED = '#4C6B7C';
const RULE = '#CEEAEC';
const URGENCY_COLOR: Record<string, string> = {
    URGENT: '#D13F4A',
    SOON: '#E8833A',
    ROUTINE: '#189B82',
};

interface DoctorSuggestions {
    summary?: string;
    possible_conditions?: string[];
    recommended_actions?: string[];
    red_flags?: string[];
    follow_up?: string;
    urgency?: string;
}

function sectionHeading(doc: PDFKit.PDFDocument, title: string): void {
    doc.moveDown(0.8);
    doc.fontSize(11).fillColor(OCEAN).font('Helvetica-Bold').text(title.toUpperCase(), { characterSpacing: 0.6 });
    doc.moveDown(0.25);
    doc.strokeColor(RULE).lineWidth(1)
        .moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.5);
}

function bulletList(doc: PDFKit.PDFDocument, items: string[], color = INK): void {
    doc.fontSize(10.5).font('Helvetica').fillColor(color);
    for (const item of items) {
        doc.text(`•  ${item}`, { paragraphGap: 3, lineGap: 1.5 });
    }
}

export async function generateAiDoctorCallPDF(callId: string, res: Response): Promise<void> {
    const call = await prisma.aiDoctorCall.findUnique({
        where: { id: callId },
        include: {
            patient: {
                select: {
                    firstName: true, lastName: true, patientCode: true, gender: true,
                    dateOfBirth: true, currentMedications: true, allergies: true,
                },
            },
        },
    });

    if (!call) throw new AppError('Consultation not found', 404, 'NOT_FOUND');

    const suggestions = (call.doctorSuggestions ?? {}) as DoctorSuggestions;
    const preCall = (call.preCallData ?? {}) as { reason?: string; additionalNotes?: string };
    const patient = call.patient;
    const age = patient.dateOfBirth
        ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600000))
        : null;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="consultation-${patient.patientCode}-${call.startedAt.toISOString().slice(0, 10)}.pdf"`,
    );
    doc.pipe(res);

    // ── Masthead ──────────────────────────────────────────────────────────
    doc.fontSize(20).fillColor(INK).font('Helvetica-Bold').text('MediSense AI');
    doc.fontSize(11).fillColor(MUTED).font('Helvetica')
        .text('AI Health Assistant — Consultation Summary');
    doc.moveDown(0.4);
    doc.strokeColor(OCEAN).lineWidth(2)
        .moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.6);

    // Urgency is the first thing a reviewing clinician should see.
    const urgency = (suggestions.urgency || 'ROUTINE').toUpperCase();
    const urgencyColor = URGENCY_COLOR[urgency] || MUTED;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(urgencyColor)
        .text(`ASSESSED URGENCY:  ${urgency}`);
    doc.moveDown(0.3);

    // ── Consultation + patient details ────────────────────────────────────
    sectionHeading(doc, 'Consultation');
    doc.fontSize(10.5).font('Helvetica').fillColor(INK);
    const started = call.startedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const duration = call.durationSecs
        ? `${Math.floor(call.durationSecs / 60)}m ${call.durationSecs % 60}s`
        : 'Not recorded';
    doc.text(`Date: ${started}`);
    doc.text(`Duration: ${duration}`);
    doc.text(`Patient: ${patient.firstName} ${patient.lastName}  (${patient.patientCode})`);
    doc.text(`Age / Gender: ${age !== null ? `${age} years` : 'Unknown'} / ${patient.gender}`);
    if (patient.allergies) doc.fillColor('#D13F4A').text(`Allergies: ${patient.allergies}`).fillColor(INK);
    if (patient.currentMedications) doc.text(`Current medications: ${patient.currentMedications}`);

    if (preCall.reason) {
        sectionHeading(doc, 'Reason for consultation');
        doc.fontSize(10.5).font('Helvetica').fillColor(INK).text(preCall.reason, { lineGap: 1.5 });
    }

    // ── Assessment ────────────────────────────────────────────────────────
    if (suggestions.summary) {
        sectionHeading(doc, 'Summary');
        doc.fontSize(10.5).font('Helvetica').fillColor(INK).text(suggestions.summary, { lineGap: 2 });
    }

    if (suggestions.possible_conditions?.length) {
        sectionHeading(doc, 'Possible conditions to consider');
        bulletList(doc, suggestions.possible_conditions);
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor(MUTED).font('Helvetica-Oblique')
            .text('Considerations raised during conversation — not a diagnosis.');
    }

    if (suggestions.recommended_actions?.length) {
        sectionHeading(doc, 'Suggested self-care');
        bulletList(doc, suggestions.recommended_actions);
    }

    if (suggestions.red_flags?.length) {
        sectionHeading(doc, 'Flags for clinician review');
        bulletList(doc, suggestions.red_flags, '#D13F4A');
    }

    if (suggestions.follow_up) {
        sectionHeading(doc, 'Follow-up');
        doc.fontSize(10.5).font('Helvetica').fillColor(INK).text(suggestions.follow_up, { lineGap: 1.5 });
    }

    if (!suggestions.summary && !suggestions.recommended_actions?.length) {
        sectionHeading(doc, 'Assessment');
        doc.fontSize(10.5).font('Helvetica').fillColor(MUTED)
            .text('No assessment was generated for this consultation. This happens when a '
                + 'call ends before enough of the conversation was captured to summarise.');
    }

    // ── Provenance + disclaimer ───────────────────────────────────────────
    doc.moveDown(1.2);
    doc.strokeColor(RULE).lineWidth(1)
        .moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED);
    doc.text(
        'This summary was produced by MediSense AI\'s automated health assistant from a voice '
        + 'consultation. Suggestions are grounded in a curated Ayurvedic and general self-care '
        + 'knowledge base and screened against the medicines and conditions on record, but the '
        + 'assistant is not a licensed physician and this document is not a medical diagnosis or '
        + 'prescription. It is intended to be reviewed by a qualified doctor.',
        { lineGap: 1.2, align: 'justify' },
    );
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fillColor('#D13F4A')
        .text('In an emergency in India, call 108 immediately. Do not wait for a review of this document.');
    doc.moveDown(0.4);
    doc.font('Helvetica').fillColor(MUTED)
        .text(`Generated ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}  ·  `
            + `Consultation reference ${call.id}`);

    doc.end();
}
