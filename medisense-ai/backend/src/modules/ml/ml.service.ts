import axios from 'axios';
import { env } from '../../config/env';
import { prisma } from '../../config/database';
import { cacheGet, cacheSet } from '../../config/redis';
import { AppError } from '../../utils/apiResponse';
import { emitRiskEscalation } from '../../config/socket';

const mlClient = axios.create({
    baseURL: env.ML_SERVICE_URL,
    timeout: 30000,
});

export const mlService = {
    async predictAll(patientId: string) {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                admissions: { orderBy: { admittedAt: 'desc' }, take: 1, include: { clinicalData: true } },
            },
        });
        if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

        const cacheKey = `ml:prediction:${patientId}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;

        const payload = buildPatientPayload(patient);
        const { data } = await mlClient.post('/api/predict/all', payload);
        const result = data.data || data;

        // Save prediction to DB
        const previousRisk = patient.currentRiskLevel;
        const prediction = await prisma.mLPrediction.create({
            data: {
                patientId,
                modelVersion: result.model_version || 'v1.0.0',
                predictedRiskLevel: result.risk_level as any,
                riskProbabilityHigh: result.risk_probability_high || 0,
                riskProbabilityMedium: result.risk_probability_medium || 0,
                riskProbabilityLow: result.risk_probability_low || 0,
                riskConfidence: result.risk_confidence || 0,
                readmissionRisk: result.readmission_risk || false,
                readmissionProbability: result.readmission_probability || 0,
                predictedLengthOfStay: result.predicted_los || 0,
                clusterLabel: result.cluster_label || 0,
                clusterName: result.cluster_name || 'Unknown',
                shapValues: result.shap_values || {},
                topRiskFactors: result.top_risk_factors || [],
            },
        });

        // Update patient risk level
        await prisma.patient.update({
            where: { id: patientId },
            data: {
                currentRiskLevel: result.risk_level as any,
                riskScore: result.risk_score || 0,
            },
        });

        // Emit if risk escalated
        if (result.risk_level !== previousRisk &&
            ['HIGH', 'CRITICAL'].includes(result.risk_level)) {
            emitRiskEscalation({
                patientId,
                patientName: `${patient.firstName} ${patient.lastName}`,
                previousRisk,
                newRisk: result.risk_level,
                timestamp: new Date(),
            });
        }

        await cacheSet(cacheKey, prediction, 3600);
        return prediction;
    },

    async getClusterResults() {
        const cacheKey = 'ml:cluster:results';
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;

        const { data } = await mlClient.get('/api/cluster/all');
        const result = data.data || data;
        await cacheSet(cacheKey, result, 3600);
        return result;
    },

    async getPatientCluster(patientId: string) {
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

        const payload = buildPatientPayload(patient);
        const { data } = await mlClient.post('/api/cluster/patient', payload);
        return data.data || data;
    },

    async generateRecommendations(patientId: string) {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: { admissions: { orderBy: { admittedAt: 'desc' }, take: 1, include: { clinicalData: true } } },
        });
        if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

        const payload = buildPatientPayload(patient);
        const { data } = await mlClient.post('/api/recommend', payload);
        const items = data.data || data;

        const recommendation = await prisma.careRecommendation.create({
            data: {
                patientId,
                validUntil: new Date(Date.now() + 7 * 24 * 3600000),
                items: {
                    create: items.map((item: any) => ({
                        category: item.category,
                        priority: item.priority,
                        title: item.title,
                        description: item.description,
                        actionableSteps: item.actionable_steps,
                        followUpInDays: item.follow_up_in_days,
                        specialistType: item.specialist_type,
                    })),
                },
            },
            include: { items: true },
        });
        return recommendation;
    },

    async getModelPerformance() {
        const cacheKey = 'ml:models:performance';
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;

        const { data } = await mlClient.get('/api/models/performance');
        const result = data.data || data;
        await cacheSet(cacheKey, result, 3600 * 6);
        return result;
    },

    async getSHAP(predictionId: string) {
        const prediction = await prisma.mLPrediction.findUnique({ where: { id: predictionId } });
        if (!prediction) throw new AppError('Prediction not found', 404, 'NOT_FOUND');
        return prediction.shapValues;
    },

    async triggerRetrain() {
        const { data } = await mlClient.post('/api/models/retrain');
        return data.data || data;
    },

    async getPredictionsForPatient(patientId: string) {
        return prisma.mLPrediction.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
        });
    },
};

function buildPatientPayload(patient: any) {
    const latestAdmission = patient.admissions?.[0];
    const clinical = latestAdmission?.clinicalData;

    const dob = new Date(patient.dateOfBirth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600000));

    return {
        patient_id: patient.id,
        age,
        gender: patient.gender,
        bmi: patient.bmi || 25,
        smoking_status: patient.smokingStatus,
        alcohol_use: patient.alcoholUse,
        physical_activity: patient.physicalActivity,
        has_diabetes: patient.hasDiabetes,
        has_hypertension: patient.hasHypertension,
        has_heart_disease: patient.hasHeartDisease,
        has_ckd: patient.hasCKD,
        has_asthma: patient.hasAsthma,
        has_copd: patient.hasCOPD,
        has_obesity: patient.hasObesity,
        has_cancer: patient.hasCancer,
        blood_sugar_fasting: clinical?.bloodSugarFasting || 95,
        cholesterol_total: clinical?.cholesterolTotal || 180,
        cholesterol_ldl: clinical?.cholesterolLDL || 100,
        cholesterol_hdl: clinical?.cholesterolHDL || 55,
        heart_rate_avg: clinical?.heartRateAvg || 72,
        bp_systolic: clinical?.bloodPressureSystolic || 120,
        bp_diastolic: clinical?.bloodPressureDiastolic || 80,
        oxygen_saturation: clinical?.oxygenSaturation || 98,
        temperature: clinical?.temperature || 37.0,
        hemoglobin: clinical?.hemoglobin || 14,
        creatinine: clinical?.creatinine || 1.0,
        hba1c: clinical?.hba1c || 5.5,
        ward_type: latestAdmission?.wardType || 'GENERAL',
        icu_admitted: latestAdmission?.icuAdmitted || false,
        previous_admissions: patient.admissions?.length || 0,
        risk_score: patient.riskScore || 0,
    };
}
