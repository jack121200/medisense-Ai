import { Request, Response } from 'express';
import axios from 'axios';

// ML Service URL (internal Docker network)
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://ml-service:8000';

async function proxyToML(endpoint: string, data?: any) {
    const url = `${ML_SERVICE_URL}/api/medisense${endpoint}`;
    if (data) {
        const response = await axios.post(url, data, { timeout: 30000 });
        return response.data;
    } else {
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
    }
}

async function proxyToCBC(endpoint: string, data?: any) {
    const url = `${ML_SERVICE_URL}/api/cbc${endpoint}`;
    if (data) {
        const response = await axios.post(url, data, { timeout: 30000 });
        return response.data;
    } else {
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
    }
}

async function proxyToHypothesis(endpoint: string, params?: Record<string, any>) {
    const url = `${ML_SERVICE_URL}/api/hypothesis${endpoint}`;
    const response = await axios.get(url, { params, timeout: 15000 });
    return response.data;
}

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
            const result = await proxyToML('/predict-disease', { symptoms });
            res.json(result);
        } catch (err: any) {
            const status = err?.response?.status || 503;
            const msg = err?.response?.data?.detail || 'ML service unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * POST /api/v1/ml/predict-risk
     * Proxies to ml-service: POST /api/medisense/predict-risk
     */
    predictRisk: async (req: Request, res: Response) => {
        try {
            const result = await proxyToML('/predict-risk', req.body);
            res.json(result);
        } catch (err: any) {
            const status = err?.response?.status || 503;
            const msg = err?.response?.data?.detail || 'ML service unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * POST /api/v1/ml/analyze-report
     * Proxies to ml-service: POST /api/medisense/analyze-report
     */
    analyzeReport: async (req: Request, res: Response) => {
        try {
            const { age, gender, blood_type, condition } = req.body;
            if (!age || !gender || !blood_type || !condition) {
                res.status(400).json({ success: false, message: 'age, gender, blood_type, condition are required' });
                return;
            }
            const result = await proxyToML('/analyze-report', { age, gender, blood_type, condition });
            res.json(result);
        } catch (err: any) {
            const status = err?.response?.status || 503;
            const msg = err?.response?.data?.detail || 'ML service unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * GET /api/v1/ml/symptoms
     * Proxies to ml-service: GET /api/medisense/symptoms
     */
    getSymptoms: async (_req: Request, res: Response) => {
        try {
            const result = await proxyToML('/symptoms');
            res.json(result);
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
            const result = await proxyToML('/model-status');
            res.json(result);
        } catch (err: any) {
            res.status(503).json({ success: false, message: 'ML service unavailable' });
        }
    },

    /**
     * POST /api/v1/ml/cbc-analyze
     * Proxies to ml-service: POST /api/cbc/analyze
     */
    analyzeCBC: async (req: Request, res: Response) => {
        try {
            const result = await proxyToCBC('/analyze', req.body);
            res.json(result);
        } catch (err: any) {
            const status = err?.response?.status || 503;
            const msg = err?.response?.data?.detail || 'CBC analyzer unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * GET /api/v1/ml/cbc-ranges
     * Proxies to ml-service: GET /api/cbc/ranges
     */
    getCBCRanges: async (_req: Request, res: Response) => {
        try {
            const result = await proxyToCBC('/ranges');
            res.json(result);
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
            const result = await proxyToHypothesis('/test', { question });
            res.json(result);
        } catch (err: any) {
            const status = err?.response?.status || 503;
            const msg = err?.response?.data?.detail || 'Hypothesis service unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * GET /api/v1/ml/population-stats
     * Proxies to ml-service: GET /api/hypothesis/population-stats
     */
    getPopulationStats: async (_req: Request, res: Response) => {
        try {
            const result = await proxyToHypothesis('/population-stats');
            res.json(result);
        } catch (err: any) {
            const status = err?.response?.status || 503;
            const msg = err?.response?.data?.detail || 'Population stats unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },

    /**
     * POST /api/v1/ml/lipid-analyze
     * Proxies to ml-service: POST /api/lipid/analyze
     */
    analyzeLipid: async (req: Request, res: Response) => {
        try {
            const url = `${ML_SERVICE_URL}/api/lipid/analyze`;
            const response = await axios.post(url, req.body, { timeout: 30000 });
            res.json(response.data);
        } catch (err: any) {
            const status = err?.response?.status || 503;
            const msg = err?.response?.data?.detail || 'Lipid analyzer unavailable';
            res.status(status).json({ success: false, message: msg });
        }
    },
};
