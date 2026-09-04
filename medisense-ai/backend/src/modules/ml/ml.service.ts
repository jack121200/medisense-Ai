import axios from 'axios';
import { env } from '../../config/env';
import { prisma } from '../../config/database';
import { cacheGet, cacheSet } from '../../config/redis';
import { AppError } from '../../utils/apiResponse';
import { emitRiskEscalation } from '../../config/socket';

const mlClient = axios.create({
    baseURL: env.ML_SERVICE_URL,
    timeout: 30000,
    // ml-service now rejects every request without this shared secret
    // (see ml-service/app/main.py internal_auth_middleware) — it's no
    // longer host-exposed, but this stops it trusting "reachable ==
    // allowed" for anything else that can still reach it on the internal
    // Docker network.
    headers: { 'X-Internal-Service-Key': env.ML_SERVICE_INTERNAL_KEY },
});

export const mlService = {
    /**
     * Run Heart Disease Risk Prediction without persisting to DB (standalone usage).
     * Calls: POST /api/medisense/predict-risk
     */
    async predictHeartRiskOnly(heartData: Record<string, any>) {
        const { data } = await mlClient.post('/api/medisense/predict-risk', heartData);
        return data.data || data;
    },

    /**
     * Run Heart Disease Risk Prediction and persist result to DB.
     * Calls: POST /api/medisense/predict-risk
     */
    async predictHeartRiskAndSave(patientId: string, heartData: Record<string, any>) {
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

        const { data } = await mlClient.post('/api/medisense/predict-risk', heartData);
        const result = data.data || data;

        const riskLevel = result.risk as 'LOW' | 'MEDIUM' | 'HIGH';
        const probability = (result.probability || 0) / 100;

        const previousRisk = patient.currentRiskLevel;

        // Persist prediction to DB
        const prediction = await prisma.mLPrediction.create({
            data: {
                patientId,
                modelVersion: 'XGBoost-v1.2',
                predictedRiskLevel: riskLevel,
                riskProbabilityHigh:   riskLevel === 'HIGH'   ? probability : (result.probability >= 65 ? probability : 0),
                riskProbabilityMedium: riskLevel === 'MEDIUM' ? probability : 0,
                riskProbabilityLow:    riskLevel === 'LOW'    ? probability : 0,
                riskConfidence: probability,
                readmissionRisk: riskLevel === 'HIGH',
                readmissionProbability: riskLevel === 'HIGH' ? probability * 0.6 : 0,
                predictedLengthOfStay: 0,
                clusterLabel: riskLevel === 'HIGH' ? 2 : riskLevel === 'MEDIUM' ? 1 : 0,
                clusterName: riskLevel === 'HIGH' ? 'High Risk' : riskLevel === 'MEDIUM' ? 'Moderate Risk' : 'Low Risk',
                shapValues: {},
                topRiskFactors: result.top_risk_factors || [],
            },
        });

        // Update patient risk level in DB
        await prisma.patient.update({
            where: { id: patientId },
            data: {
                currentRiskLevel: riskLevel,
                riskScore: result.probability || 0,
            },
        });

        // Emit real-time socket event if risk escalated
        if (riskLevel !== previousRisk && ['HIGH', 'CRITICAL'].includes(riskLevel)) {
            emitRiskEscalation({
                patientId,
                patientName: `${patient.firstName} ${patient.lastName}`,
                previousRisk,
                newRisk: riskLevel,
                timestamp: new Date(),
            });
        }

        return { ...result, dbPredictionId: prediction.id, savedAt: prediction.createdAt };
    },

    /**
     * Run AI Symptom Checker.
     * Calls: POST /api/medisense/predict-disease
     */
    async predictDisease(symptoms: string[]) {
        const { data } = await mlClient.post('/api/medisense/predict-disease', { symptoms });
        return data.data || data;
    },

    /**
     * Analyze CBC blood report and save result to lab_test_results if requestId provided.
     * Calls: POST /api/cbc/analyze
     */
    async analyzeCBC(cbcValues: Record<string, any>, labRequestId?: string) {
        const { data } = await mlClient.post('/api/cbc/analyze', cbcValues);
        const result = data.data || data;

        // Optionally persist AI analysis back to lab_test_results
        if (labRequestId) {
            await prisma.labTestResult.upsert({
                where: { requestId: labRequestId },
                update: { aiAnalysis: result as any },
                create: {
                    requestId: labRequestId,
                    rawValues: cbcValues as any,
                    aiAnalysis: result as any,
                },
            });
        }

        return result;
    },

    /**
     * Get CBC normal reference ranges.
     * Calls: GET /api/cbc/ranges
     */
    async getCBCRanges() {
        const cacheKey = 'ml:cbc:ranges';
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;
        const { data } = await mlClient.get('/api/cbc/ranges');
        const result = data.data || data;
        await cacheSet(cacheKey, result, 3600 * 24);
        return result;
    },

    /**
     * Get symptom list for AI Symptom Checker.
     * Calls: GET /api/medisense/symptoms
     */
    async getSymptoms() {
        const cacheKey = 'ml:symptoms:list';
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;
        const { data } = await mlClient.get('/api/medisense/symptoms');
        const result = data.data || data;
        await cacheSet(cacheKey, result, 3600 * 6);
        return result;
    },

    /**
     * Check model readiness status.
     * Calls: GET /api/medisense/model-status
     */
    async getModelStatus() {
        const { data } = await mlClient.get('/api/medisense/model-status');
        return data.data || data;
    },

    /**
     * Run Hypothesis Test.
     * Calls: GET /api/hypothesis/test?question=N
     */
    async runHypothesisTest(question: number) {
        if (question < 1 || question > 4) throw new AppError('question must be 1-4', 400, 'INVALID_INPUT');
        const { data } = await mlClient.get('/api/hypothesis/test', { params: { question } });
        return data;
    },

    /**
     * Get population-level stats for Research & Analytics.
     * Calls: GET /api/hypothesis/population-stats
     */
    async getPopulationStats() {
        const cacheKey = 'ml:population:stats';
        const cached = await cacheGet(cacheKey);
        if (cached) return cached;
        const { data } = await mlClient.get('/api/hypothesis/population-stats');
        await cacheSet(cacheKey, data, 3600);
        return data;
    },

    /**
     * Run Bayesian Clinical Decision & Uncertainty Engine
     * Calls: POST /api/bayesian/infer
     */
    async runBayesianInference(bayesianData: Record<string, any>) {
        const { data } = await mlClient.post('/api/bayesian/infer', bayesianData);
        return data.data || data;
    },

    /**
     * Run Mamdani Fuzzy Logic Controller for Drug Dosing & Triage
     * Calls: POST /api/fuzzy/dosage-triage
     */
    async runFuzzyDosing(fuzzyData: Record<string, any>) {
        const { data } = await mlClient.post('/api/fuzzy/dosage-triage', fuzzyData);
        return data.data || data;
    },

    /**
     * Run Deep LSTM Autoencoder Waveform Signal Analyzer
     * Calls: POST /api/deep/anomaly-stream
     */
    async runDeepAnomalyStream(signalData: Record<string, any>) {
        const { data } = await mlClient.post('/api/deep/anomaly-stream', signalData);
        return data.data || data;
    },

    /**
     * Analyze Lipid Profile values
     * Calls: POST /api/lipid/analyze
     */
    async analyzeLipid(lipidData: Record<string, any>) {
        const { data } = await mlClient.post('/api/lipid/analyze', lipidData);
        return data.data || data;
    },

    /**
     * Get prediction history for a patient.
     */
    async getPredictionsForPatient(patientId: string) {
        return prisma.mLPrediction.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
        });
    },

    /**
     * Get SHAP values for a specific prediction.
     */
    async getSHAP(predictionId: string) {
        const prediction = await prisma.mLPrediction.findUnique({ where: { id: predictionId } });
        if (!prediction) throw new AppError('Prediction not found', 404, 'NOT_FOUND');
        return prediction.shapValues;
    },

    /**
     * Proxies a PDF/DOCX upload to ml-service's OCR-style extraction
     * endpoints. Previously the frontend called ml-service directly on
     * localhost:8000; now that ml-service isn't host-exposed and requires
     * the internal service key (Phase 1.8), this is the only path in.
     * Uses global fetch/FormData (Node 20) instead of axios so we don't
     * need to add the `form-data` package just for this.
     */
    async proxyPdfExtract(kind: 'heart' | 'cbc' | 'symptoms' | 'lipid' | 'text', file: Express.Multer.File) {
        const formData = new FormData();
        formData.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);

        const res = await fetch(`${env.ML_SERVICE_URL}/api/pdf/extract-${kind}`, {
            method: 'POST',
            headers: { 'X-Internal-Service-Key': env.ML_SERVICE_INTERNAL_KEY },
            body: formData as any,
        });

        const data = await res.json();
        if (!res.ok) {
            throw new AppError((data as any)?.detail || 'PDF extraction failed', res.status, 'PDF_EXTRACT_FAILED');
        }
        return data;
    },
};
