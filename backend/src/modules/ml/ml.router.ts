import { Router } from 'express';
import { mlController } from './ml.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireOwnership } from '../../middleware/rbac.middleware';

const router = Router();

// All ML routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/ml/predict-disease
 * Body: { symptoms: string[] }
 * Proxies to: POST /api/medisense/predict-disease
 */
router.post('/predict-disease', mlController.predictDisease);

/**
 * POST /api/v1/ml/predict-risk
 * Body: { patientId, age, sex, chest_pain_type, resting_blood_pressure, cholestoral, ... }
 * Runs Heart Disease Risk Prediction + persists to ml_predictions DB table
 * Proxies to: POST /api/medisense/predict-risk
 */
router.post('/predict-risk', requireOwnership('patient'), mlController.predictRisk);

/**
 * GET /api/v1/ml/symptoms
 * Returns the symptom list for the frontend symptom picker
 */
router.get('/symptoms', mlController.getSymptoms);

/**
 * GET /api/v1/ml/model-status
 * Returns whether all ML models are trained and ready
 */
router.get('/model-status', mlController.getModelStatus);

/**
 * POST /api/v1/ml/cbc-analyze
 * Body: { labRequestId?, WBC, HGB, RBC, PLT, ... }
 * Analyze CBC blood values; optionally saves to lab_test_results
 * Proxies to: POST /api/cbc/analyze
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
 * POST /api/v1/ml/bayesian-infer
 * Run Bayesian Clinical Decision & Epistemic Uncertainty Engine
 */
router.post('/bayesian-infer', mlController.runBayesianInference);

/**
 * POST /api/v1/ml/fuzzy-dose
 * Run Mamdani Fuzzy Logic Controller for Drug Dosing & Triage
 */
router.post('/fuzzy-dose', mlController.runFuzzyDosing);

/**
 * POST /api/v1/ml/deep-stream
 * Run Deep LSTM Autoencoder & 1D-CNN Waveform Signal Analyzer
 */
router.post('/deep-stream', mlController.runDeepAnomalyStream);

/**
 * POST /api/v1/ml/lipid-analyze
 * Run Lipid Profile Multi-output Classifier
 */
router.post('/lipid-analyze', mlController.analyzeLipid);

/**
 * GET /api/v1/ml/predictions/:patientId
 * Returns all saved ML prediction history for a patient from the DB
 */
router.get('/predictions/:patientId', requireOwnership('patient'), mlController.getPatientPredictions);

/**
 * GET /api/v1/ml/shap/:predictionId
 * Returns SHAP values for a specific saved prediction
 */
router.get('/shap/:predictionId', requireOwnership('mlPrediction'), mlController.getSHAP);

export default router;
