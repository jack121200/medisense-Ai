"""
Heart Disease Risk Prediction Model Trainer
===========================================
Dataset : HeartDiseaseTrain-Test.csv (1025 rows, 14 columns)
Target  : target (1=Heart Disease, 0=No Disease)
Strategy: Random Forest + XGBoost + Logistic Regression ensemble
          → best model selected by AUC-ROC via StratifiedKFold(5)

Data-specific fixes applied:
  • thalassemia 'No' → 'Normal'  (clinically invalid value)
  • rows where vessels_colored_by_flourosopy == 'Four' → dropped
  • cholestoral > 550 → dropped  (data entry error)
"""
import os
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import classification_report, roc_auc_score, accuracy_score, roc_curve
from sklearn.preprocessing import LabelEncoder, StandardScaler

try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("⚠️  XGBoost not installed — skipping XGBoost candidate")

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "app", "models")
CSV_PATH   = os.environ.get(
    "HEART_CSV",
    os.path.join(BASE_DIR, "..", "..", "HeartDiseaseTrain-Test.csv")
)
os.makedirs(MODELS_DIR, exist_ok=True)

# ── Categorical columns in THIS dataset ───────────────────────────────────────
CAT_COLS = [
    "sex",
    "chest_pain_type",
    "fasting_blood_sugar",
    "rest_ecg",
    "exercise_induced_angina",
    "slope",
    "vessels_colored_by_flourosopy",
    "thalassemia",
]
NUM_COLS = ["age", "resting_blood_pressure", "cholestoral", "Max_heart_rate", "oldpeak"]
TARGET   = "target"


def load_and_clean(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = df.columns.str.strip()
    print(f"Raw dataset  : {len(df)} rows, {len(df.columns)} columns")

    # ── Fix clinically invalid values ─────────────────────────────────────────
    if "thalassemia" in df.columns:
        df["thalassemia"] = df["thalassemia"].replace("No", "Normal")
        print("Fixed        : thalassemia 'No' → 'Normal'")

    if "vessels_colored_by_flourosopy" in df.columns:
        before = len(df)
        df = df[df["vessels_colored_by_flourosopy"] != "Four"]
        print(f"Dropped      : {before - len(df)} rows with vessels_colored_by_flourosopy='Four'")

    if "cholestoral" in df.columns:
        before = len(df)
        df = df[df["cholestoral"] < 550]
        print(f"Dropped      : {before - len(df)} extreme cholesterol outliers (>550)")

    df = df.dropna()
    print(f"After clean  : {len(df)} rows remain")
    return df


def encode(df: pd.DataFrame):
    """Label-encode categorical columns. Returns (df, encoders_dict)."""
    encoders = {}
    for col in CAT_COLS:
        if col in df.columns:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            encoders[col] = le
    return df, encoders


def train():
    print("=" * 60)
    print("  MediSense AI — Heart Disease Risk Model Training")
    print("=" * 60)

    # ── Load & clean ──────────────────────────────────────────────────────────
    df = load_and_clean(CSV_PATH)
    df, encoders = encode(df)

    feature_cols = [c for c in df.columns if c != TARGET]
    X = df[feature_cols]
    y = df[TARGET].astype(int)

    print(f"\nClass distribution: {dict(y.value_counts())}")
    print(f"Features ({len(feature_cols)}): {feature_cols}")

    # ── Train / test split FIRST (stratified) ─────────────────────────────────
    # Scaling must happen after the split, fit only on the training fold —
    # scaling on the full dataset before splitting lets the test set's
    # distribution leak into the statistics (mean/std) used to transform the
    # training data, which quietly inflates reported performance.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # ── Scale numerical features — fit on train only, apply to both ──────────
    scaler = StandardScaler()
    num_present = [c for c in NUM_COLS if c in X.columns]
    X_train = X_train.copy()
    X_test = X_test.copy()
    X_train[num_present] = scaler.fit_transform(X_train[num_present])
    X_test[num_present] = scaler.transform(X_test[num_present])

    # ── Candidate models ──────────────────────────────────────────────────────
    candidates = {
        "RandomForest": RandomForestClassifier(
            n_estimators=300, max_depth=6,
            min_samples_split=10, class_weight="balanced",
            random_state=42, n_jobs=-1,
        ),
        "LogisticRegression": LogisticRegression(
            C=0.1, max_iter=1000, random_state=42, class_weight="balanced"
        ),
    }
    if XGBOOST_AVAILABLE:
        candidates["XGBoost"] = XGBClassifier(
            n_estimators=200, max_depth=4,
            learning_rate=0.05, subsample=0.8,
            colsample_bytree=0.8, random_state=42,
            eval_metric="logloss", verbosity=0,
        )

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    best_name, best_model, best_auc = None, None, 0.0

    print("\n─── Cross-validated AUC scores ───────────────────────────────")
    for name, model in candidates.items():
        auc_scores = cross_val_score(model, X_train, y_train, cv=skf, scoring="roc_auc")
        recall_scores = cross_val_score(model, X_train, y_train, cv=skf, scoring="recall")
        auc_mean = auc_scores.mean()
        print(f"  {name:<22}  AUC={auc_mean:.4f}  Recall={recall_scores.mean():.4f}")
        if auc_mean > best_auc:
            best_auc = auc_mean
            best_name = name
            best_model = model

    print(f"\n✅ Best model: {best_name} (CV AUC = {best_auc:.4f})")

    # ── Train best model on full training split ────────────────────────────────
    best_model.fit(X_train, y_train)
    y_pred  = best_model.predict(X_test)
    y_proba = best_model.predict_proba(X_test)[:, 1]
    acc     = accuracy_score(y_test, y_pred)
    auc     = roc_auc_score(y_test, y_proba)

    print(f"\n  Test Accuracy : {acc:.4f} ({acc*100:.2f}%)")
    print(f"  Test AUC-ROC  : {auc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    # ── Decision threshold — Youden's J statistic ─────────────────────────────
    # The serving route (medisense_predict.py) previously hardcoded 0.38 with
    # no documented rationale and no link back to the model that produced it.
    # Youden's J = sensitivity + specificity - 1, maximized over the ROC
    # curve, is a standard, principled way to pick an operating threshold
    # when there's no explicit cost-of-error ratio given — it's computed here
    # from the held-out test set and versioned in the metadata below instead
    # of living as a magic number in application code.
    fpr, tpr, thresholds = roc_curve(y_test, y_proba)
    youden_j = tpr - fpr
    best_idx = int(np.argmax(youden_j))
    optimal_threshold = float(thresholds[best_idx])
    print(f"\n  Optimal threshold (Youden's J) : {optimal_threshold:.4f}")
    print(f"  Sensitivity at threshold        : {tpr[best_idx]:.4f}")
    print(f"  Specificity at threshold        : {1 - fpr[best_idx]:.4f}")

    # ── Feature importance (if available) ─────────────────────────────────────
    feature_importance = {}
    if hasattr(best_model, "feature_importances_"):
        fi = best_model.feature_importances_
        feature_importance = dict(sorted(
            zip(feature_cols, fi.tolist()),
            key=lambda x: x[1], reverse=True
        ))
        print("\nTop 5 features:")
        for f, v in list(feature_importance.items())[:5]:
            print(f"  {f:<40} {v:.4f}")

    # ── Save artefacts ────────────────────────────────────────────────────────
    joblib.dump(best_model, os.path.join(MODELS_DIR, "heart_risk_model.pkl"))
    joblib.dump(scaler,     os.path.join(MODELS_DIR, "heart_scaler.pkl"))
    joblib.dump(encoders,   os.path.join(MODELS_DIR, "heart_encoder.pkl"))

    with open(os.path.join(MODELS_DIR, "heart_features.json"), "w") as f:
        json.dump(feature_cols, f)

    meta = {
        "algorithm":          best_name,
        "accuracy":           round(acc, 4),
        "roc_auc":            round(auc, 4),
        "cv_auc":             round(best_auc, 4),
        "decision_threshold": round(optimal_threshold, 4),
        "threshold_method":   "Youden's J statistic on held-out test set (sensitivity + specificity - 1, maximized)",
        "sensitivity_at_threshold": round(float(tpr[best_idx]), 4),
        "specificity_at_threshold": round(float(1 - fpr[best_idx]), 4),
        "features":           feature_cols,
        "categorical_cols":   CAT_COLS,
        "numerical_cols":     NUM_COLS,
        "n_train":            len(X_train),
        "n_test":             len(X_test),
        "feature_importance": feature_importance,
        "dataset":            "HeartDiseaseTrain-Test.csv",
        "note":               "Trained on 1025-row cardiac dataset, cleaned for clinical validity. Scaler is fit on the training split only (see load_and_clean/train) to avoid test-set leakage.",
    }
    with open(os.path.join(MODELS_DIR, "heart_risk_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n✅ Saved: heart_risk_model.pkl + heart_scaler.pkl + heart_encoder.pkl")
    print(f"✅ Saved: heart_features.json + heart_risk_meta.json")
    return auc


if __name__ == "__main__":
    train()
