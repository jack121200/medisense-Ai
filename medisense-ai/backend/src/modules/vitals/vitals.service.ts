import { prisma } from '../../config/database';
import { emitVitalsUpdate, emitNewAlert, emitRiskEscalation } from '../../config/socket';
import { AppError } from '../../utils/apiResponse';
import { Prisma } from '@prisma/client';

const VITALS_THRESHOLDS = {
    heartRate: { criticalLow: 40, low: 50, high: 100, criticalHigh: 130 },
    oxygenSaturation: { criticalLow: 85, low: 92, high: 100, criticalHigh: 100 },
    systolicBP: { criticalLow: 70, low: 90, high: 140, criticalHigh: 180 },
    diastolicBP: { criticalLow: 40, low: 60, high: 90, criticalHigh: 120 },
    temperature: { criticalLow: 35.0, low: 36.0, high: 37.5, criticalHigh: 39.5 },
};

function checkAnomaly(vitals: {
    heartRate: number; oxygenSaturation: number;
    systolicBP: number; diastolicBP: number; temperature: number;
}): { isAnomaly: boolean; anomalyType: string | null; severity: string } {
    const checks = [
        { val: vitals.heartRate, th: VITALS_THRESHOLDS.heartRate, name: 'HEART_RATE' },
        { val: vitals.oxygenSaturation, th: VITALS_THRESHOLDS.oxygenSaturation, name: 'SPO2' },
        { val: vitals.systolicBP, th: VITALS_THRESHOLDS.systolicBP, name: 'BP_SYSTOLIC' },
        { val: vitals.temperature, th: VITALS_THRESHOLDS.temperature, name: 'TEMPERATURE' },
    ];

    let severity = 'NORMAL';
    let anomalyTypes: string[] = [];

    for (const { val, th, name } of checks) {
        if (val <= th.criticalLow || val >= th.criticalHigh) {
            anomalyTypes.push(`CRITICAL_${name}`);
            severity = 'CRITICAL';
        } else if (val <= th.low || val >= th.high) {
            anomalyTypes.push(name);
            if (severity !== 'CRITICAL') severity = 'WARNING';
        }
    }

    return {
        isAnomaly: anomalyTypes.length > 0,
        anomalyType: anomalyTypes.join(',') || null,
        severity,
    };
}

export const vitalsService = {
    async recordVitals(data: {
        patientId: string;
        heartRate: number;
        oxygenSaturation: number;
        systolicBP: number;
        diastolicBP: number;
        temperature: number;
        respiratoryRate?: number;
        glucoseLevel?: number;
        source?: string;
    }) {
        const patient = await prisma.patient.findUnique({
            where: { id: data.patientId },
            select: { id: true, firstName: true, lastName: true, currentRiskLevel: true },
        });
        if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

        const { isAnomaly, anomalyType, severity } = checkAnomaly(data);

        const reading = await prisma.vitalsReading.create({
            data: {
                patientId: data.patientId,
                heartRate: data.heartRate,
                oxygenSaturation: data.oxygenSaturation,
                systolicBP: data.systolicBP,
                diastolicBP: data.diastolicBP,
                temperature: data.temperature,
                respiratoryRate: data.respiratoryRate,
                glucoseLevel: data.glucoseLevel,
                source: (data.source as any) || 'MANUAL',
                isAnomaly,
                anomalyType,
                alertTriggered: isAnomaly,
            },
        });

        // Emit real-time update
        emitVitalsUpdate(data.patientId, {
            heartRate: data.heartRate,
            oxygenSaturation: data.oxygenSaturation,
            systolicBP: data.systolicBP,
            diastolicBP: data.diastolicBP,
            temperature: data.temperature,
            isAnomaly,
            timestamp: new Date(),
        });

        // Create alert if anomaly
        if (isAnomaly) {
            const alert = await prisma.alert.create({
                data: {
                    patientId: data.patientId,
                    type: 'VITALS_ANOMALY',
                    severity: severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
                    message: `Vitals anomaly detected: ${anomalyType}`,
                    details: { vitals: data, anomalyType, threshold: VITALS_THRESHOLDS },
                },
            });

            emitNewAlert({
                alertId: alert.id,
                patientId: data.patientId,
                patientName: `${patient.firstName} ${patient.lastName}`,
                type: 'VITALS_ANOMALY',
                severity: alert.severity,
                message: alert.message,
                timestamp: new Date(),
            });
        }

        return reading;
    },

    async getForPatient(patientId: string, params: { from?: string; to?: string; range?: string }) {
        const hours = params.range === '7d' ? 168 : params.range === '30d' ? 720 : params.range === '6h' ? 6 : 24;
        const from = params.from ? new Date(params.from) : new Date(Date.now() - hours * 3600000);
        const to = params.to ? new Date(params.to) : new Date();

        return prisma.vitalsReading.findMany({
            where: { patientId, recordedAt: { gte: from, lte: to } },
            orderBy: { recordedAt: 'asc' },
        });
    },

    async getLatest(patientId: string) {
        return prisma.vitalsReading.findFirst({
            where: { patientId },
            orderBy: { recordedAt: 'desc' },
        });
    },

    async getActiveAlerts() {
        return prisma.alert.findMany({
            where: { type: 'VITALS_ANOMALY', isResolved: false },
            include: { patient: { select: { firstName: true, lastName: true, patientCode: true } } },
            orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        });
    },

    async resolveAlert(alertId: string, resolvedBy: string) {
        return prisma.alert.update({
            where: { id: alertId },
            data: { isResolved: true, resolvedBy, resolvedAt: new Date() },
        });
    },
};
