"""
Disease Prediction (Symptom Checker) Model Trainer
=====================================================
Dataset : disease_symptom_train.csv / disease_symptom_test.csv
          (data/disease_symptom_train.csv, data/disease_symptom_test.csv)
          — 4920 rows, 132 binary symptom columns, 41 diseases, 120 rows
          per disease (perfectly balanced).

The model previously shipped in this project was trained on the repo's
root-level Testing.csv, which has only 42 rows total for a ~40-class
problem — an unstratified 80/20 split on that file left classes with zero
training examples, and the shipped disease_model_meta.json recorded a test
accuracy of exactly 0.0. This script replaces that dataset with a properly
sized, balanced, real public dataset (same lineage/symptom set as the old
file, just far larger — see prepare notes in the repo's audit) and adds
stratification + cross-validation so the reported accuracy is trustworthy.

Algorithm: RandomForestClassifier
"""
import os
import json
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import accuracy_score, f1_score, classification_report

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "app", "models")
CSV_PATH   = os.environ.get(
    "DISEASE_CSV",
    os.path.join(BASE_DIR, "..", "data", "disease_symptom_train.csv"),
)

os.makedirs(MODELS_DIR, exist_ok=True)


def train():
    print("=" * 55)
    print("  Disease Prediction (Symptom Checker) Model Training")
    print("=" * 55)

    # ── Load dataset ─────────────────────────────────────────────────────────
    df = pd.read_csv(CSV_PATH)
    df.columns = df.columns.str.strip()
    # Source CSV has a trailing comma on every row -> an empty "Unnamed: N" column
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    print(f"Dataset loaded: {len(df)} rows, {len(df.columns)} columns")

    target_col = "prognosis"
    if target_col not in df.columns:
        raise ValueError(f"Expected 'prognosis' column, got: {list(df.columns[-5:])}")

    X = df.drop(target_col, axis=1).fillna(0).astype(int)
    y = df[target_col].str.strip()

    print(f"Classes: {y.nunique()}  |  Rows per class: min={y.value_counts().min()}, max={y.value_counts().max()}")

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

    # ── Train / test split — STRATIFIED this time (every class has 120 rows,
    #    so this is now actually viable, unlike on the old 42-row file) ──────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # ── Cross-validated accuracy (5-fold, stratified) ─────────────────────────
    print("\nRunning 5-fold StratifiedKFold cross-validation...")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    base_model = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
    cv_scores = cross_val_score(base_model, X_train, y_train, cv=skf, scoring="accuracy")
    print(f"  CV accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

    # ── Train final model on the full training split ──────────────────────────
    print("\nTraining final RandomForestClassifier (n_estimators=200)...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        min_samples_split=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    # ── Evaluate on held-out test split ────────────────────────────────────────
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average="macro")
    print(f"\nTest Accuracy : {acc:.4f} ({acc*100:.2f}%)")
    print(f"Macro F1      : {macro_f1:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))

    # ── Save model ──────────────────────────────────────────────────────────
    model_path = os.path.join(MODELS_DIR, "disease_model.pkl")
    joblib.dump(model, model_path)
    print(f"\nModel saved: {model_path}")

    # Save metadata
    meta = {
        "accuracy": round(float(acc), 4),
        "macro_f1": round(float(macro_f1), 4),
        "cv_accuracy_mean": round(float(cv_scores.mean()), 4),
        "cv_accuracy_std": round(float(cv_scores.std()), 4),
        "n_estimators": 200,
        "n_symptoms": len(symptom_columns),
        "n_diseases": len(diseases),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "algorithm": "RandomForestClassifier",
        "dataset": "disease_symptom_train.csv (4920 rows, 41 balanced classes, 120 rows/class)",
        "note": (
            "Replaces the previous model trained on the repo's 42-row Testing.csv, "
            "which recorded 0.0 test accuracy (unstratified split on too few rows "
            "for the class count). This dataset is large enough for a real "
            "stratified split and 5-fold cross-validation. "
            "CAVEAT: this public dataset gives every disease a fixed, "
            "non-overlapping symptom signature with no noise, so accuracy near "
            "100% here reflects that the dataset is perfectly separable, not that "
            "real-world ambiguous/overlapping symptom presentations are solved. "
            "Treat this model's confidence as dataset-clean-case performance, not "
            "clinical validation."
        ),
    }
    with open(os.path.join(MODELS_DIR, "disease_model_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    return acc


if __name__ == "__main__":
    train()
