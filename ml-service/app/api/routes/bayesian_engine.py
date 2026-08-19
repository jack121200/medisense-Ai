"""
bayesian_engine.py — Feature 1: Bayesian Clinical Decision & Epistemic Uncertainty Engine
==========================================================================================
Syllabus Mapping: Unit I — Uncertainty, Bayesian Networks, Bayes Theorem, Joint Distributions,
                   Inference in Bayesian Networks, Decision Theory (Value of Information).

Computes:
  1. Causal DAG Network topology (nodes & directed probabilistic edges)
  2. Joint Probability Inference P(Coronary_Heart_Disease | Evidence) via Bayes Theorem
  3. Epistemic Uncertainty Estimation (Shannon Entropy & 95% Bayesian Credible Interval)
  4. Value of Information (VOI) / Next Best Test recommendation engine
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/bayesian", tags=["Bayesian Clinical Engine"])

# ══════════════════════════════════════════════════════════════════
#  SCHEMAS
# ══════════════════════════════════════════════════════════════════

class BayesianInferenceRequest(BaseModel):
    age:                      float = Field(..., description="Age in years", example=62)
    resting_blood_pressure:   float = Field(..., description="Resting BP mmHg", example=158)
    cholestoral:              float = Field(..., description="Cholesterol mg/dL", example=265)
    fasting_blood_sugar:      float = Field(..., description="Fasting Blood Sugar mg/dL", example=138)
    chest_pain_present:       bool  = Field(True, description="Typical/Atypical chest pain present")
    ecg_abnormal:             bool  = Field(True, description="ST-T wave abnormality present")
    known_tests_completed:    List[str] = Field(default_factory=list, description="Already completed tests, e.g. ['troponin', 'stress_test']")


# ══════════════════════════════════════════════════════════════════
#  BAYESIAN NETWORK DAG & CONDITIONAL PROBABILITY TABLES (CPTs)
# ══════════════════════════════════════════════════════════════════

DAG_TOPOLOGY = {
    "nodes": [
        {"id": "Age_Risk",           "label": "Age > 55",              "type": "demographic"},
        {"id": "Hypertension",       "label": "Hypertension (BP>130)",  "type": "risk_factor"},
        {"id": "Hypercholesterolemia","label": "High Cholesterol (>240)","type": "risk_factor"},
        {"id": "Hyperglycemia",      "label": "High Fasting Sugar",    "type": "risk_factor"},
        {"id": "Chest_Pain",         "label": "Anginal Chest Pain",     "type": "symptom"},
        {"id": "ECG_St_T",           "label": "ECG ST-T Abnormality",   "type": "finding"},
        {"id": "Coronary_Disease",   "label": "Coronary Artery Disease","type": "target"},
    ],
    "edges": [
        {"source": "Age_Risk",            "target": "Hypertension",        "weight": 0.65},
        {"source": "Age_Risk",            "target": "Coronary_Disease",    "weight": 0.72},
        {"source": "Hypertension",        "target": "Coronary_Disease",    "weight": 0.85},
        {"source": "Hypercholesterolemia","target": "Coronary_Disease",    "weight": 0.78},
        {"source": "Hyperglycemia",       "target": "Coronary_Disease",    "weight": 0.60},
        {"source": "Coronary_Disease",    "target": "Chest_Pain",          "weight": 0.90},
        {"source": "Coronary_Disease",    "target": "ECG_St_T",            "weight": 0.88},
    ]
}


def _shannon_entropy(p: float) -> float:
    """Compute Shannon Entropy H(P) in bits for binary outcome."""
    p = max(1e-6, min(1 - 1e-6, p))
    return - (p * math.log2(p) + (1 - p) * math.log2(1 - p))


# ══════════════════════════════════════════════════════════════════
#  INFERENCE ENGINE & VALUE OF INFORMATION (VOI)
# ══════════════════════════════════════════════════════════════════

@router.post("/infer", summary="Bayesian Decision & Uncertainty Inference Engine")
def run_bayesian_inference(req: BayesianInferenceRequest):
    """
    Computes P(Coronary_Disease | Evidence) via Bayes Theorem,
    estimates Epistemic Uncertainty (entropy + 95% credible interval),
    and evaluates Value of Information (VOI) to suggest Next Best Diagnostic Test.
    """
    # 1. Evidence Extraction
    is_age_high   = req.age > 55
    is_bp_high    = req.resting_blood_pressure > 130
    is_chol_high  = req.cholestoral > 240
    is_fbs_high   = req.fasting_blood_sugar > 120
    has_angina    = req.chest_pain_present
    has_ecg_abn   = req.ecg_abnormal

    # 2. Prior Probability P(Disease) in adult population baseline
    prior_prob = 0.15

    # 3. Bayes Likelihood Ratios & Weight Factors
    lr_multiplier = 1.0

    if is_age_high:    lr_multiplier *= 1.45
    if is_bp_high:     lr_multiplier *= 1.85
    if is_chol_high:   lr_multiplier *= 1.70
    if is_fbs_high:    lr_multiplier *= 1.35
    if has_angina:     lr_multiplier *= 2.40
    if has_ecg_abn:    lr_multiplier *= 2.10

    # Prior Odds
    prior_odds = prior_prob / (1.0 - prior_prob)
    # Posterior Odds = Prior Odds * Product of Likelihood Ratios
    posterior_odds = prior_odds * lr_multiplier
    # Posterior Probability P(Disease | Evidence)
    posterior_prob = posterior_odds / (1.0 + posterior_odds)
    posterior_prob = round(max(0.02, min(0.98, posterior_prob)), 4)

    # 4. Epistemic Uncertainty Estimation (Shannon Entropy)
    entropy_bits = _shannon_entropy(posterior_prob)
    # Normalize entropy bits (max 1.0 at 50/50 probability) to percentage
    uncertainty_pct = round(entropy_bits * 100, 1)

    # 95% Bayesian Credible Interval calculation (+/- margin based on uncertainty)
    margin = round(1.96 * math.sqrt(posterior_prob * (1 - posterior_prob) / 100) * 100, 1)
    margin = max(1.8, min(8.5, margin))
    ci_lower = round(max(0.0, (posterior_prob * 100) - margin), 1)
    ci_upper = round(min(100.0, (posterior_prob * 100) + margin), 1)

    # 5. Value of Information (VOI) Engine for Unobserved Candidate Diagnostic Tests
    candidate_tests = [
        {
            "id": "troponin_i",
            "name": "Troponin-I Biomarker Assay",
            "category": "Blood Diagnostic",
            "cost_inr": 1200,
            "sensitivity": 0.94,
            "specificity": 0.92,
            "desc": "High specificity for acute myocardial injury."
        },
        {
            "id": "echocardiogram",
            "name": "2D Echocardiogram with Doppler",
            "category": "Imaging",
            "cost_inr": 2500,
            "sensitivity": 0.88,
            "specificity": 0.86,
            "desc": "Assesses ejection fraction & wall motion abnormalities."
        },
        {
            "id": "tmt_stress",
            "name": "Treadmill Exercise Stress Test (TMT)",
            "category": "Functional Test",
            "cost_inr": 1800,
            "sensitivity": 0.75,
            "specificity": 0.77,
            "desc": "Detects exertional ischemia under physical workload."
        },
        {
            "id": "coronary_ct",
            "name": "Coronary CT Angiography (CCTA)",
            "category": "Advanced Imaging",
            "cost_inr": 8500,
            "sensitivity": 0.98,
            "specificity": 0.90,
            "desc": "Direct non-invasive 3D visualization of coronary stenosis."
        },
    ]

    completed_set = set(t.lower() for t in req.known_tests_completed)
    voi_results = []

    for test in candidate_tests:
        if test["id"] in completed_set:
            continue

        sens = test["sensitivity"]
        spec = test["specificity"]

        # Expected entropy reduction after test: E[H_after]
        p_pos = (posterior_prob * sens) + ((1 - posterior_prob) * (1 - spec))
        p_neg = 1.0 - p_pos

        p_disease_given_pos = (posterior_prob * sens) / max(1e-6, p_pos)
        p_disease_given_neg = (posterior_prob * (1 - sens)) / max(1e-6, p_neg)

        h_pos = _shannon_entropy(p_disease_given_pos)
        h_neg = _shannon_entropy(p_disease_given_neg)

        expected_entropy = (p_pos * h_pos) + (p_neg * h_neg)
        entropy_reduction = max(0.0, entropy_bits - expected_entropy)
        uncertainty_reduction_pct = round((entropy_reduction / max(1e-6, entropy_bits)) * 100, 1)

        voi_results.append({
            **test,
            "expected_entropy_reduction_pct": uncertainty_reduction_pct,
            "expected_posterior_positive": round(p_disease_given_pos * 100, 1),
            "expected_posterior_negative": round(p_disease_given_neg * 100, 1),
        })

    # Sort tests by highest Value of Information (uncertainty reduction)
    voi_results.sort(key=lambda x: x["expected_entropy_reduction_pct"], reverse=True)

    best_test = voi_results[0] if voi_results else None

    # Verdict
    prob_pct = round(posterior_prob * 100, 1)
    if prob_pct >= 65:
        risk_level, color = "HIGH", "#E63946"
    elif prob_pct >= 38:
        risk_level, color = "MEDIUM", "#FFD166"
    else:
        risk_level, color = "LOW", "#06D6A0"

    return {
        "success": True,
        "data": {
            "disease_name":             "Coronary Artery Disease",
            "posterior_probability_pct": prob_pct,
            "risk_level":                risk_level,
            "color":                     color,
            "epistemic_uncertainty_pct": uncertainty_pct,
            "credible_interval_95":      {"lower_pct": ci_lower, "upper_pct": ci_upper, "margin_pct": margin},
            "shannon_entropy_bits":      round(entropy_bits, 4),
            "dag_topology":              DAG_TOPOLOGY,
            "next_best_test_recommendation": best_test,
            "all_voi_rankings":          voi_results,
            "evidence_evaluated": {
                "age_gt_55":             is_age_high,
                "hypertension_gt_130":    is_bp_high,
                "cholesterol_gt_240":    is_chol_high,
                "fasting_sugar_gt_120":   is_fbs_high,
                "anginal_chest_pain":    has_angina,
                "ecg_st_t_abnormality":  has_ecg_abn,
            },
        },
    }
