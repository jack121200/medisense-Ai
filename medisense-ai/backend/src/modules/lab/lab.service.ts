import { prisma } from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { emitLabReportUploaded } from '../../config/socket';
import { notificationService } from '../notifications/notification.service';

export const labService = {

    /** Lab tech: upload a PDF report (actual file URL from upload) */
    async uploadPdfReport(requestId: string, fileUrl: string, technicianNote?: string) {
        const req = await prisma.labTestRequest.findUnique({
            where: { id: requestId },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, userId: true, patientCode: true } },
            },
        });
        if (!req) throw new AppError('Lab test request not found', 404, 'NOT_FOUND');

        // Upsert result with PDF
        const result = await prisma.labTestResult.upsert({
            where: { requestId },
            update: { fileUrl, rawValues: { note: technicianNote } },
            create: { requestId, fileUrl, rawValues: { note: technicianNote }, aiAnalysis: {} },
        });

        await prisma.labTestRequest.update({
            where: { id: requestId },
            data: { status: 'COMPLETED' },
        });

        // Real-time + persistent notification to patient
        const patientUserId = req.patient.userId;
        if (patientUserId) {
            emitLabReportUploaded(patientUserId, {
                requestId,
                testId: req.testId,
                testType: req.testType,
                fileUrl,
                patientName: `${req.patient.firstName} ${req.patient.lastName}`,
            });
            await notificationService.create(
                patientUserId,
                '🧪 Lab Report Ready!',
                `Your ${req.testType.replace('_', ' ')} report is ready. You can download it from your Lab Reports section.`,
                'SUCCESS',
                { labTestRequestId: requestId, fileUrl },
            );
        }

        return { result, testId: req.testId, testType: req.testType };
    },


    async createRequest(data: {
        patientId: string;
        consultationId?: string;
        orderedByDocId: string;
        testType: string;
        priority?: string;
        notes?: string;
    }) {
        const count = await prisma.labTestRequest.count();
        const testId = `TEST-${String(count + 1).padStart(4, '0')}`;
        return prisma.labTestRequest.create({
            data: {
                testId,
                patientId: data.patientId,
                consultationId: data.consultationId,
                orderedByDocId: data.orderedByDocId,
                testType: data.testType as any,
                priority: data.priority || 'NORMAL',
                notes: data.notes,
                status: 'PENDING',
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
            },
        });
    },

    async getPending() {
        return prisma.labTestRequest.findMany({
            where: { status: { in: ['PENDING', 'ACCEPTED', 'SAMPLE_COLLECTED'] } },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true } },
                result: true,
            },
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        });
    },

    async getAll(filters?: { patientId?: string; status?: string }) {
        return prisma.labTestRequest.findMany({
            where: {
                ...(filters?.patientId && { patientId: filters.patientId }),
                ...(filters?.status && { status: filters.status as any }),
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
                result: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    },

    async getById(id: string) {
        const req = await prisma.labTestRequest.findUnique({
            where: { id },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true } },
                result: true,
            },
        });
        if (!req) throw new AppError('Lab test request not found', 404, 'NOT_FOUND');
        return req;
    },

    async accept(id: string) {
        return prisma.labTestRequest.update({
            where: { id },
            data: { status: 'ACCEPTED' },
            include: { patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } } },
        });
    },

    async markSampleCollected(id: string) {
        return prisma.labTestRequest.update({
            where: { id },
            data: { status: 'SAMPLE_COLLECTED' },
        });
    },

    async uploadResult(requestId: string, data: {
        hemoglobin?: number;
        wbc?: number;
        platelets?: number;
        rbc?: number;
        glucose?: number;
        cholesterol?: number;
        creatinine?: number;
        rawValues?: Record<string, any>;
        fileUrl?: string;
    }) {
        // AI Analysis — flag abnormal values
        const aiAlerts: string[] = [];
        const REF = {
            hemoglobin: { low: 12, high: 17, label: 'Hemoglobin' },
            wbc: { low: 4.0, high: 11.0, label: 'WBC' },
            platelets: { low: 150, high: 400, label: 'Platelets' },
            glucose: { low: 70, high: 100, label: 'Glucose (Fasting)' },
            cholesterol: { low: 0, high: 200, label: 'Cholesterol' },
            creatinine: { low: 0.6, high: 1.2, label: 'Creatinine' },
        };
        for (const [key, ref] of Object.entries(REF)) {
            const val = (data as any)[key];
            if (val !== undefined && val !== null) {
                if (val < ref.low) aiAlerts.push(`⚠️ ${ref.label} LOW (${val}) — below ${ref.low}`);
                if (val > ref.high) aiAlerts.push(`⚠️ ${ref.label} HIGH (${val}) — above ${ref.high}`);
            }
        }

        // Possible disease hints from AI
        const hints: string[] = [];
        if (data.platelets && data.platelets < 100) hints.push('Possible Dengue — Platelet very low');
        if (data.wbc && data.wbc > 11) hints.push('Possible Infection / Sepsis — WBC high');
        if (data.hemoglobin && data.hemoglobin < 10) hints.push('Anemia detected');
        if (data.glucose && data.glucose > 126) hints.push('Possible Diabetes — Glucose elevated');

        const aiAnalysis = { alerts: aiAlerts, hints, analyzedAt: new Date().toISOString() };

        const result = await prisma.labTestResult.create({
            data: {
                requestId,
                hemoglobin: data.hemoglobin,
                wbc: data.wbc,
                platelets: data.platelets,
                rbc: data.rbc,
                glucose: data.glucose,
                cholesterol: data.cholesterol,
                creatinine: data.creatinine,
                rawValues: data.rawValues || {},
                fileUrl: data.fileUrl,
                aiAnalysis,
            },
        });

        await prisma.labTestRequest.update({
            where: { id: requestId },
            data: { status: 'COMPLETED' },
        });

        return { result, aiAnalysis };
    },
};
