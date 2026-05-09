import { prisma } from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { Prisma } from '@prisma/client';

export const consultationService = {

    async create(data: {
        patientId: string;
        doctorId: string;
        appointmentId?: string;
        symptoms?: string[];
        notes?: string;
    }) {
        return prisma.consultation.create({
            data: {
                patientId: data.patientId,
                doctorId: data.doctorId,
                appointmentId: data.appointmentId,
                symptoms: data.symptoms || [],
                notes: data.notes,
                status: 'IN_PROGRESS',
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
                prescription: { include: { items: true } },
                labTestRequests: true,
                invoice: { include: { items: true } },
            },
        });
    },

    async getById(id: string) {
        const c = await prisma.consultation.findUnique({
            where: { id },
            include: {
                patient: {
                    include: {
                        admissions: { take: 3, orderBy: { admittedAt: 'desc' }, include: { clinicalData: true } },
                        prescriptions: { take: 5, orderBy: { createdAt: 'desc' }, include: { items: true } },
                        labTestRequests: { take: 5, orderBy: { createdAt: 'desc' }, include: { result: true } },
                        alerts: { where: { isResolved: false }, take: 5 },
                    },
                },
                prescription: { include: { items: true } },
                labTestRequests: { include: { result: true } },
                invoice: { include: { items: true } },
            },
        });
        if (!c) throw new AppError('Consultation not found', 404, 'NOT_FOUND');
        return c;
    },

    async getByDoctor(doctorId: string, date?: string) {
        const dayStart = date ? new Date(date) : new Date();
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        return prisma.consultation.findMany({
            where: {
                doctorId,
                createdAt: { gte: dayStart, lt: dayEnd },
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, currentRiskLevel: true, phone: true } },
                prescription: { select: { id: true } },
                labTestRequests: { select: { id: true, status: true } },
                invoice: { select: { id: true, isPaid: true, totalAmount: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
    },

    async getByPatient(patientId: string) {
        return prisma.consultation.findMany({
            where: { patientId },
            include: {
                prescription: { include: { items: true } },
                labTestRequests: { include: { result: true } },
                invoice: { include: { items: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    },

    async update(id: string, data: {
        symptoms?: string[];
        notes?: string;
        diagnosis?: string;
        aiDiseasePred?: any;
        status?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    }) {
        return prisma.consultation.update({
            where: { id },
            data,
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
                prescription: { include: { items: true } },
                labTestRequests: { include: { result: true } },
                invoice: { include: { items: true } },
            },
        });
    },

    async savePrescription(consultationId: string, data: {
        patientId: string;
        doctorId: string;
        notes?: string;
        items: Array<{ medicineName: string; dosage: string; frequency: string; duration?: string; instructions?: string }>;
    }) {
        // Upsert prescription
        const existing = await prisma.prescription.findUnique({ where: { consultationId } });
        if (existing) {
            await prisma.prescriptionItem.deleteMany({ where: { prescriptionId: existing.id } });
            return prisma.prescription.update({
                where: { consultationId },
                data: {
                    notes: data.notes,
                    items: { create: data.items },
                },
                include: { items: true },
            });
        }
        return prisma.prescription.create({
            data: {
                consultationId,
                patientId: data.patientId,
                doctorId: data.doctorId,
                notes: data.notes,
                items: { create: data.items },
            },
            include: { items: true },
        });
    },

    async closeAndBill(consultationId: string, patientId: string) {
        const consultation = await prisma.consultation.findUnique({
            where: { id: consultationId },
            include: { labTestRequests: true, invoice: true },
        });
        if (!consultation) throw new AppError('Consultation not found', 404, 'NOT_FOUND');
        if (consultation.invoice) return consultation.invoice;

        // Build invoice items
        const LAB_FEES: Record<string, number> = {
            BLOOD_TEST: 700, URINE_TEST: 300, XRAY: 800, ECG: 500,
            CT_SCAN: 3000, MRI: 4500, ULTRASOUND: 1200, STOOL_TEST: 250,
            CULTURE: 900, BIOPSY: 2500,
        };
        const invoiceItems: { description: string; amount: number }[] = [
            { description: 'Consultation Fee', amount: 500 },
        ];
        for (const test of consultation.labTestRequests) {
            invoiceItems.push({ description: test.testType.replace('_', ' '), amount: LAB_FEES[test.testType] || 500 });
        }
        const subtotal = invoiceItems.reduce((s, i) => s + i.amount, 0);
        const count = await prisma.invoice.count();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber,
                patientId,
                consultationId,
                subtotal,
                totalAmount: subtotal,
                items: { create: invoiceItems },
            },
            include: { items: true },
        });

        // Mark consultation completed
        await prisma.consultation.update({ where: { id: consultationId }, data: { status: 'COMPLETED' } });
        return invoice;
    },
};
