import api from './axiosInstance';

export const mlApi = {
    // ── AI Symptom Checker ─────────────────────────────────────────────────────
    /** Predict disease/condition from selected symptom names */
    predictDisease: (symptoms: string[]) =>
        api.post('/ml/predict-disease', { symptoms }),

    /** 134 symptom column names for the symptom picker */
    getSymptoms: () => api.get('/ml/symptoms'),

    // ── Heart Disease Risk AI (14 cardiac features) ────────────────────────────
    /** Predict heart disease risk — uses HeartDiseaseTrain-Test.csv model */
    predictHeartRisk: (data: {
        age: number;
        sex: string;
        chest_pain_type: string;
        resting_blood_pressure: number;
        cholestoral: number;
        fasting_blood_sugar: string;
        rest_ecg: string;
        Max_heart_rate: number;
        exercise_induced_angina: string;
        oldpeak: number;
        slope: string;
        vessels_colored_by_flourosopy: string;
        thalassemia: string;
    }) => api.post('/ml/predict-risk', data),

    // ── CBC Blood Analyzer ─────────────────────────────────────────────────────
    /** Analyze CBC values — rule-based + Isolation Forest anomaly detection */
    analyzeCBC: (values: Partial<{
        WBC: number; LYMp: number; MIDp: number; NEUTp: number;
        LYMn: number; MIDn: number; NEUTn: number;
        RBC: number; HGB: number; HCT: number;
        MCV: number; MCH: number; MCHC: number;
        PLT: number; MPV: number;
    }>) => api.post('/ml/cbc-analyze', values),

    /** Get CBC normal reference ranges */
    getCBCRanges: () => api.get('/ml/cbc-ranges'),

    // ── Lipid Profile Analyzer ─────────────────────────────────────────────────
    /** Analyze lipid profile values — Random Forest multi-output classifier */
    analyzeLipid: (data: {
        total_cholesterol: number;
        ldl: number;
        hdl: number;
        vldl?: number | null;
        triglycerides: number;
        non_hdl?: number | null;
        age: number;
        gender: string;
        bmi?: number | null;
        is_diabetic: number;
        is_hypertensive: number;
        is_smoker: number;
    }) => api.post('/ml/lipid-analyze', data),

    // ── Bayesian Clinical Decision & Uncertainty Engine ────────────────────────
    /** Run Bayesian Inference (Posterior Prob, Epistemic Uncertainty & Value of Information VOI) */
    runBayesianInference: (data: {
        age: number;
        resting_blood_pressure: number;
        cholestoral: number;
        fasting_blood_sugar: number;
        chest_pain_present?: boolean;
        ecg_abnormal?: boolean;
        known_tests_completed?: string[];
    }) => api.post('/ml/bayesian-infer', data),

    // ── Mamdani Fuzzy Logic Dosing & Triage ────────────────────────────────────
    /** Run Mamdani FIS Drug Dosing & Triage Controller */
    runFuzzyDosing: (data: {
        systolic_bp: number;
        serum_creatinine: number;
        age: number;
        drug_name: string;
    }) => api.post('/ml/fuzzy-dose', data),

    // ── ECG Beat Screening ─────────────────────────────────────────────────────
    /** Screen one ECG beat: supervised 1D-CNN verdict, autoencoder as a secondary signal */
    runDeepAnomalyStream: (data: {
        signal_waveform?: number[];
        sample_rate_hz?: number;
        trigger_anomaly?: boolean;
    }) => api.post('/ml/deep-stream', data),

    // ── Model Status ───────────────────────────────────────────────────────────
    /** Check if all ML models are trained and ready */
    modelStatus: () => api.get('/ml/model-status'),
};
