"""
Bayesian Network Trainer — Coronary Disease Decision Network
==============================================================
Replaces the old bayesian_engine.py, which computed "posterior probability"
by multiplying six hand-picked likelihood-ratio constants together — no
data, no fitting, just invented numbers dressed up as Bayesian inference.

This script fits a REAL discrete Bayesian network — same DAG structure the
old code already displayed to users (see DAG_TOPOLOGY in bayesian_engine.py)
— with its conditional probability tables (CPDs) estimated from
HeartDiseaseTrain-Test.csv via pgmpy's BayesianEstimator (BDeu prior, so
sparse evidence combinations don't collapse to zero probability).

Dataset : HeartDiseaseTrain-Test.csv (1025 rows) — same dataset already
          used for the heart-risk model; every node below is a discretized
          view of columns that already exist in it.
Nodes   : Age_Risk, Hypertension, Hypercholesterolemia, Hyperglycemia,
          Coronary_Disease, Chest_Pain, ECG_St_T (all binary 0/1)
Edges   : Age_Risk -> Hypertension, Age_Risk -> Coronary_Disease,
          Hypertension -> Coronary_Disease, Hypercholesterolemia -> Coronary_Disease,
          Hyperglycemia -> Coronary_Disease, Coronary_Disease -> Chest_Pain,
          Coronary_Disease -> ECG_St_T
"""
import os
import json
import joblib
import pandas as pd

from pgmpy.models import DiscreteBayesianNetwork
from pgmpy.estimators import BayesianEstimator

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "app", "models")
CSV_PATH = os.environ.get(
    "HEART_CSV",
    os.path.join(BASE_DIR, "..", "..", "HeartDiseaseTrain-Test.csv"),
)
os.makedirs(MODELS_DIR, exist_ok=True)

EDGES = [
    ("Age_Risk", "Hypertension"),
    ("Age_Risk", "Coronary_Disease"),
    ("Hypertension", "Coronary_Disease"),
    ("Hypercholesterolemia", "Coronary_Disease"),
    ("Hyperglycemia", "Coronary_Disease"),
    ("Coronary_Disease", "Chest_Pain"),
    ("Coronary_Disease", "ECG_St_T"),
]

DAG_TOPOLOGY = {
    "nodes": [
        {"id": "Age_Risk",             "label": "Age > 55",               "type": "demographic"},
        {"id": "Hypertension",         "label": "Hypertension (BP>130)",  "type": "risk_factor"},
        {"id": "Hypercholesterolemia", "label": "High Cholesterol (>240)", "type": "risk_factor"},
        {"id": "Hyperglycemia",        "label": "High Fasting Sugar",     "type": "risk_factor"},
        {"id": "Chest_Pain",           "label": "Anginal Chest Pain",     "type": "symptom"},
        {"id": "ECG_St_T",             "label": "ECG ST-T Abnormality",   "type": "finding"},
        {"id": "Coronary_Disease",     "label": "Coronary Artery Disease", "type": "target"},
    ],
    "edges": [{"source": s, "target": t} for s, t in EDGES],
}


def discretize(df: pd.DataFrame) -> pd.DataFrame:
    """Binary-discretize the raw columns into the network's node values."""
    out = pd.DataFrame()
    out["Age_Risk"] = (df["age"] > 55).astype(int)
    out["Hypertension"] = (df["resting_blood_pressure"] > 130).astype(int)
    out["Hypercholesterolemia"] = (df["cholestoral"] > 240).astype(int)
    out["Hyperglycemia"] = (df["fasting_blood_sugar"].str.strip() == "Greater than 120 mg/ml").astype(int)
    # NOTE on this dataset specifically: "Typical angina" has a *lower*
    # disease rate (~25%) than every other chest_pain_type category
    # (65-80%) — a well-documented quirk of the Cleveland heart-disease
    # dataset this file derives from (patients later found asymptomatic or
    # atypical were often the ones who actually had angiography-confirmed
    # disease). Splitting on "Typical angina vs. everything else" preserves
    # that real signal; "Typical/Atypical" (a natural-sounding but wrong
    # split) mixes a low-rate and a high-rate category together and
    # destroys it. Verified against this exact CSV before choosing the split.
    out["Chest_Pain"] = (df["chest_pain_type"].str.strip() != "Typical angina").astype(int)
    out["ECG_St_T"] = (df["rest_ecg"].str.strip() == "ST-T wave abnormality").astype(int)
    out["Coronary_Disease"] = df["target"].astype(int)
    return out


def train():
    print("=" * 60)
    print("  Bayesian Network — Coronary Disease Decision Network")
    print("=" * 60)

    df = pd.read_csv(CSV_PATH)
    df.columns = df.columns.str.strip()
    data = discretize(df)
    print(f"Discretized {len(data)} rows into {list(data.columns)}")
    print("\nNode marginals (fraction = 1):")
    for col in data.columns:
        print(f"  {col:<24} {data[col].mean():.3f}")

    model = DiscreteBayesianNetwork(EDGES)
    estimator = BayesianEstimator(model, data)
    cpds = estimator.get_parameters(prior_type="BDeu", equivalent_sample_size=10)
    model.add_cpds(*cpds)

    assert model.check_model(), "Bayesian network structure/CPDs failed validation"
    print("\nModel validated: DAG is acyclic and every CPD sums to 1.")

    joblib.dump(model, os.path.join(MODELS_DIR, "bayesian_network.pkl"))

    meta = {
        "node_count": len(data.columns),
        "edges": EDGES,
        "dag_topology": DAG_TOPOLOGY,
        "estimator": "BayesianEstimator (BDeu prior, equivalent_sample_size=10)",
        "n_train": len(data),
        "node_marginals": {c: round(float(data[c].mean()), 4) for c in data.columns},
        "dataset": "HeartDiseaseTrain-Test.csv",
        "note": (
            "Replaces the previous hardcoded likelihood-ratio constants — "
            "every CPD here is fit from data via pgmpy, not hand-picked."
        ),
    }
    with open(os.path.join(MODELS_DIR, "bayesian_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nSaved: bayesian_network.pkl + bayesian_meta.json")
    return model


if __name__ == "__main__":
    train()
