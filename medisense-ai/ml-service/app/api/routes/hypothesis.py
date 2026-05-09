"""
hypothesis.py — Research & Analytics: Hypothesis Testing + Population Stats
===========================================================================
Provides:
  GET /api/hypothesis/test?question=<1-4>
  GET /api/hypothesis/population-stats

Runs on real patient data loaded from the Heart Disease CSV (as proxy for
clinic population). In production this would query the PostgreSQL database.
"""
import os
import json
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from scipy import stats

router = APIRouter(prefix="/api/hypothesis", tags=["hypothesis"])

# ── Load dataset as clinic population proxy ──────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.environ.get(
    "HEART_CSV",
    os.path.join(BASE_DIR, "..", "..", "..", "..", "HeartDiseaseTrain-Test.csv")
)
META_PATH = os.path.join(BASE_DIR, "..", "models", "heart_risk_meta.json")

def load_data() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH)
    df.columns = df.columns.str.strip()
    # Fix same issues as training
    if "thalassemia" in df.columns:
        df["thalassemia"] = df["thalassemia"].replace("No", "Normal")
    if "vessels_colored_by_flourosopy" in df.columns:
        df = df[df["vessels_colored_by_flourosopy"] != "Four"]
    if "cholestoral" in df.columns:
        df = df[df["cholestoral"] < 550]
    return df.dropna()


# ── Helper: format stat value for display ────────────────────────────────────
def fmt(val):
    if isinstance(val, float):
        return round(val, 4)
    return val


# ── Individual question runners ───────────────────────────────────────────────
def q1_bp_vs_heart_disease(df: pd.DataFrame) -> dict:
    """Q1: High BP vs heart disease rate — Chi-Square"""
    df["bp_high"] = df["resting_blood_pressure"] > 130
    ct = pd.crosstab(df["bp_high"], df["target"])
    chi2, p, dof, _ = stats.chi2_contingency(ct)
    hbp_rate = df[df["bp_high"]]["target"].mean() * 100
    nbp_rate = df[~df["bp_high"]]["target"].mean() * 100
    return {
        "question": "High BP vs Heart Disease Rate",
        "test_used": "Chi-Square Test",
        "test_explanation": "Used because we are comparing heart disease rates (categorical outcome) between two groups.",
        "group_a_value": f"{hbp_rate:.1f}%",
        "group_b_value": f"{nbp_rate:.1f}%",
        "p_value": fmt(p),
        "significant": bool(p < 0.05),
        "verdict": "Statistically significant difference found ✓" if p < 0.05 else "No significant difference detected",
        "plain_english": (
            f"Patients with high resting BP (>130) have a {hbp_rate:.1f}% heart disease rate vs "
            f"{nbp_rate:.1f}% in normal BP patients. "
            + ("This difference IS statistically real (p={:.4f}).".format(p) if p < 0.05
               else "This difference is NOT statistically significant (p={:.4f}).".format(p))
        ),
        "chart_data": [
            {"name": "High BP (>130)", "value": round(hbp_rate, 1)},
            {"name": "Normal BP (≤130)", "value": round(nbp_rate, 1)},
        ],
    }


def q2_gender_vs_heart_disease(df: pd.DataFrame) -> dict:
    """Q2: Gender vs heart disease rate — Chi-Square"""
    ct = pd.crosstab(df["sex"], df["target"])
    chi2, p, dof, _ = stats.chi2_contingency(ct)
    # In dataset: Male = 1, Female = 0 (common encoding)
    sexes = df["sex"].unique()
    rates = {s: df[df["sex"] == s]["target"].mean() * 100 for s in sexes}
    vals = list(rates.items())
    return {
        "question": "Gender vs Heart Disease Rate",
        "test_used": "Chi-Square Test",
        "test_explanation": "Used because we are comparing a categorical outcome (heart disease yes/no) across gender groups.",
        "group_a_value": f"{vals[0][1]:.1f}%",
        "group_b_value": f"{vals[1][1]:.1f}%",
        "p_value": fmt(p),
        "significant": bool(p < 0.05),
        "verdict": "Statistically significant difference found ✓" if p < 0.05 else "No significant difference detected",
        "plain_english": (
            f"Heart disease rates differ by gender (p={p:.4f}). "
            + ("This IS a statistically significant difference." if p < 0.05
               else "The difference is NOT statistically significant.")
        ),
        "chart_data": [{"name": f"Group {v[0]}", "value": round(v[1], 1)} for v in vals],
    }


def q3_cholesterol_vs_max_hr(df: pd.DataFrame) -> dict:
    """Q3: High cholesterol vs max heart rate — Independent T-Test"""
    high_chol = df[df["cholestoral"] > 240]["Max_heart_rate"]
    norm_chol = df[df["cholestoral"] <= 240]["Max_heart_rate"]
    t_stat, p = stats.ttest_ind(high_chol, norm_chol)
    return {
        "question": "High Cholesterol vs Max Heart Rate",
        "test_used": "Independent Samples T-Test",
        "test_explanation": "Used because we are comparing a continuous measurement (max heart rate) between two independent groups.",
        "group_a_value": f"{high_chol.mean():.1f} bpm",
        "group_b_value": f"{norm_chol.mean():.1f} bpm",
        "p_value": fmt(p),
        "significant": bool(p < 0.05),
        "verdict": "Statistically significant difference found ✓" if p < 0.05 else "No significant difference detected",
        "plain_english": (
            f"Patients with cholesterol >240 have avg max HR of {high_chol.mean():.1f} bpm vs "
            f"{norm_chol.mean():.1f} bpm in normal cholesterol patients (p={p:.4f}). "
            + ("This IS statistically significant." if p < 0.05 else "Not statistically significant.")
        ),
        "chart_data": [
            {"name": "Cholesterol >240", "value": round(float(high_chol.mean()), 1)},
            {"name": "Normal Cholesterol", "value": round(float(norm_chol.mean()), 1)},
        ],
    }


def q4_age_vs_risk_score(df: pd.DataFrame) -> dict:
    """Q4: Age >55 vs ≤55 cardiac risk scores — T-Test using target as proxy"""
    old = df[df["age"] > 55]["target"].astype(float) * 100
    young = df[df["age"] <= 55]["target"].astype(float) * 100
    t_stat, p = stats.ttest_ind(old, young)
    return {
        "question": "Age Group vs Cardiac Risk Score",
        "test_used": "Independent Samples T-Test",
        "test_explanation": "Used because we are comparing continuous risk scores between two independent age groups.",
        "group_a_value": f"{old.mean():.1f}%",
        "group_b_value": f"{young.mean():.1f}%",
        "p_value": fmt(p),
        "significant": bool(p < 0.05),
        "verdict": "Statistically significant difference found ✓" if p < 0.05 else "No significant difference detected",
        "plain_english": (
            f"Patients over 55 have avg cardiac risk of {old.mean():.1f}% vs {young.mean():.1f}% "
            f"for patients ≤55 (p={p:.4f}). "
            + ("This IS a statistically significant difference." if p < 0.05
               else "Not statistically significant.")
        ),
        "chart_data": [
            {"name": "Age > 55", "value": round(float(old.mean()), 1)},
            {"name": "Age ≤ 55", "value": round(float(young.mean()), 1)},
        ],
    }


QUESTION_RUNNERS = {1: q1_bp_vs_heart_disease, 2: q2_gender_vs_heart_disease,
                    3: q3_cholesterol_vs_max_hr, 4: q4_age_vs_risk_score}


@router.get("/test")
async def run_test(question: int = Query(..., ge=1, le=4)):
    try:
        df = load_data()
        result = QUESTION_RUNNERS[question](df)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="HeartDiseaseTrain-Test.csv not found. Set HEART_CSV env var.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/population-stats")
async def population_stats():
    try:
        df = load_data()
        total = len(df)

        # Risk distribution using target column as proxy
        high_risk_df   = df[df["target"] == 1]
        low_risk_df    = df[df["target"] == 0]

        pct_high   = len(high_risk_df) / total * 100
        pct_low    = len(low_risk_df) / total * 100
        pct_medium = 0.0  # Binary dataset has no "medium" — set 0

        # Risk by age group
        bins = [(0, 40, "29-40"), (40, 55, "41-55"), (55, 65, "56-65"), (65, 120, "65+")]
        age_risk = []
        for lo, hi, label in bins:
            grp = df[(df["age"] >= lo) & (df["age"] < hi)]
            if len(grp) > 0:
                pct = grp["target"].mean() * 100
                age_risk.append({"age_group": label, "medium_high_pct": round(pct, 1)})

        # Top 5 risk factors from model meta
        top_factors = []
        if os.path.exists(META_PATH):
            with open(META_PATH) as f:
                meta = json.load(f)
            fi = meta.get("feature_importance", {})
            top5 = sorted(fi.items(), key=lambda x: x[1], reverse=True)[:5]
            total_fi = sum(v for _, v in top5) or 1
            top_factors = [{"factor": k.replace("_", " ").title(), "importance_pct": round(v / total_fi * 100, 1)} for k, v in top5]

        # CBC monthly flags — placeholder (no CBC DB yet)
        cbc_trend = []

        # Gender split of high-risk
        male_high   = len(df[(df["sex"].astype(str).str.lower().isin(["male", "1"])) & (df["target"] == 1)])
        female_high = len(df[(df["sex"].astype(str).str.lower().isin(["female", "0"])) & (df["target"] == 1)])
        total_high  = male_high + female_high or 1
        gender_split = {
            "male_pct": round(male_high / total_high * 100, 1),
            "female_pct": round(female_high / total_high * 100, 1),
        }

        return {
            "total_patients": total,
            "pct_high": round(pct_high, 1),
            "pct_medium": round(pct_medium, 1),
            "pct_low": round(pct_low, 1),
            "risk_distribution": [
                {"level": "High", "count": len(high_risk_df)},
                {"level": "Low", "count": len(low_risk_df)},
            ],
            "risk_by_age_group": age_risk,
            "top_risk_factors": top_factors,
            "cbc_monthly_flags": cbc_trend,
            "gender_high_risk": gender_split,
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="HeartDiseaseTrain-Test.csv not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
