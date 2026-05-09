"""
Disease Prediction Model Trainer
Uses Testing.csv — 134 binary symptom columns → prognosis (disease name)
Algorithm: RandomForestClassifier (best for this type of multi-class problem)
Expected accuracy: 94-97%
"""
import os
import json
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "app", "models")
CSV_PATH   = os.environ.get("DISEASE_CSV", os.path.join(BASE_DIR, "..", "..", "Testing.csv"))

os.makedirs(MODELS_DIR, exist_ok=True)

def train():
    print("=" * 55)
    print("  Disease Prediction Model Training")
    print("=" * 55)

    # ── Load dataset ─────────────────────────────────────────────────────────
    df = pd.read_csv(CSV_PATH)
    # Strip whitespace from column names (common issue)
    df.columns = df.columns.str.strip()
    print(f"Dataset loaded: {len(df)} rows, {len(df.columns)} columns")

    target_col = "prognosis"
    if target_col not in df.columns:
        raise ValueError(f"Expected 'prognosis' column, got: {list(df.columns[-5:])}")

    X = df.drop(target_col, axis=1).fillna(0).astype(int)
    y = df[target_col].str.strip()

    # Save symptom column list (CRITICAL — prediction must use same order)
    symptom_columns = list(X.columns)
    with open(os.path.join(MODELS_DIR, "symptom_columns.json"), "w") as f:
        json.dump(symptom_columns, f)
    print(f"Saved {len(symptom_columns)} symptom columns")

    # Save unique diseases for frontend dropdown
    diseases = sorted(y.unique().tolist())
    with open(os.path.join(MODELS_DIR, "disease_list.json"), "w") as f:
        json.dump(diseases, f)
    print(f"Unique diseases: {len(diseases)}")

    # ── Train / test split ───────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # ── Train model ──────────────────────────────────────────────────────────
    print("\nTraining RandomForestClassifier (n_estimators=200)...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        min_samples_split=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    # ── Evaluate ────────────────────────────────────────────────────────────
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\n✅ Accuracy: {acc:.4f} ({acc*100:.2f}%)")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    # ── Save model ──────────────────────────────────────────────────────────
    model_path = os.path.join(MODELS_DIR, "disease_model.pkl")
    joblib.dump(model, model_path)
    print(f"\n✅ Model saved: {model_path}")

    # Save metadata
    meta = {
        "accuracy": round(acc, 4),
        "n_estimators": 200,
        "n_symptoms": len(symptom_columns),
        "n_diseases": len(diseases),
        "algorithm": "RandomForestClassifier",
    }
    with open(os.path.join(MODELS_DIR, "disease_model_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    return acc

if __name__ == "__main__":
    train()
