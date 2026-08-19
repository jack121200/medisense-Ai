import { prisma } from '../../config/database';
import axios from 'axios';
import { env } from '../../config/env';
import { cacheGet, cacheSet } from '../../config/redis';

const mlClient = axios.create({ baseURL: env.ML_SERVICE_URL, timeout: 30000 });

export const analyticsService = {
    async getDashboard() {
        const cacheKey = 'analytics:dashboard';
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            totalPatients, highRiskCount, criticalCount,
            admissionsToday, unresolvedAlerts,
            riskDistribution,
        ] = await Promise.all([
            prisma.patient.count({ where: { isActive: true, isSeeded: false } }),
            prisma.patient.count({ where: { isActive: true, isSeeded: false, currentRiskLevel: 'HIGH' } }),
            prisma.patient.count({ where: { isActive: true, isSeeded: false, currentRiskLevel: 'CRITICAL' } }),
            prisma.admission.count({ where: { admittedAt: { gte: today }, patient: { isSeeded: false } } }),
            prisma.alert.count({ where: { isResolved: false, patient: { isSeeded: false } } }),
            prisma.patient.groupBy({
                by: ['currentRiskLevel'],
                where: { isActive: true, isSeeded: false },
                _count: { _all: true },
            }),
        ]);

        const result = {
            totalPatients,
            highRiskCount, criticalCount,
            admissionsToday, unresolvedAlerts,
            riskDistribution: riskDistribution.map(r => ({
                level: r.currentRiskLevel, count: r._count._all,
            })),
        };

        await cacheSet(cacheKey, result, 300); // 5-minute cache
        return result;
    },

    async getAdmissionTrend(period: string = 'monthly') {
        const cacheKey = `analytics:admissions:${period}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;

        const months = 12;
        const trend: any[] = [];
        for (let i = months - 1; i >= 0; i--) {
            const start = new Date();
            start.setMonth(start.getMonth() - i, 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            const count = await prisma.admission.count({ where: { admittedAt: { gte: start, lt: end }, patient: { isSeeded: false } } });
            trend.push({
                period: start.toISOString().slice(0, 7),
                count,
            });
        }
        await cacheSet(cacheKey, trend, 3600);
        return trend;
    },

    async getWardOccupancy() {
        const wards = await prisma.admission.groupBy({
            by: ['wardType'],
            where: { dischargedAt: null, patient: { isSeeded: false } },
            _count: { _all: true },
        });
        const capacities: Record<string, number> = {
            GENERAL: 100, ICU: 20, CARDIAC: 30, ORTHOPEDIC: 40,
            ONCOLOGY: 25, NEUROLOGY: 30, PEDIATRIC: 35, MATERNITY: 25,
        };
        return wards.map(w => ({
            ward: w.wardType,
            occupied: w._count._all,
            capacity: capacities[w.wardType] || 30,
            occupancyRate: Math.round((w._count._all / (capacities[w.wardType] || 30)) * 100),
        }));
    },

    async getRiskDistributionOverTime() {
        // Group last 30 days by risk level
        const days = 30;
        const result: any[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            const dist = await prisma.mLPrediction.groupBy({
                by: ['predictedRiskLevel'],
                where: { createdAt: { gte: date, lt: nextDate } },
                _count: { _all: true },
            });
            const entry: any = { date: date.toISOString().slice(0, 10) };
            dist.forEach(d => { entry[d.predictedRiskLevel] = d._count._all; });
            result.push(entry);
        }
        return result;
    },

    async getEDAData() {
        const cacheKey = 'analytics:eda';
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;
        try {
            const { data } = await mlClient.get('/api/analytics/eda');
            const result = data.data || data;
            await cacheSet(cacheKey, result, 3600 * 6);
            return result;
        } catch { return { error: 'ML service unavailable' }; }
    },

    async getStatsSummary() {
        const cacheKey = 'analytics:stats';
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;
        try {
            const { data } = await mlClient.get('/api/analytics/stats');
            const result = data.data || data;
            await cacheSet(cacheKey, result, 3600 * 6);
            return result;
        } catch { return { error: 'ML service unavailable' }; }
    },

    async getHypothesisResults() {
        const cacheKey = 'analytics:hypothesis';
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;
        try {
            const { data } = await mlClient.get('/api/analytics/hypothesis');
            const result = data.data || data;
            await cacheSet(cacheKey, result, 3600 * 24);
            return result;
        } catch { return { error: 'ML service unavailable' }; }
    },

    async getBigDataReport() {
        const cacheKey = 'analytics:bigdata';
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;
        try {
            const { data } = await mlClient.get('/api/analytics/bigdata');
            const result = data.data || data;
            await cacheSet(cacheKey, result, 3600 * 12);
            return result;
        } catch { return { error: 'ML service unavailable' }; }
    },
};
