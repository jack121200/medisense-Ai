import { Router } from 'express';
import { mlController } from './ml.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireOwnership, requireRole } from '../../middleware/rbac.middleware';
import { uploadPdfMemory } from '../../middleware/upload.middleware';

const router = Router();

// All ML routes require authentication
router.use(authenticate);

// A Bayesian risk network, a drug-dosing calculator and a single-beat ECG
// screen are inputs to a clinician's judgement, not results a patient can act
// on. The patient UI no longer offers them; this stops a direct API call from
// reaching them too.
const CLINICAL = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'] as const;
// Population-level research views (Research & Analytics).
const RESEARCH = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'ANALYST'] as const;

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
 * Analyze CBC blood values; lab/clinical staff may save the result to a lab request
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
router.get('/hypothesis-test', requireRole(...RESEARCH), mlController.runHypothesisTest);

/**
 * GET /api/v1/ml/population-stats
 * Get big data analytics / population risk stats
 */
router.get('/population-stats', requireRole(...RESEARCH), mlController.getPopulationStats);

/**
 * POST /api/v1/ml/bayesian-infer
 * Run Bayesian Clinical Decision & Epistemic Uncertainty Engine
 */
router.post('/bayesian-infer', requireRole(...CLINICAL), mlController.runBayesianInference);

/**
 * POST /api/v1/ml/fuzzy-dose
 * Run Mamdani Fuzzy Logic Controller for Drug Dosing & Triage
 */
router.post('/fuzzy-dose', requireRole(...CLINICAL), mlController.runFuzzyDosing);

/**
 * POST /api/v1/ml/deep-stream
 * ECG beat screening — supervised 1D-CNN verdict, autoencoder as a secondary signal
 */
router.post('/deep-stream', requireRole(...CLINICAL), mlController.runDeepAnomalyStream);

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

/**
 * POST /api/v1/ml/pdf-extract/:kind
 * Proxies a PDF/DOCX upload to ml-service (heart|cbc|symptoms|lipid|text).
 * Replaces the frontend's old direct call to localhost:8000, which broke
 * once ml-service stopped being host-exposed (Phase 1.8).
 */
router.post('/pdf-extract/:kind', uploadPdfMemory.single('file'), mlController.pdfExtract);

export default router;
