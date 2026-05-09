import { prisma } from '../../config/database';
import { cacheGet, cacheSet, cacheDel } from '../../config/redis';
import { AppError } from '../../utils/apiResponse';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { Prisma } from '@prisma/client';

export const patientService = {
    async list(params: {
        page?: string; limit?: string; search?: string;
        riskLevel?: string; ward?: string; gender?: string;
    }) {
        const { page, limit, skip } = getPagination(params.page, params.limit);

        const where: Prisma.PatientWhereInput = { isActive: true, isSeeded: false };
        if (params.riskLevel) where.currentRiskLevel = params.riskLevel as any;
        if (params.gender) where.gender = params.gender as any;
        if (params.search) {
            where.OR = [
                { firstName: { contains: params.search, mode: 'insensitive' } },
                { lastName: { contains: params.search, mode: 'insensitive' } },
                { patientCode: { contains: params.search, mode: 'insensitive' } },
                { email: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        const [patients, total] = await Promise.all([
            prisma.patient.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ currentRiskLevel: 'desc' }, { updatedAt: 'desc' }],
                include: {
                    admissions: {
                        take: 1,
                        orderBy: { admittedAt: 'desc' },
                        select: { wardType: true, admittedAt: true, dischargedAt: true },
                    },
                    alerts: {
                        where: { isResolved: false },
                        select: { id: true, severity: true },
                    },
                },
            }),
            prisma.patient.count({ where }),
        ]);

        return { patients, pagination: buildPaginationMeta(total, page, limit) };
    },

    async getById(id: string) {
        const cacheKey = `patient:${id}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;

        const patient = await prisma.patient.findUnique({
            where: { id, isActive: true, isSeeded: false },
            include: {
                admissions: {
                    orderBy: { admittedAt: 'desc' },
                    include: { clinicalData: true },
                },
                mlPredictions: { orderBy: { createdAt: 'desc' }, take: 5 },
                careRecommendations: {
                    where: { isAcknowledged: false },
                    include: { items: true },
                    orderBy: { generatedAt: 'desc' },
                    take: 3,
                },
                alerts: {
                    where: { isResolved: false },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');
        await cacheSet(cacheKey, patient, 300);
        return patient;
    },


    async create(rawData: any) {
        // Map blood type strings → BloodGroup enum
        const bloodTypeMap: Record<string, string> = {
            'A+': 'A_POS', 'A-': 'A_NEG', 'B+': 'B_POS', 'B-': 'B_NEG',
            'AB+': 'AB_POS', 'AB-': 'AB_NEG', 'O+': 'O_POS', 'O-': 'O_NEG',
            // Also accept enum values directly
            'A_POS': 'A_POS', 'A_NEG': 'A_NEG', 'B_POS': 'B_POS', 'B_NEG': 'B_NEG',
            'AB_POS': 'AB_POS', 'AB_NEG': 'AB_NEG', 'O_POS': 'O_POS', 'O_NEG': 'O_NEG',
        };

        // Flatten contact / emergency contact if nested
        const phone = rawData.phone || rawData.contactInfo?.phone;
        const email = rawData.email || rawData.contactInfo?.email;
        const address = rawData.address || rawData.contactInfo?.address;
        const emergencyContactName = rawData.emergencyContactName || rawData.emergencyContact?.name;
        const emergencyContactPhone = rawData.emergencyContactPhone || rawData.emergencyContact?.phone;
        const bloodGroup = bloodTypeMap[rawData.bloodType || rawData.bloodGroup] || undefined;

        const count = await prisma.patient.count();
        const patientCode = `PAT-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

        const patient = await prisma.patient.create({
            data: {
                patientCode,
                firstName: rawData.firstName,
                lastName: rawData.lastName,
                dateOfBirth: new Date(rawData.dateOfBirth),
                gender: rawData.gender,
                bloodGroup: bloodGroup as any,
                phone,
                email,
                address,
                emergencyContactName,
                emergencyContactPhone,
                isSeeded: false,
            },
        });
        return patient;
    },


    async update(id: string, data: Prisma.PatientUpdateInput) {
        const patient = await prisma.patient.update({
            where: { id, isActive: true },
            data,
        });
        await cacheDel(`patient:${id}`);
        return patient;
    },

    async softDelete(id: string) {
        await prisma.patient.update({ where: { id }, data: { isActive: false } });
        await cacheDel(`patient:${id}`);
    },

    async getHighRisk() {
        return prisma.patient.findMany({
            where: { isActive: true, isSeeded: false, currentRiskLevel: { in: ['HIGH', 'CRITICAL'] } },
            orderBy: [{ currentRiskLevel: 'desc' }, { riskScore: 'desc' }],
            include: {
                alerts: { where: { isResolved: false }, orderBy: { createdAt: 'desc' }, take: 3 },
            },
        });
    },

    async getVitalsHistory(patientId: string, timeRange?: string) {
        const hours = timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : timeRange === '6h' ? 6 : 24;
        const from = new Date(Date.now() - hours * 60 * 60 * 1000);
        return prisma.vitalsReading.findMany({
            where: { patientId, recordedAt: { gte: from } },
            orderBy: { recordedAt: 'asc' },
        });
    },

    async getAdmissions(patientId: string) {
        return prisma.admission.findMany({
            where: { patientId },
            orderBy: { admittedAt: 'desc' },
            include: { clinicalData: true },
        });
    },

    async createAdmission(patientId: string, data: Prisma.AdmissionCreateInput) {
        const count = await prisma.admission.count();
        const admissionNumber = `ADM-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
        return prisma.admission.create({
            data: { ...data, admissionNumber, patient: { connect: { id: patientId } } } as Prisma.AdmissionCreateInput,
        });
    },

    async getTimeline(patientId: string) {
        const [admissions, predictions, alerts, vitalsAnomalies] = await Promise.all([
            prisma.admission.findMany({ where: { patientId }, orderBy: { admittedAt: 'desc' }, take: 20 }),
            prisma.mLPrediction.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, take: 10 }),
            prisma.alert.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, take: 20 }),
            prisma.vitalsReading.findMany({ where: { patientId, isAnomaly: true }, orderBy: { recordedAt: 'desc' }, take: 10 }),
        ]);
        return { admissions, predictions, alerts, vitalsAnomalies };
    },
};
