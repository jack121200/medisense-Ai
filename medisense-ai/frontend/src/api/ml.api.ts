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

    // ── Model Status ───────────────────────────────────────────────────────────
    /** Check if all 3 ML models are trained and ready */
    modelStatus: () => api.get('/ml/model-status'),
};
