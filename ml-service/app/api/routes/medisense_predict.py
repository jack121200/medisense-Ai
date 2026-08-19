"""
CardioSense AI — Core ML Prediction Endpoints
==============================================
POST /api/medisense/predict-disease  — symptom list → disease + alternatives
POST /api/medisense/predict-risk     — 14 cardiac features → heart risk (LOW/MEDIUM/HIGH)
GET  /api/medisense/symptoms         — cardiac symptom list for frontend
GET  /api/medisense/model-status     — readiness check for both models
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import joblib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router  = APIRouter()
MODELS_DIR = Path(__file__).parent.parent.parent / "models"
_cache: Dict[str, Any] = {}


def _load(name: str):
    if name not in _cache:
        path = MODELS_DIR / name
        if not path.exists():
            return None
        if name.endswith(".json"):
            with open(path) as f:
                _cache[name] = json.load(f)
        else:
            _cache[name] = joblib.load(path)
    return _cache[name]


# ══════════════════════════════════════════════════════════════════
#  SCHEMAS
# ══════════════════════════════════════════════════════════════════

class DiseaseRequest(BaseModel):
    symptoms: List[str] = Field(
        ...,
        description="List of symptom names exactly as in symptom_columns.json",
        example=["chest_pain", "shortness_of_breath", "fatigue"]
    )


class HeartRiskRequest(BaseModel):
    """14-feature cardiac risk model (HeartDiseaseTrain-Test.csv)."""
    age:                           float = Field(..., description="Age in years")
    sex:                           str   = Field(..., description="Male / Female")
    chest_pain_type:               str   = Field(..., description="Typical angina / Atypical angina / Non-anginal pain / Asymptomatic")
    resting_blood_pressure:        float = Field(..., description="Resting BP in mmHg")
    cholestoral:                   float = Field(..., description="Cholesterol in mg/dL")
    fasting_blood_sugar:           str   = Field(..., description="Greater than 120 mg/dl / Lower than 120 mg/dl")
    rest_ecg:                      str   = Field(..., description="Normal / ST-T wave abnormality / Left ventricular hypertrophy")
    Max_heart_rate:                float = Field(..., description="Maximum heart rate achieved")
    exercise_induced_angina:       str   = Field(..., description="Yes / No")
    oldpeak:                       float = Field(..., description="ST depression induced by exercise")
    slope:                         str   = Field(..., description="Upsloping / Flat / Downsloping")
    vessels_colored_by_flourosopy: str   = Field(..., description="Zero / One / Two / Three")
    thalassemia:                   str   = Field(..., description="Normal / Fixed Defect / Reversable Defect")


# ══════════════════════════════════════════════════════════════════
#  AI SYMPTOM CHECKER
# ══════════════════════════════════════════════════════════════════

@router.get("/symptoms", summary="Get symptom list for AI Symptom Checker")
def get_symptoms():
    """Returns the symptom column names used for disease prediction."""
    symptoms = _load("symptom_columns.json")
    if not symptoms:
        raise HTTPException(503, "Symptom list not available — run train_disease_model.py first")
    diseases = _load("disease_list.json") or []
    return {
        "success": True,
        "data": {
            "symptoms": symptoms,
            "diseases": diseases,
            "count":    len(symptoms),
        },
    }


@router.post("/predict-disease", summary="AI Symptom Checker — predict disease from symptoms")
def predict_disease(req: DiseaseRequest):
    """
    Input  : list of symptom names (strings from /symptoms endpoint)
    Output : predicted disease + top 5 alternatives with confidence %
    """
    model   = _load("disease_model.pkl")
    columns = _load("symptom_columns.json")

    if model is None or columns is None:
        raise HTTPException(
            503,
            "AI Symptom model not trained — run train/train_disease_model.py first"
        )

    vec = [0] * len(columns)
    unrecognized = []
    for sym in req.symptoms:
        sym_clean = sym.strip().lower().replace(" ", "_")
        if sym_clean in columns:
            vec[columns.index(sym_clean)] = 1
        else:
            unrecognized.append(sym)

    X            = np.array([vec])
    prediction   = model.predict(X)[0]
    probabilities = model.predict_proba(X)[0]
    classes       = model.classes_

    top_indices   = np.argsort(probabilities)[::-1][:5]
    alternatives  = [
        {"disease": str(classes[i]), "confidence": round(float(probabilities[i]) * 100, 1)}
        for i in top_indices
    ]

    return {
        "success": True,
        "data": {
            "disease":       prediction,
            "confidence":    round(float(probabilities[top_indices[0]]) * 100, 1),
            "alternatives":  alternatives,
            "symptoms_used": [s for s in req.symptoms if s.lower().replace(" ", "_") in columns],
            "unrecognized":  unrecognized,
        },
    }


# ══════════════════════════════════════════════════════════════════
#  HEART DISEASE RISK PREDICTION (trained on HeartDiseaseTrain-Test.csv)
# ══════════════════════════════════════════════════════════════════

CAT_COLS = [
    "sex", "chest_pain_type", "fasting_blood_sugar", "rest_ecg",
    "exercise_induced_angina", "slope", "vessels_colored_by_flourosopy", "thalassemia",
]
NUM_COLS = ["age", "resting_blood_pressure", "cholestoral", "Max_heart_rate", "oldpeak"]


@router.post("/predict-risk", summary="Heart Disease Risk Prediction (14 cardiac features)")
def predict_heart_risk(req: HeartRiskRequest):
    """
    Input  : 14 cardiac clinical features
    Output : risk level (LOW / MEDIUM / HIGH) + probability + top risk factors + recommendations
    """
    model    = _load("heart_risk_model.pkl")
    scaler   = _load("heart_scaler.pkl")
    encoders = _load("heart_encoder.pkl")
    features = _load("heart_features.json")

    if model is None or scaler is None or encoders is None or features is None:
        raise HTTPException(
            503,
            "Heart risk model not trained — run train/train_heart_risk.py first"
        )

    req_dict = req.dict()

    # Build raw feature array in training order
    row = {}
    for col in features:
        val = req_dict.get(col, 0)
        if col in CAT_COLS:
            le = encoders.get(col)
            if le:
                try:
                    val = int(le.transform([str(val)])[0])
                except ValueError:
                    val = 0
            else:
                val = 0
        row[col] = float(val)

    X_raw = np.array([[row[f] for f in features]], dtype=float)

    # Scale numerical columns only (scaler was fit on those)
    num_indices = [features.index(c) for c in NUM_COLS if c in features]
    X_scaled    = X_raw.copy()
    if num_indices:
        X_scaled[:, num_indices] = scaler.transform(X_raw[:, num_indices])

    raw_probability = float(model.predict_proba(X_scaled)[0][1])

    # Docx Section 8: Use 0.38 threshold (lean toward sensitivity — missing high-risk is worse than false alarm)
    # Risk buckets: 0–35% = LOW | 35–65% = MEDIUM | 65%+ = HIGH
    probability = raw_probability  # percentage display uses raw prob * 100

    if raw_probability >= 0.65:
        level, color, message = "HIGH",   "#E63946", "Immediate cardiology evaluation strongly recommended. High probability of cardiac disease detected."
    elif raw_probability >= 0.38:
        level, color, message = "MEDIUM", "#FFD166", "Elevated cardiac risk — further diagnostic tests advised (ECG, stress test, echocardiography)."
    else:
        level, color, message = "LOW",    "#06D6A0", "Low cardiac risk profile. Maintain heart-healthy lifestyle and regular check-ups."

    # Personalized cardiac recommendations
    recommendations: List[str] = []
    if req.resting_blood_pressure > 140:
        recommendations.append("Blood pressure elevated — target <130/80 mmHg with lifestyle + medication")
    if req.cholestoral > 240:
        recommendations.append("High cholesterol — consider statin therapy and dietary fat reduction")
    if req.fasting_blood_sugar in ("Greater than 120 mg/dl", "1"):
        recommendations.append("Elevated fasting blood sugar — strict glycaemic control protects the heart")
    if req.exercise_induced_angina in ("Yes", "1", 1):
        recommendations.append("Exercise-induced angina present — avoid strenuous activity until evaluated")
    if req.oldpeak > 2.0:
        recommendations.append("Significant ST depression — suggests myocardial ischemia, urgent review")
    if req.thalassemia in ("Reversable Defect", "2"):
        recommendations.append("Reversible thalassemia defect — indicates cardiac perfusion abnormality")
    if req.chest_pain_type == "Typical angina":
        recommendations.append("Typical anginal pain pattern — high specificity for coronary artery disease")
    if not recommendations:
        recommendations.append("Continue heart-healthy lifestyle: exercise, balanced diet, no smoking")

    # Feature importance if available
    top_factors: List[str] = []
    if hasattr(model, "feature_importances_"):
        fi    = model.feature_importances_
        pairs = sorted(zip(features, fi), key=lambda x: x[1], reverse=True)[:4]
        top_factors = [f[0].replace("_", " ").title() for f in pairs]

    return {
        "success": True,
        "data": {
            "risk":            level,
            "probability":     round(probability * 100, 1),
            "color":           color,
            "message":         message,
            # has_disease aligns with sensitivity threshold 0.38 (not default 0.50)
            # so MEDIUM risk patients (≥38%) are also flagged as having cardiac concern
            "has_disease":     bool(raw_probability >= 0.38),
            "top_risk_factors": top_factors,
            "recommendations": recommendations,
        },
    }


# ══════════════════════════════════════════════════════════════════
#  MODEL STATUS
# ══════════════════════════════════════════════════════════════════

@router.get("/model-status", summary="Check training status of all CardioSense ML models")
def model_status():
    models_info = {
        "disease_model": {
            "ready": (MODELS_DIR / "disease_model.pkl").exists(),
            "meta":  _load("disease_model_meta.json"),
            "description": "AI Symptom Checker — Random Forest on 134 symptoms",
        },
        "heart_risk_model": {
            "ready": (MODELS_DIR / "heart_risk_model.pkl").exists(),
            "meta":  _load("heart_risk_meta.json"),
            "description": "Heart Disease Risk — trained on HeartDiseaseTrain-Test.csv",
        },
        "cbc_anomaly_model": {
            "ready": (MODELS_DIR / "cbc_anomaly_model.pkl").exists(),
            "meta":  _load("cbc_meta.json"),
            "description": "CBC Blood Analyzer — Isolation Forest + KMeans",
        },
    }
    all_ready = all(m["ready"] for m in models_info.values())
    return {
        "success": True,
        "data": {
            "all_ready": all_ready,
            "models":    models_info,
        },
    }
