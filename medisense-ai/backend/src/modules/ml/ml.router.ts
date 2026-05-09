import { Router } from 'express';
import { mlController } from './ml.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All ML routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/ml/predict-disease
 * Body: { symptoms: string[] }
 */
router.post('/predict-disease', mlController.predictDisease);

/**
 * POST /api/v1/ml/predict-risk
 * Body: { HighBP, HighChol, BMI, Smoker, Diabetes, Age, ... }
 */
router.post('/predict-risk', mlController.predictRisk);

/**
 * POST /api/v1/ml/analyze-report
 * Body: { age, gender, blood_type, condition }
 */
router.post('/analyze-report', mlController.analyzeReport);

/**
 * GET /api/v1/ml/symptoms
 * Returns the 134 symptom list for the frontend symptom picker
 */
router.get('/symptoms', mlController.getSymptoms);

/**
 * GET /api/v1/ml/model-status
 * Returns whether all 3 models are trained and ready
 */
router.get('/model-status', mlController.getModelStatus);

/**
 * POST /api/v1/ml/cbc-analyze
 * Analyze CBC blood values
 */
router.post('/cbc-analyze', mlController.analyzeCBC);

/**
 * GET /api/v1/ml/cbc-ranges
 * Get CBC normal reference ranges
 */
router.get('/cbc-ranges', mlController.getCBCRanges);

/**
 * GET /api/v1/ml/hypothesis-test?question=1-4
 * Run a pre-built statistical hypothesis test
 */
router.get('/hypothesis-test', mlController.runHypothesisTest);

/**
 * GET /api/v1/ml/population-stats
 * Get big data analytics / population risk stats
 */
router.get('/population-stats', mlController.getPopulationStats);

/**
 * POST /api/v1/ml/lipid-analyze
 * Analyze lipid profile values using the Lipid Profile ML model
 * Available for both PATIENT and DOCTOR roles
 */
router.post('/lipid-analyze', mlController.analyzeLipid);

export default router;
