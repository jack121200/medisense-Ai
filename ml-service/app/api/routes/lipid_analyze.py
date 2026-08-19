"""
Lipid Profile Analysis API Routes — MediSense AI
==================================================
POST /api/lipid/analyze       — Analyze lipid values via Random Forest model
GET  /api/lipid/model-status  — Check whether lipid model is ready
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

MODELS_DIR = Path(os.getenv("MODEL_PATH", str(Path(__file__).parent.parent.parent / "models")))
_cache: Dict[str, Any] = {}


def _load_lipid_model():
    if "lipid_model" not in _cache:
        path = MODELS_DIR / "lipid_model.pkl"
        import joblib
        if not path.exists():
            return None
        _cache["lipid_model"] = joblib.load(path)
    return _cache["lipid_model"]


# ── NLA-2014 Reference Ranges ─────────────────────────────────────────────────
def _classify_panel(
    tc: float, ldl: float, hdl: float, vldl: float, tg: float, non_hdl: float, gender: str
) -> Dict[str, Any]:
    """Classify each lipid value vs NLA-2014 reference ranges."""
    hdl_low_threshold = 40 if gender.upper() == "M" else 50

    def classify_tc(v):
        if v < 200: return "OPTIMAL"
        if v < 240: return "BORDERLINE"
        return "HIGH"

    def classify_ldl(v):
        if v < 100: return "OPTIMAL"
        if v < 130: return "NEAR OPTIMAL"
        if v < 160: return "BORDERLINE"
        if v < 190: return "HIGH"
        return "VERY HIGH"

    def classify_hdl(v, gender):
        threshold = hdl_low_threshold
        if v >= 60: return "PROTECTIVE"
        if v >= threshold: return "NORMAL"
        return "LOW"

    def classify_tg(v):
        if v < 150: return "NORMAL"
        if v < 200: return "BORDERLINE"
        if v < 500: return "HIGH"
        return "VERY HIGH"

    def classify_vldl(v):
        if v < 30: return "NORMAL"
        if v < 40: return "BORDERLINE"
        return "HIGH"

    def classify_non_hdl(v):
        if v < 130: return "OPTIMAL"
        if v < 160: return "NEAR OPTIMAL"
        if v < 190: return "BORDERLINE"
        return "HIGH"

    return {
        "total_cholesterol": {
            "value": tc, "status": classify_tc(tc),
            "reference": "< 200 mg/dL (Optimal)", "unit": "mg/dL"
        },
        "ldl": {
            "value": ldl, "status": classify_ldl(ldl),
            "reference": "< 100 mg/dL (Optimal)", "unit": "mg/dL"
        },
        "hdl": {
            "value": hdl, "status": classify_hdl(hdl, gender),
            "reference": f"> {hdl_low_threshold} mg/dL (Normal) / > 60 (Protective)", "unit": "mg/dL"
        },
        "triglycerides": {
            "value": tg, "status": classify_tg(tg),
            "reference": "< 150 mg/dL (Normal)", "unit": "mg/dL"
        },
        "vldl": {
            "value": vldl, "status": classify_vldl(vldl),
            "reference": "< 30 mg/dL (Normal)", "unit": "mg/dL"
        },
        "non_hdl": {
            "value": non_hdl, "status": classify_non_hdl(non_hdl),
            "reference": "< 130 mg/dL (Optimal)", "unit": "mg/dL"
        },
    }


def _nla_category(ldl: float) -> str:
    if ldl < 100: return "Optimal"
    if ldl < 130: return "Near Optimal"
    if ldl < 160: return "Borderline High"
    if ldl < 190: return "High"
    return "Very High"


def _red_flags(tc: float, ldl: float, hdl: float, tg: float, gender: str) -> List[str]:
    flags = []
    hdl_cutoff = 40 if gender.upper() == "M" else 50
    if tg > 500:
        flags.append("Critical hypertriglyceridemia (>500) — risk of acute pancreatitis")
    if ldl > 190:
        flags.append("Very high LDL (>190) — possible familial hypercholesterolemia, urgent evaluation")
    if hdl < 35:
        flags.append("Critically low HDL — severely elevated cardiovascular risk")
    if tc > 300:
        flags.append("Severely elevated total cholesterol (>300) — medical review required")
    return flags


def _clinical_message(risk: str, ldl: float, hdl: float, tg: float, has_dyslipidemia: bool) -> str:
    if risk == "LOW":
        return (
            "Your lipid profile is within an acceptable range. Continue a heart-healthy lifestyle "
            "with regular aerobic exercise, a balanced diet rich in fruits and vegetables, and routine monitoring."
        )
    elif risk == "MEDIUM":
        if tg > 200:
            return (
                "Your triglyceride levels are elevated, which increases your cardiovascular risk. "
                "Reducing refined carbohydrates, alcohol, and sugar intake can significantly help. "
                "Follow-up with your physician is recommended."
            )
        if ldl > 130:
            return (
                "Your LDL cholesterol is above the optimal range. Dietary changes including reduced "
                "saturated fat, increased fiber (oats, legumes), and regular exercise are advised. "
                "Consider follow-up lipid testing in 3–6 months."
            )
        return (
            "Your lipid profile shows moderate cardiovascular risk. Lifestyle modifications including "
            "dietary changes and regular exercise are strongly recommended. Please discuss with your physician."
        )
    else:  # HIGH
        if ldl > 160:
            return (
                "Your LDL cholesterol is in the high range, indicating significant cardiovascular risk. "
                "Statin therapy and aggressive lifestyle changes are typically recommended at this level. "
                "Please consult your cardiologist or primary care physician promptly."
            )
        return (
            "Your lipid profile indicates high cardiovascular risk. Immediate lifestyle intervention and "
            "medical evaluation are strongly recommended. Your physician may discuss medication options including "
            "statin therapy based on your complete risk profile."
        )


def _recommendations(risk: str, ldl: float, hdl: float, tg: float, bmi: Optional[float]) -> List[str]:
    recs = []
    if risk in ("MEDIUM", "HIGH"):
        recs.append("Follow a Mediterranean or DASH diet — rich in olive oil, fish, nuts, and legumes")
        recs.append("Perform at least 150 minutes of moderate-intensity aerobic exercise per week")
        recs.append("Reduce saturated and trans fat intake (red meat, fried foods, processed snacks)")
    if tg > 150:
        recs.append("Limit refined carbohydrates, sugary drinks, and alcohol to lower triglycerides")
    if hdl < 50:
        recs.append("Regular aerobic exercise and quitting smoking can help raise HDL cholesterol")
    if ldl > 130:
        recs.append("Increase soluble fiber intake (oats, barley, flaxseed, beans) to lower LDL")
    if bmi and bmi > 27:
        recs.append("Achieving a healthier weight (BMI 18.5–24.9) can significantly improve lipid values")
    if risk == "LOW" and not recs:
        recs = [
            "Maintain Mediterranean diet rich in fruits, vegetables, and whole grains",
            "Exercise 150 min/week at moderate intensity",
            "Avoid smoking and limit alcohol consumption",
            "Get a fasting lipid panel checked annually",
        ]
    return recs


# ── Schema ──────────────────────────────────────────────────────────────────────
class LipidRequest(BaseModel):
    total_cholesterol: float = Field(..., description="Total cholesterol mg/dL")
    ldl:               float = Field(..., description="LDL mg/dL")
    hdl:               float = Field(..., description="HDL mg/dL")
    vldl:              Optional[float] = Field(None, description="VLDL mg/dL (auto = TG/5)")
    triglycerides:     float = Field(..., description="Triglycerides mg/dL")
    non_hdl:           Optional[float] = Field(None, description="Non-HDL = TC - HDL (auto-computed)")
    age:               int   = Field(..., description="Patient age")
    gender:            str   = Field("M", description="M or F")
    bmi:               Optional[float] = Field(None, description="Body Mass Index (optional)")
    is_diabetic:       int   = Field(0, description="0 or 1")
    is_hypertensive:   int   = Field(0, description="0 or 1")
    is_smoker:         int   = Field(0, description="0 or 1")


# ── Endpoint ────────────────────────────────────────────────────────────────────
@router.post("/analyze", summary="Analyze Lipid Profile using Random Forest model")
def analyze_lipid(req: LipidRequest):
    """
    Input  : Lipid panel values + patient demographics
    Output : Risk category, dyslipidemia detection, statin recommendation,
             NLA-2014 panel classification, clinical ratios, and recommendations
    """
    # ── Auto-compute derived fields ───────────────────────────────────────────
    vldl    = req.vldl    if req.vldl    is not None else round(req.triglycerides / 5.0, 1)
    non_hdl = req.non_hdl if req.non_hdl is not None else round(req.total_cholesterol - req.hdl, 1)
    bmi     = req.bmi or 25.0  # default neutral BMI for model if not provided

    # ── Feature engineering ───────────────────────────────────────────────────
    tc_hdl_ratio      = round(req.total_cholesterol / req.hdl, 2) if req.hdl > 0 else 0
    ldl_hdl_ratio     = round(req.ldl / req.hdl, 2)               if req.hdl > 0 else 0
    tg_hdl_ratio      = round(req.triglycerides / req.hdl, 2)     if req.hdl > 0 else 0
    atherogenic_index = round(math.log10(req.triglycerides / req.hdl), 3) if req.hdl > 0 and req.triglycerides > 0 else 0.0

    feature_names = [
        'total_cholesterol', 'ldl', 'hdl', 'vldl', 'triglycerides', 'non_hdl',
        'age', 'bmi', 'is_diabetic', 'is_hypertensive', 'is_smoker',
        'tc_hdl_ratio', 'ldl_hdl_ratio', 'tg_hdl_ratio', 'atherogenic_index'
    ]
    X = np.array([[
        req.total_cholesterol, req.ldl, req.hdl, vldl, req.triglycerides, non_hdl,
        req.age, bmi, req.is_diabetic, req.is_hypertensive, req.is_smoker,
        tc_hdl_ratio, ldl_hdl_ratio, tg_hdl_ratio, atherogenic_index,
    ]], dtype=float)

    # ── ML predictions ────────────────────────────────────────────────────────
    models = _load_lipid_model()
    if models is None:
        raise HTTPException(503, detail="Lipid model not found. Run train/train_lipid_model.py first.")

    risk_model      = models["risk_category"]
    dyslip_model    = models["has_dyslipidemia"]
    metab_model     = models["has_metabolic_syndrome"]
    statin_model    = models["statin_intensity"]

    # Ensure correct feature order if model saved names
    risk_cat       = str(risk_model.predict(X)[0])
    risk_proba_arr = risk_model.predict_proba(X)[0]
    risk_classes   = risk_model.classes_
    risk_proba     = {str(c): round(float(p), 3) for c, p in zip(risk_classes, risk_proba_arr)}

    has_dyslipidemia      = bool(int(dyslip_model.predict(X)[0]) == 1)
    has_metabolic_syndrome = bool(int(metab_model.predict(X)[0]) == 1)
    statin_intensity      = str(statin_model.predict(X)[0])
    needs_statin          = statin_intensity != "NONE"

    # ── Panel analysis ────────────────────────────────────────────────────────
    panel = _classify_panel(
        req.total_cholesterol, req.ldl, req.hdl, vldl, req.triglycerides, non_hdl, req.gender
    )

    # ── Outputs ───────────────────────────────────────────────────────────────
    return {
        "success": True,
        "data": {
            "risk_category":    risk_cat,
            "risk_probability": risk_proba,
            "has_dyslipidemia":        has_dyslipidemia,
            "has_metabolic_syndrome":  has_metabolic_syndrome,
            "statin_recommendation": {
                "needs_statin": needs_statin,
                "intensity":    statin_intensity,
            },
            "panel_analysis": panel,
            "ratios": {
                "tc_hdl_ratio":      tc_hdl_ratio,
                "ldl_hdl_ratio":     ldl_hdl_ratio,
                "tg_hdl_ratio":      tg_hdl_ratio,
                "atherogenic_index": atherogenic_index,
            },
            "clinical_message": _clinical_message(
                risk_cat, req.ldl, req.hdl, req.triglycerides, has_dyslipidemia
            ),
            "recommendations": _recommendations(
                risk_cat, req.ldl, req.hdl, req.triglycerides, req.bmi
            ),
            "red_flags": _red_flags(
                req.total_cholesterol, req.ldl, req.hdl, req.triglycerides, req.gender
            ),
            "nla_category": _nla_category(req.ldl),
        }
    }


@router.get("/model-status", summary="Check Lipid model readiness")
def lipid_model_status():
    model_path = MODELS_DIR / "lipid_model.pkl"
    ready = model_path.exists()
    return {
        "success": True,
        "data": {
            "model_ready": ready,
            "model_file":  "lipid_model.pkl",
            "targets": ["risk_category", "has_dyslipidemia", "has_metabolic_syndrome", "statin_intensity"],
        }
    }
