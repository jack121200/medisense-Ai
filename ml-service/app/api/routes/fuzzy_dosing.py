"""
fuzzy_dosing.py — Feature 2: Mamdani Fuzzy Logic Controller for Drug Dosing & Triage
===================================================================================
Syllabus Mapping: Unit III — Fuzzy Sets, Membership Functions, Mamdani FIS, Max-Min Composition,
                   Defuzzification Methods (Centroid Method), Fuzzy Control Systems.

Implements:
  1. Triangular & Trapezoidal Membership Functions (µ) for BP, Serum Creatinine, and Age.
  2. Mamdani IF-THEN Fuzzy Rule Base.
  3. Max-Min Composition & Centroid Defuzzification to calculate exact personalized drug dosage (mg) & Triage Score.
  4. 2D/3D Fuzzy Control Surface grid evaluation for visual inspection.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/fuzzy", tags=["Fuzzy Logic Dosing Engine"])

# ══════════════════════════════════════════════════════════════════
#  SCHEMAS
# ══════════════════════════════════════════════════════════════════

class FuzzyDosingRequest(BaseModel):
    systolic_bp:      float = Field(..., description="Systolic Blood Pressure mmHg", example=156)
    serum_creatinine: float = Field(..., description="Serum Creatinine mg/dL", example=1.9)
    age:              float = Field(..., description="Patient Age in years", example=64)
    drug_name:        str   = Field("Ramipril", description="Selected Cardiac Medication")


# ══════════════════════════════════════════════════════════════════
#  MEMBERSHIP FUNCTIONS (Triangular & Trapezoidal)
# ══════════════════════════════════════════════════════════════════

def _trapmf(x: float, a: float, b: float, c: float, d: float) -> float:
    """Trapezoidal membership function mu(x)."""
    if x <= a or x >= d:
        return 0.0
    elif a < x < b:
        return (x - a) / max(1e-6, b - a)
    elif b <= x <= c:
        return 1.0
    elif c < x < d:
        return (d - x) / max(1e-6, d - c)
    return 0.0

def _trimf(x: float, a: float, b: float, c: float) -> float:
    """Triangular membership function mu(x)."""
    if x <= a or x >= c:
        return 0.0
    elif a < x <= b:
        return (x - a) / max(1e-6, b - a)
    elif b < x < c:
        return (c - x) / max(1e-6, c - b)
    return 0.0


# Standard drug reference adult dosages (mg)
DRUG_SPECS = {
    "Ramipril":    {"std_dose": 10.0, "min_dose": 1.25, "unit": "mg Daily",    "ind": "ACE Inhibitor for BP & Heart Failure"},
    "Metoprolol":  {"std_dose": 100.0,"min_dose": 12.5, "unit": "mg Twice/Day","ind": "Beta Blocker for HR & Angina"},
    "Amlodipine":  {"std_dose": 10.0, "min_dose": 2.5,  "unit": "mg Daily",    "ind": "Calcium Channel Blocker for Hypertension"},
    "Atorvastatin":{"std_dose": 80.0, "min_dose": 10.0, "unit": "mg Nightly",  "ind": "Statin for Lipid Reduction"},
}


# ══════════════════════════════════════════════════════════════════
#  MAMDANI FUZZY INFERENCE ENGINE & CENTROID DEFUZZIFICATION
# ══════════════════════════════════════════════════════════════════

@router.post("/dosage-triage", summary="Mamdani FIS Drug Dosage & Triage Controller")
def run_fuzzy_dosing(req: FuzzyDosingRequest):
    """
    Evaluates Mamdani Fuzzy Rules on BP, Serum Creatinine, and Age.
    Calculates exact dosage reduction % using Centroid Defuzzification method.
    """
    bp   = max(80.0, min(220.0, req.systolic_bp))
    creat= max(0.4, min(5.0, req.serum_creatinine))
    age  = max(18.0, min(95.0, req.age))
    drug = req.drug_name if req.drug_name in DRUG_SPECS else "Ramipril"

    spec = DRUG_SPECS[drug]

    # 1. Fuzzification (Calculate membership degrees mu)
    # Systolic BP Membership
    mu_bp_low      = _trapmf(bp, 70, 80, 100, 115)
    mu_bp_normal   = _trimf(bp, 105, 120, 135)
    mu_bp_elevated = _trimf(bp, 130, 145, 160)
    mu_bp_high     = _trapmf(bp, 150, 165, 220, 240)

    # Serum Creatinine (Kidney Impairment) Membership
    mu_cr_normal   = _trapmf(creat, 0.3, 0.6, 1.1, 1.3)
    mu_cr_mild     = _trimf(creat, 1.2, 1.6, 2.0)
    mu_cr_severe   = _trapmf(creat, 1.8, 2.3, 5.0, 6.0)

    # Age Membership
    mu_age_young   = _trapmf(age, 18, 20, 40, 48)
    mu_age_middle  = _trimf(age, 42, 55, 68)
    mu_age_elderly = _trapmf(age, 62, 70, 95, 100)

    # 2. Mamdani Rule Base (Max-Min Composition)
    # Rules define Dose Multiplier Factor (0.10 = 90% reduction, 1.0 = Full dose)
    rules = [
        {
            "id": 1,
            "rule": "IF BP is HIGH AND Creatinine is NORMAL THEN Dose Factor = 1.0 (Full Dose)",
            "weight": min(mu_bp_high, mu_cr_normal),
            "dose_factor": 1.0,
            "triage_score": 75,
        },
        {
            "id": 2,
            "rule": "IF BP is HIGH AND Creatinine is MILD IMPAIRMENT THEN Dose Factor = 0.5 (50% Dose)",
            "weight": min(mu_bp_high, mu_cr_mild),
            "dose_factor": 0.5,
            "triage_score": 85,
        },
        {
            "id": 3,
            "rule": "IF Creatinine is SEVERE IMPAIRMENT THEN Dose Factor = 0.25 (Renal Dose Reduction)",
            "weight": mu_cr_severe,
            "dose_factor": 0.25,
            "triage_score": 92,
        },
        {
            "id": 4,
            "rule": "IF BP is LOW THEN Dose Factor = 0.15 (Withhold / Minimal Dose)",
            "weight": mu_bp_low,
            "dose_factor": 0.15,
            "triage_score": 60,
        },
        {
            "id": 5,
            "rule": "IF Age is ELDERLY AND Creatinine is MILD IMPAIRMENT THEN Dose Factor = 0.40",
            "weight": min(mu_age_elderly, mu_cr_mild),
            "dose_factor": 0.40,
            "triage_score": 80,
        },
        {
            "id": 6,
            "rule": "IF BP is NORMAL AND Creatinine is NORMAL THEN Dose Factor = 0.85 (Maintenance Dose)",
            "weight": min(mu_bp_normal, mu_cr_normal),
            "dose_factor": 0.85,
            "triage_score": 30,
        },
    ]

    # Filter active rules (weight > 0)
    active_rules = [r for r in rules if r["weight"] > 0.01]

    # 3. Centroid Defuzzification: integral(x * mu(x)) / integral(mu(x))
    # Discrete sampling across dose factor output universe [0.10, 1.0]
    num_samples = 100
    x_samples = [0.10 + (i / (num_samples - 1)) * 0.90 for i in range(num_samples)]
    
    numerator = 0.0
    denominator = 0.0

    for x in x_samples:
        # Aggregated membership mu_agg(x) using Max-Min composition
        mu_agg = 0.0
        for r in rules:
            if r["weight"] > 0:
                # Clipped membership at rule firing weight
                val = min(r["weight"], 1.0 - abs(x - r["dose_factor"]) / 0.3)
                mu_agg = max(mu_agg, max(0.0, val))
        
        numerator += x * mu_agg
        denominator += mu_agg

    if denominator < 1e-6:
        defuzzified_factor = 0.50
    else:
        defuzzified_factor = numerator / denominator

    defuzzified_factor = max(0.125, min(1.0, defuzzified_factor))

    # Calculate exact dosage
    calculated_dose = round(spec["std_dose"] * defuzzified_factor, 2)
    calculated_dose = max(spec["min_dose"], calculated_dose)
    reduction_pct   = round((1.0 - (calculated_dose / spec["std_dose"])) * 100, 1)

    # Defuzzify Triage Priority Score (0 - 100)
    triage_num = sum(r["triage_score"] * r["weight"] for r in rules)
    triage_den = sum(r["weight"] for r in rules) or 1.0
    triage_score = round(triage_num / triage_den, 1)

    triage_label = "CRITICAL EMERGENCY" if triage_score >= 85 else "HIGH PRIORITY" if triage_score >= 70 else "MODERATE" if triage_score >= 40 else "ROUTINE"
    triage_color = "#E63946" if triage_score >= 85 else "#FF6B35" if triage_score >= 70 else "#FFD166" if triage_score >= 40 else "#00FF87"

    # 4. Generate 2D/3D Fuzzy Control Surface Mesh Data for Visual Plot
    # Grid of BP vs Creatinine -> Dosage Factor Output
    surface_grid = []
    bp_steps   = [100, 120, 140, 160, 180, 200]
    cr_steps   = [0.8, 1.2, 1.6, 2.0, 2.5, 3.5]

    for b in bp_steps:
        for c in cr_steps:
            # Quick rule eval for grid
            w_severe = _trapmf(c, 1.8, 2.3, 5.0, 6.0)
            w_high   = _trapmf(b, 150, 165, 220, 240)
            factor   = 1.0 - (w_severe * 0.70) - (0.2 if b < 110 else 0.0)
            factor   = max(0.15, min(1.0, factor))
            surface_grid.append({
                "systolic_bp": b,
                "creatinine":  c,
                "dose_factor": round(factor, 2),
                "dose_mg":     round(spec["std_dose"] * factor, 1),
            })

    return {
        "success": True,
        "data": {
            "drug_name":               drug,
            "standard_full_dose":      f"{spec['std_dose']} {spec['unit']}",
            "recommended_dose_mg":     calculated_dose,
            "recommended_dose_label":  f"{calculated_dose} {spec['unit']}",
            "dosage_reduction_pct":    reduction_pct,
            "defuzzified_factor":      round(defuzzified_factor, 3),
            "defuzzification_method":  "Centroid (Center of Gravity)",
            "triage_score":            triage_score,
            "triage_label":            triage_label,
            "triage_color":            triage_color,
            "fuzzified_memberships": {
                "bp_level":         "High" if mu_bp_high > 0.5 else "Elevated" if mu_bp_elevated > 0.5 else "Normal",
                "creatinine_level": "Severe Impairment" if mu_cr_severe > 0.5 else "Mild Impairment" if mu_cr_mild > 0.5 else "Normal",
                "age_group":        "Elderly" if mu_age_elderly > 0.5 else "Middle Aged" if mu_age_middle > 0.5 else "Young",
                "mu_bp_high":       round(mu_bp_high, 3),
                "mu_cr_severe":     round(mu_cr_severe, 3),
                "mu_cr_mild":       round(mu_cr_mild, 3),
            },
            "active_rules_fired": [
                {
                    "rule_id": r["id"],
                    "rule_text": r["rule"],
                    "firing_strength_alpha": round(r["weight"], 3),
                }
                for r in active_rules
            ],
            "surface_mesh": surface_grid,
        },
    }
