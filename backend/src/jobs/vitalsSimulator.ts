import { prisma } from '../config/database';
import { emitVitalsUpdate, emitNewAlert } from '../config/socket';
import { logger } from '../config/logger';

function randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

function simulateVital(base: number, variance: number): number {
    return parseFloat((base + (Math.random() - 0.5) * variance * 2).toFixed(1));
}

export async function startVitalsSimulator(): Promise<void> {
    logger.info('🔄 Starting real-time vitals simulator...');

    setInterval(async () => {
        try {
            // Get up to 20 active patients for live simulation
            const patients = await prisma.patient.findMany({
                where: { isActive: true },
                take: 20,
                orderBy: { updatedAt: 'desc' },
                select: { id: true, firstName: true, lastName: true, currentRiskLevel: true },
            });

            for (const patient of patients) {
                const isHighRisk = ['HIGH', 'CRITICAL'].includes(patient.currentRiskLevel);

                // High-risk patients have wider variance
                const vitals = {
                    heartRate: simulateVital(isHighRisk ? 95 : 72, isHighRisk ? 15 : 8),
                    oxygenSaturation: simulateVital(isHighRisk ? 93 : 98, isHighRisk ? 3 : 1),
                    systolicBP: simulateVital(isHighRisk ? 145 : 118, isHighRisk ? 20 : 10),
                    diastolicBP: simulateVital(isHighRisk ? 90 : 76, isHighRisk ? 12 : 6),
                    temperature: simulateVital(isHighRisk ? 37.8 : 36.9, isHighRisk ? 0.8 : 0.3),
                    timestamp: new Date(),
                };

                // Save to DB
                const isAnomaly =
                    vitals.heartRate > 100 || vitals.heartRate < 50 ||
                    vitals.oxygenSaturation < 92 ||
                    vitals.systolicBP > 160 ||
                    vitals.temperature > 38.5;

                await prisma.vitalsReading.create({
                    data: {
                        patientId: patient.id,
                        heartRate: vitals.heartRate,
                        oxygenSaturation: vitals.oxygenSaturation,
                        systolicBP: vitals.systolicBP,
                        diastolicBP: vitals.diastolicBP,
                        temperature: vitals.temperature,
                        source: 'SIMULATED',
                        isAnomaly,
                        anomalyType: isAnomaly ? 'SIMULATED_ANOMALY' : null,
                        alertTriggered: isAnomaly,
                    },
                });

                // Broadcast via Socket.IO
                emitVitalsUpdate(patient.id, vitals);

                // Emit alert for critical anomalies
                if (isAnomaly && isHighRisk && Math.random() < 0.3) {
                    emitNewAlert({
                        patientId: patient.id,
                        patientName: `${patient.firstName} ${patient.lastName}`,
                        type: 'VITALS_ANOMALY',
                        severity: 'CRITICAL',
                        message: `Critical vitals detected for ${patient.firstName} ${patient.lastName}`,
                        timestamp: new Date(),
                    });
                }
            }
        } catch (error) {
            logger.error('Vitals simulator error:', error);
        }
    }, 3000); // Every 3 seconds
}
