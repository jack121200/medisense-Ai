import { Request, Response } from 'express';
import { mlService } from './ml.service';
import { sendSuccess } from '../../utils/apiResponse';

export const mlController = {
    /**
     * POST /api/v1/ml/predict-disease
     * Proxies to ml-service: POST /api/medisense/predict-disease
     */
    predictDisease: async (req: Request, res: Response) => {
        try {
            const { symptoms } = req.body;
            if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
                res.status(400).json({ success: false, message: 'symptoms array is required' });
                return;
            }
            const result = await mlService.predictDisease(symptoms);
            sendSuccess(res, result);
        } catch (err: any) {
            const status = err?.response?.status || err?.statusCode || 503;
            const msg = err?.response?.data?.detail || err?.message || 'ML service unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * POST /api/v1/ml/predict-risk
     * Runs Heart Disease Risk Prediction AND saves to DB.
     * Proxies to ml-service: POST /api/medisense/predict-risk
     * Body: { patientId, ...heartFeatures }
     */
    predictRisk: async (req: Request, res: Response) => {
        try {
            const { patientId, ...heartData } = req.body;
            if (patientId) {
                const result = await mlService.predictHeartRiskAndSave(patientId, heartData);
                sendSuccess(res, result, 'Heart risk analysis complete and saved');
            } else {
                const result = await mlService.predictHeartRiskOnly(heartData);
                sendSuccess(res, result, 'Heart risk analysis complete');
            }
        } catch (err: any) {
            const status = err?.response?.status || err?.statusCode || 503;
            const msg = err?.response?.data?.detail || err?.message || 'ML service unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * GET /api/v1/ml/symptoms
     * Proxies to ml-service: GET /api/medisense/symptoms
     */
    getSymptoms: async (_req: Request, res: Response) => {
        try {
            const result = await mlService.getSymptoms();
            sendSuccess(res, result);
        } catch (err: any) {
            res.status(503).json({ success: false, message: 'ML service unavailable' });
        }
    },

    /**
     * GET /api/v1/ml/model-status
     * Proxies to ml-service: GET /api/medisense/model-status
     */
    getModelStatus: async (_req: Request, res: Response) => {
        try {
            const result = await mlService.getModelStatus();
            sendSuccess(res, result);
        } catch (err: any) {
            res.status(503).json({ success: false, message: 'ML service unavailable' });
        }
    },

    /**
     * POST /api/v1/ml/cbc-analyze
     * Analyzes CBC values and optionally persists to lab_test_results.
     * Proxies to ml-service: POST /api/cbc/analyze
     * Body: { labRequestId?, ...cbcValues }
     */
    analyzeCBC: async (req: Request, res: Response) => {
        try {
            const { labRequestId, ...cbcValues } = req.body;
            // Only lab and clinical staff may write the analysis into a lab
            // record. Anyone else — a patient checking their own report — gets
            // the analysis back unsaved, so a request ID in the body cannot
            // overwrite another patient's result.
            const role = (req as any).user?.role;
            const mayPersist = ['LAB_TECHNICIAN', 'DOCTOR', 'NURSE', 'ADMIN', 'SUPER_ADMIN'].includes(role);
            const result = await mlService.analyzeCBC(cbcValues, mayPersist ? labRequestId : undefined);
            sendSuccess(res, result);
        } catch (err: any) {
            const status = err?.response?.status || err?.statusCode || 503;
            const msg = err?.response?.data?.detail || err?.message || 'CBC analyzer unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * GET /api/v1/ml/cbc-ranges
     * Proxies to ml-service: GET /api/cbc/ranges
     */
    getCBCRanges: async (_req: Request, res: Response) => {
        try {
            const result = await mlService.getCBCRanges();
            sendSuccess(res, result);
        } catch (err: any) {
            res.status(503).json({ success: false, message: 'CBC service unavailable' });
        }
    },

    /**
     * GET /api/v1/ml/hypothesis-test?question=1-4
     * Proxies to ml-service: GET /api/hypothesis/test?question=N
     */
    runHypothesisTest: async (req: Request, res: Response) => {
        try {
            const question = parseInt(req.query.question as string);
            if (!question || question < 1 || question > 4) {
                res.status(400).json({ success: false, message: 'question param must be 1-4' });
                return;
            }
            const result = await mlService.runHypothesisTest(question);
            res.json(result);
        } catch (err: any) {
            const status = err?.response?.status || err?.statusCode || 503;
            const msg = err?.response?.data?.detail || err?.message || 'Hypothesis service unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * GET /api/v1/ml/population-stats
     * Proxies to ml-service: GET /api/hypothesis/population-stats
     */
    getPopulationStats: async (_req: Request, res: Response) => {
        try {
            const result = await mlService.getPopulationStats();
            res.json(result);
        } catch (err: any) {
            const status = err?.response?.status || err?.statusCode || 503;
            const msg = err?.response?.data?.detail || err?.message || 'Population stats unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * POST /api/v1/ml/bayesian-infer
     * Runs Bayesian Decision Network & Uncertainty Engine
     * Proxies to ml-service: POST /api/bayesian/infer
     */
    runBayesianInference: async (req: Request, res: Response) => {
        try {
            const result = await mlService.runBayesianInference(req.body);
            sendSuccess(res, result);
        } catch (err: any) {
            const status = err?.response?.status || err?.statusCode || 503;
            const msg = err?.response?.data?.detail || err?.message || 'Bayesian engine unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * POST /api/v1/ml/fuzzy-dose
     * Runs Mamdani Fuzzy Logic Controller for Drug Dosing & Triage
     * Proxies to ml-service: POST /api/fuzzy/dosage-triage
     */
    runFuzzyDosing: async (req: Request, res: Response) => {
        try {
            const result = await mlService.runFuzzyDosing(req.body);
            sendSuccess(res, result);
        } catch (err: any) {
            const status = err?.response?.status || err?.statusCode || 503;
            const msg = err?.response?.data?.detail || err?.message || 'Fuzzy dosing engine unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * POST /api/v1/ml/deep-stream
     * ECG beat screening — supervised 1D-CNN verdict, autoencoder as a secondary signal
     * Proxies to ml-service: POST /api/deep/anomaly-stream
     */
    runDeepAnomalyStream: async (req: Request, res: Response) => {
        try {
            const result = await mlService.runDeepAnomalyStream(req.body);
            sendSuccess(res, result);
        } catch (err: any) {
            const status = err?.response?.status || err?.statusCode || 503;
            const msg = err?.response?.data?.detail || err?.message || 'Deep waveform engine unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * POST /api/v1/ml/lipid-analyze
     * Analyzes Lipid Profile panel
     * Proxies to ml-service: POST /api/lipid/analyze
     */
    analyzeLipid: async (req: Request, res: Response) => {
        try {
            const result = await mlService.analyzeLipid(req.body);
            sendSuccess(res, result);
        } catch (err: any) {
            const status = err?.response?.status || err?.statusCode || 503;
            const msg = err?.response?.data?.detail || err?.message || 'Lipid analyzer unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * GET /api/v1/ml/predictions/:patientId
     * Returns all saved ML predictions for a patient from the DB.
     */
    getPatientPredictions: async (req: Request, res: Response) => {
        try {
            const result = await mlService.getPredictionsForPatient(req.params.patientId);
            sendSuccess(res, result);
        } catch (err: any) {
            res.status(500).json({ success: false, message: err?.message || 'Error fetching predictions' });
        }
    },

    /**
     * GET /api/v1/ml/shap/:predictionId
     * Returns SHAP values for a specific saved prediction.
     */
    getSHAP: async (req: Request, res: Response) => {
        try {
            const result = await mlService.getSHAP(req.params.predictionId);
            sendSuccess(res, result);
        } catch (err: any) {
            const status = err?.statusCode || 500;
            res.status(status).json({ success: false, message: err?.message });
        }
    },

    /**
     * POST /api/v1/ml/pdf-extract/:kind  (kind: heart|cbc|symptoms|lipid|text)
     * Proxies a PDF/DOCX upload to ml-service's extraction endpoints.
     */
    pdfExtract: async (req: Request, res: Response) => {
        try {
            const kind = req.params.kind as 'heart' | 'cbc' | 'symptoms' | 'lipid' | 'text';
            if (!['heart', 'cbc', 'symptoms', 'lipid', 'text'].includes(kind)) {
                res.status(400).json({ success: false, message: 'Invalid extraction kind' });
                return;
            }
            if (!req.file) {
                res.status(400).json({ success: false, message: 'file is required' });
                return;
            }
            const result = await mlService.proxyPdfExtract(kind, req.file);
            res.json(result);
        } catch (err: any) {
            const status = err?.statusCode || 503;
            res.status(status).json({ success: false, message: err?.message || 'PDF extraction unavailable' });
        }
    },
};
