"""
Lipid Profile Analysis API Routes — MediSense AI
==================================================
POST /api/lipid/analyze       — Analyze lipid values via a documented,
                                 guideline-based rule engine
GET  /api/lipid/model-status  — Always ready (no trained model to wait on)

This route previously wrapped 4 RandomForestClassifiers (risk_category,
has_dyslipidemia, has_metabolic_syndrome, statin_intensity) trained on
data/lipid_ml_dataset.csv. That dataset's labels turned out to be
deterministic rule-engine outputs computed from the exact same lipid
values used as the models' inputs (the same logic implemented directly in
_classify_panel below) — the "ML" was learning to reproduce a rule engine
that already existed in this file, not predicting anything from real
clinical outcomes. A search for a real dataset linking lipid panels to
diagnosed dyslipidemia/metabolic-syndrome/statin-therapy outcomes did not
turn up a usable public one, so rather than keep presenting a rule engine
as machine learning, this route is now an honest, fully rule-based
clinical classifier — same NLA-2014 panel logic as before, extended with
documented ATP III / ACC-AHA-derived rules for the four fields the old
"models" used to produce. See _rule_based_targets() below for exactly
which guideline each rule comes from and where an input this schema
doesn't collect (waist circumference, systolic BP value) is approximated.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


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


def _rule_based_targets(
    tc: float, ldl: float, hdl: float, tg: float, age: int, gender: str, bmi: float,
    is_diabetic: int, is_hypertensive: int, is_smoker: int,
) -> Dict[str, Any]:
    """
    Replaces the old 4 RandomForest outputs with documented guideline rules.

    has_dyslipidemia — ATP III composite definition: any single lipid
      parameter at or beyond a "high" cutoff (TC>=240, LDL>=160, TG>=200,
      or low HDL for sex).

    risk_category — a simple additive point score over the same panel
      categories plus conventional risk factors (diabetes/hypertension/
      smoking). This is a transparent composite screening score, NOT a
      validated event-risk calculator like ASCVD/Framingham/QRISK, which
      need inputs (systolic BP value, race, treatment status, etc.) this
      schema doesn't collect — it should not be presented to a clinician
      as equivalent to one.

    has_metabolic_syndrome — NCEP ATP III requires >=3 of 5 criteria.
      Two of the five (waist circumference, fasting glucose, blood
      pressure value) aren't in this request schema; BMI>30 is used as an
      approximation for central obesity, and the is_diabetic/is_hypertensive
      flags stand in for the glucose/BP criteria. This is a documented
      approximation, not the literal ATP III measurement set.

    statin_intensity — a simplified reading of the ACC/AHA 2018 statin
      benefit groups (LDL>=190 -> high-intensity; diabetic 40-75 with
      elevated risk -> moderate; etc.), not a substitute for calculating
      a real 10-year ASCVD risk score.
    """
    hdl_low = (gender.upper() == "M" and hdl < 40) or (gender.upper() != "M" and hdl < 50)

    has_dyslipidemia = tc >= 240 or ldl >= 160 or tg >= 200 or hdl_low

    score = 0
    if ldl >= 190: score += 3
    elif ldl >= 160: score += 2
    elif ldl >= 130: score += 1
    if tc >= 240: score += 1
    if tg >= 200: score += 1
    if hdl_low: score += 1
    score += int(bool(is_diabetic)) + int(bool(is_hypertensive)) + int(bool(is_smoker))

    if score >= 5:
        risk_category = "HIGH"
    elif score >= 2:
        risk_category = "MEDIUM"
    else:
        risk_category = "LOW"

    metsyn_criteria = sum([
        bmi > 30,                # proxy for elevated waist circumference
        tg >= 150,
        hdl_low,
        bool(is_hypertensive),   # proxy for elevated BP criterion
        bool(is_diabetic),       # proxy for elevated fasting glucose criterion
    ])
    has_metabolic_syndrome = metsyn_criteria >= 3

    if ldl >= 190:
        statin_intensity = "HIGH"
    elif bool(is_diabetic) and 40 <= age <= 75:
        statin_intensity = "MODERATE"
    elif risk_category == "HIGH":
        statin_intensity = "HIGH" if ldl >= 160 else "MODERATE"
    elif risk_category == "MEDIUM" and (has_dyslipidemia or bool(is_smoker)):
        statin_intensity = "LOW"
    else:
        statin_intensity = "NONE"

    # A rough class-probability-shaped output so the response contract stays
    # the same shape as before (frontend/backend expect a dict of {class: prob})
    # — derived from the same score, not a real model's predict_proba.
    risk_probability = {"LOW": 0.0, "MEDIUM": 0.0, "HIGH": 0.0}
    risk_probability[risk_category] = 1.0

    return {
        "risk_category": risk_category,
        "risk_probability": risk_probability,
        "has_dyslipidemia": has_dyslipidemia,
        "has_metabolic_syndrome": has_metabolic_syndrome,
        "statin_intensity": statin_intensity,
        "method": "rule-based (ATP III / ACC-AHA 2018 derived thresholds) — not a trained model",
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
@router.post("/analyze", summary="Analyze Lipid Profile via guideline-based rule engine")
def analyze_lipid(req: LipidRequest):
    """
    Input  : Lipid panel values + patient demographics
    Output : Risk category, dyslipidemia detection, statin recommendation,
             NLA-2014 panel classification, clinical ratios, and recommendations

    All outputs are computed by documented clinical-guideline thresholds
    (see _rule_based_targets and _classify_panel) — this endpoint does not
    use a trained model. See the module docstring for why.
    """
    # ── Auto-compute derived fields ───────────────────────────────────────────
    vldl    = req.vldl    if req.vldl    is not None else round(req.triglycerides / 5.0, 1)
    non_hdl = req.non_hdl if req.non_hdl is not None else round(req.total_cholesterol - req.hdl, 1)
    bmi     = req.bmi or 25.0  # neutral default when not provided

    # ── Derived ratios (clinically standard, shown to the user as-is) ────────
    tc_hdl_ratio      = round(req.total_cholesterol / req.hdl, 2) if req.hdl > 0 else 0
    ldl_hdl_ratio     = round(req.ldl / req.hdl, 2)               if req.hdl > 0 else 0
    tg_hdl_ratio      = round(req.triglycerides / req.hdl, 2)     if req.hdl > 0 else 0
    atherogenic_index = round(math.log10(req.triglycerides / req.hdl), 3) if req.hdl > 0 and req.triglycerides > 0 else 0.0

    # ── Rule-based classification (replaces the old circular ML models) ──────
    targets = _rule_based_targets(
        req.total_cholesterol, req.ldl, req.hdl, req.triglycerides,
        req.age, req.gender, bmi, req.is_diabetic, req.is_hypertensive, req.is_smoker,
    )
    risk_cat = targets["risk_category"]
    has_dyslipidemia = targets["has_dyslipidemia"]
    has_metabolic_syndrome = targets["has_metabolic_syndrome"]
    statin_intensity = targets["statin_intensity"]
    needs_statin = statin_intensity != "NONE"

    # ── Panel analysis ────────────────────────────────────────────────────────
    panel = _classify_panel(
        req.total_cholesterol, req.ldl, req.hdl, vldl, req.triglycerides, non_hdl, req.gender
    )

    # ── Outputs ───────────────────────────────────────────────────────────────
    return {
        "success": True,
        "data": {
            "risk_category":    risk_cat,
            "risk_probability": targets["risk_probability"],
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
            "method": targets["method"],
        }
    }


@router.get("/model-status", summary="Lipid analyzer readiness (rule-based — always ready)")
def lipid_model_status():
    return {
        "success": True,
        "data": {
            "model_ready": True,
            "method": "rule-based (ATP III / ACC-AHA 2018 derived thresholds), no trained model file",
            "targets": ["risk_category", "has_dyslipidemia", "has_metabolic_syndrome", "statin_intensity"],
        }
    }
