"""
CBC Blood Analysis API Routes — MediSense AI
===============================================
POST /api/cbc/analyze       — analyze CBC values, return flagged results + AI interpretation
GET  /api/cbc/ranges        — return normal reference ranges for all parameters  
GET  /api/cbc/model-status  — check whether CBC models are trained and ready
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

router = APIRouter()

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


# ── CBC normal ranges (hardcoded as fallback if file missing) ─────────────────
FALLBACK_RANGES: Dict[str, Any] = {
    "WBC":   {"min": 4.0,   "max": 11.0,  "unit": "×10³/μL", "name": "White Blood Cells"},
    "LYMp":  {"min": 20.0,  "max": 40.0,  "unit": "%",       "name": "Lymphocyte %"},
    "MIDp":  {"min": 3.0,   "max": 9.0,   "unit": "%",       "name": "Mid-range Cells %"},
    "NEUTp": {"min": 50.0,  "max": 70.0,  "unit": "%",       "name": "Neutrophil %"},
    "LYMn":  {"min": 1.0,   "max": 3.0,   "unit": "×10³/μL", "name": "Lymphocyte Count"},
    "MIDn":  {"min": 0.1,   "max": 1.0,   "unit": "×10³/μL", "name": "Mid-range Count"},
    "NEUTn": {"min": 2.0,   "max": 7.5,   "unit": "×10³/μL", "name": "Neutrophil Count"},
    "RBC":   {"min": 4.5,   "max": 6.5,   "unit": "×10⁶/μL", "name": "Red Blood Cells"},
    "HGB":   {"min": 12.0,  "max": 17.5,  "unit": "g/dL",    "name": "Hemoglobin"},
    "HCT":   {"min": 37.0,  "max": 52.0,  "unit": "%",       "name": "Hematocrit"},
    "MCV":   {"min": 80.0,  "max": 100.0, "unit": "fL",      "name": "Mean Cell Volume"},
    "MCH":   {"min": 27.0,  "max": 33.0,  "unit": "pg",      "name": "Mean Cell Hemoglobin"},
    "MCHC":  {"min": 32.0,  "max": 36.0,  "unit": "g/dL",    "name": "MCHC"},
    "PLT":   {"min": 150.0, "max": 400.0, "unit": "×10³/μL", "name": "Platelets"},
    "MPV":   {"min": 7.5,   "max": 12.5,  "unit": "fL",      "name": "Mean Platelet Volume"},
}

# Fallback only for a model trained before the severity-based mapping fix —
# once train_cbc_model.py has been re-run, cluster_label_map from
# cbc_meta.json (computed from centroid severity, not a fixed ID) is used
# instead. See train_cbc_model.py for why hardcoding IDs here is wrong.
FALLBACK_CLUSTER_NAMES = {0: "Normal Pattern", 1: "Mild Concern", 2: "Abnormal Pattern"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class CBCRequest(BaseModel):
    WBC:   Optional[float] = Field(None, description="White Blood Cells ×10³/μL")
    LYMp:  Optional[float] = Field(None, description="Lymphocyte % ")
    MIDp:  Optional[float] = Field(None, description="Mid-range cells %")
    NEUTp: Optional[float] = Field(None, description="Neutrophil %")
    LYMn:  Optional[float] = Field(None, description="Lymphocyte count ×10³/μL")
    MIDn:  Optional[float] = Field(None, description="Mid-range count ×10³/μL")
    NEUTn: Optional[float] = Field(None, description="Neutrophil count ×10³/μL")
    RBC:   Optional[float] = Field(None, description="Red Blood Cells ×10⁶/μL")
    HGB:   Optional[float] = Field(None, description="Hemoglobin g/dL")
    HCT:   Optional[float] = Field(None, description="Hematocrit %")
    MCV:   Optional[float] = Field(None, description="Mean Cell Volume fL")
    MCH:   Optional[float] = Field(None, description="Mean Cell Hemoglobin pg")
    MCHC:  Optional[float] = Field(None, description="MCHC g/dL")
    PLT:   Optional[float] = Field(None, description="Platelets ×10³/μL")
    MPV:   Optional[float] = Field(None, description="Mean Platelet Volume fL")


def _rule_based_analysis(values: Dict[str, float]) -> Dict[str, Any]:
    """Apply reference range rules to each CBC parameter."""
    ranges = _load("cbc_ranges.json") or FALLBACK_RANGES
    findings: Dict[str, Any] = {}
    abnormal_count = 0

    for param, value in values.items():
        ref = ranges.get(param)
        if ref is None:
            continue
        if value > ref["max"]:
            status, flag, direction = "HIGH",   "🔴", "above"
            abnormal_count += 1
        elif value < ref["min"]:
            status, flag, direction = "LOW",    "🔵", "below"
            abnormal_count += 1
        else:
            status, flag, direction = "NORMAL", "🟢", "within"

        deviation_pct = None
        if status == "HIGH":
            deviation_pct = round((value - ref["max"]) / ref["max"] * 100, 1)
        elif status == "LOW":
            deviation_pct = round((ref["min"] - value) / ref["min"] * 100, 1)

        findings[param] = {
            "name":       ref["name"],
            "value":      value,
            "unit":       ref["unit"],
            "status":     status,
            "flag":       flag,
            "reference":  f"{ref['min']} – {ref['max']}",
            "deviation_pct": deviation_pct,
        }

    return findings, abnormal_count


def _auto_interpret(findings: Dict[str, Any], values: Dict[str, float]) -> List[str]:
    """Generate plain-English clinical interpretations from CBC findings."""
    msgs: List[str] = []

    hgb   = values.get("HGB")
    wbc   = values.get("WBC")
    plt   = values.get("PLT")
    neutp = values.get("NEUTp")
    lymp  = values.get("LYMp")
    mcv   = values.get("MCV")
    mchc  = values.get("MCHC")
    hct   = values.get("HCT")

    if hgb and findings.get("HGB", {}).get("status") == "LOW":
        if hgb < 8.0:
            msgs.append("Severe anemia detected — immediate medical review required")
        elif hgb < 11.0:
            msgs.append("Moderate anemia — hemoglobin significantly below normal range")
        else:
            msgs.append("Mild anemia — low hemoglobin, dietary or supplementation review advised")

    if wbc and findings.get("WBC", {}).get("status") == "HIGH":
        if wbc > 20.0:
            msgs.append("Markedly elevated WBC — possible severe infection, leukemia, or stress response")
        else:
            msgs.append("Elevated WBC — possible infection or inflammation, clinical correlation needed")

    if wbc and findings.get("WBC", {}).get("status") == "LOW":
        msgs.append("Low WBC (leukopenia) — immune suppression or bone marrow concern")

    if plt and findings.get("PLT", {}).get("status") == "LOW":
        if plt < 50:
            msgs.append("Critical thrombocytopenia — significant bleeding risk, urgent review")
        else:
            msgs.append("Low platelets — increased bleeding risk, further evaluation recommended")

    if plt and findings.get("PLT", {}).get("status") == "HIGH":
        msgs.append("Elevated platelets (thrombocytosis) — may indicate inflammation or clotting risk")

    if neutp and findings.get("NEUTp", {}).get("status") == "HIGH":
        msgs.append("High neutrophil % — suggests bacterial infection or acute inflammation")

    if lymp and findings.get("LYMp", {}).get("status") == "HIGH":
        msgs.append("High lymphocyte % — may indicate viral infection or lymphoproliferative disorder")

    if lymp and findings.get("LYMp", {}).get("status") == "LOW":
        msgs.append("Low lymphocytes — possible immune deficiency or recent steroid use")

    if mcv and findings.get("MCV", {}).get("status") == "LOW":
        msgs.append("Low MCV (microcytic) — suggests iron deficiency or thalassemia")

    if mcv and findings.get("MCV", {}).get("status") == "HIGH":
        msgs.append("High MCV (macrocytic) — suggests B12/folate deficiency or liver disease")

    if mchc and findings.get("MCHC", {}).get("status") == "LOW":
        msgs.append("Low MCHC — hypochromic anemia, often iron deficiency")

    if not msgs:
        msgs.append("All CBC parameters within normal reference ranges")

    return msgs


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/analyze", summary="Analyze CBC blood report values")
def analyze_cbc(req: CBCRequest):
    """
    Input  : CBC parameter values (any subset of 15 standard parameters)
    Output : Rule-based flagging (HIGH/LOW/NORMAL) + AI anomaly score +
             cluster assignment + clinical interpretation
    """
    values = {k: v for k, v in req.dict().items() if v is not None}
    if not values:
        raise HTTPException(status_code=422, detail="At least one CBC parameter must be provided")

    # ── Rule-based analysis ───────────────────────────────────────────────────
    findings, abnormal_count = _rule_based_analysis(values)

    # ── ML anomaly detection (if model present) ───────────────────────────────
    iso_model  = _load("cbc_anomaly_model.pkl")
    cbc_scaler = _load("cbc_scaler.pkl")
    features   = _load("cbc_features.json") or list(FALLBACK_RANGES.keys())

    anomaly_result: Dict[str, Any] = {"available": False}
    cluster_result: Dict[str, Any] = {"available": False}

    if iso_model and cbc_scaler:
        try:
            # ── Impute missing values using reference range midpoints ──────────────
            # Using 0.0 fallback causes Isolation Forest to flag every partial panel
            # as anomalous. Use midpoint of normal reference range instead.
            ranges = _load("cbc_ranges.json") or FALLBACK_RANGES
            imputed_values = {}
            for f in features:
                if f in values:
                    imputed_values[f] = values[f]
                elif f in ranges:
                    ref = ranges[f]
                    imputed_values[f] = round((ref["min"] + ref["max"]) / 2.0, 2)
                else:
                    imputed_values[f] = 0.0  # fallback only if no range defined

            X_raw    = np.array([[imputed_values.get(f, 0.0) for f in features]], dtype=float)
            X_scaled = cbc_scaler.transform(X_raw)
            raw_score     = float(iso_model.decision_function(X_scaled)[0])
            is_anomaly    = bool(iso_model.predict(X_scaled)[0] == -1)
            anomaly_result = {
                "available":   True,
                "is_anomaly":  is_anomaly,
                "score":       round(raw_score, 4),
                "flag":        "⚠️ Anomaly Detected" if is_anomaly else "✅ Within Normal Pattern",
            }
        except Exception:
            pass

    km_model = _load("cbc_cluster_model.pkl")
    if km_model and cbc_scaler:
        try:
            ranges = _load("cbc_ranges.json") or FALLBACK_RANGES
            imputed_values = {}
            for f in features:
                if f in values:
                    imputed_values[f] = values[f]
                elif f in ranges:
                    ref = ranges[f]
                    imputed_values[f] = round((ref["min"] + ref["max"]) / 2.0, 2)
                else:
                    imputed_values[f] = 0.0

            X_raw    = np.array([[imputed_values.get(f, 0.0) for f in features]], dtype=float)
            X_scaled = cbc_scaler.transform(X_raw)
            cluster_id   = int(km_model.predict(X_scaled)[0])
            cbc_meta     = _load("cbc_meta.json") or {}
            label_map    = cbc_meta.get("cluster_label_map")
            if label_map:
                cluster_name = label_map.get(str(cluster_id), f"Cluster {cluster_id}")
            else:
                cluster_name = FALLBACK_CLUSTER_NAMES.get(cluster_id, f"Cluster {cluster_id}")
            cluster_result = {
                "available":    True,
                "cluster_id":   cluster_id,
                "cluster_name": cluster_name,
            }
        except Exception:
            pass

    # ── Clinical interpretation ───────────────────────────────────────────────
    interpretations = _auto_interpret(findings, values)

    if abnormal_count == 0:
        overall_status, overall_color = "NORMAL",         "#00C851"
    elif abnormal_count <= 2:
        overall_status, overall_color = "MILD CONCERN",   "#FFD166"
    else:
        overall_status, overall_color = "REVIEW REQUIRED","#E63946"

    cardiac_note = ""
    hgb = values.get("HGB")
    plt_val = values.get("PLT")
    if hgb and hgb < 10.0:
        cardiac_note = "⚠️ Severe anemia can significantly worsen cardiac outcomes. Cardiology review advised."
    elif plt_val and plt_val > 600:
        cardiac_note = "⚠️ Elevated platelets increase thrombotic risk — relevant for cardiac patients."

    return {
        "success": True,
        "data": {
            "findings":          findings,
            "abnormal_count":    abnormal_count,
            "parameters_tested": len(findings),
            "overall_status":    overall_status,
            "overall_color":     overall_color,
            "interpretations":   interpretations,
            "cardiac_note":      cardiac_note,
            "anomaly_detection": anomaly_result,
            "cluster":           cluster_result,
        },
    }


@router.get("/ranges", summary="Get CBC normal reference ranges")
def get_ranges():
    ranges = _load("cbc_ranges.json") or FALLBACK_RANGES
    return {
        "success": True,
        "data": {
            "ranges": ranges,
            "count":  len(ranges),
            "note":   "Reference ranges for adult population (unisex). May vary by age and sex.",
        },
    }


@router.get("/model-status", summary="Check CBC model readiness")
def model_status():
    models = {
        "cbc_anomaly_model": (MODELS_DIR / "cbc_anomaly_model.pkl").exists(),
        "cbc_cluster_model": (MODELS_DIR / "cbc_cluster_model.pkl").exists(),
        "cbc_scaler":        (MODELS_DIR / "cbc_scaler.pkl").exists(),
        "cbc_ranges":        (MODELS_DIR / "cbc_ranges.json").exists(),
    }
    meta = _load("cbc_meta.json")
    return {
        "success": True,
        "data": {
            "models_ready": all(models.values()),
            "rule_engine":  True,  # always available (hardcoded ranges)
            "files":        models,
            "meta":         meta,
        },
    }
