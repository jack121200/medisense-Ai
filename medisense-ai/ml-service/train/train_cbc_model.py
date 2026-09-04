"""
CBC Blood Analysis Model Trainer
=================================
Dataset : cbc information.xlsx (500 rows, 20 CBC parameters)
Strategy: No labels → Isolation Forest (anomaly) + KMeans (clustering)
          + Rule-based normal range engine built-in

Data-specific fixes:
  • Drop ID column
  • Remove physiologically impossible values (negative HGB, HCT > 3000, etc.)
  • IQR 3× outlier removal
  • IsolationForest contamination=0.05
  • KMeans k=3 (normal, mild-concern, abnormal clusters)
"""
import os
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "app", "models")
EXCEL_PATH = os.environ.get(
    "CBC_EXCEL",
    os.path.join(BASE_DIR, "..", "..", "cbc information.xlsx")
)
os.makedirs(MODELS_DIR, exist_ok=True)

# ── Physiological bounds (impossible values) ──────────────────────────────────
BOUNDS = {
    "WBC":    (0.5,   100.0),
    "HGB":    (2.0,   25.0),
    "HCT":    (10.0,  70.0),
    "RBC":    (1.0,   10.0),
    "PLT":    (10.0,  1500.0),
    "MCV":    (50.0,  130.0),
    "MCH":    (10.0,  50.0),
    "MCHC":   (20.0,  40.0),
    "NEUTp":  (0.0,   100.0),
    "LYMp":   (0.0,   100.0),
    "MPV":    (5.0,   20.0),
    "MIDp":   (0.0,   30.0),
    "LYMn":   (0.0,   20.0),
    "NEUTn":  (0.0,   30.0),
    "MIDn":   (0.0,   5.0),
}

# ── Reference ranges (for rule-based interpretation) ─────────────────────────
CBC_RANGES = {
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


def load_and_clean(path: str) -> pd.DataFrame:
    df = pd.read_excel(path)
    df.columns = df.columns.str.strip()
    print(f"Raw dataset  : {len(df)} rows, {list(df.columns)}")
    
    # Drop ID column
    id_cols = [c for c in df.columns if c.upper() in ("ID", "PATIENT_ID")]
    if id_cols:
        df = df.drop(columns=id_cols)
        print(f"Dropped cols : {id_cols}")

    # Apply physiological bounds → replace impossible values with NaN
    rows_before = len(df)
    for col, (lo, hi) in BOUNDS.items():
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            df[col] = df[col].where(df[col].between(lo, hi), np.nan)

    df = df.dropna()
    print(f"After bounds : {rows_before - len(df)} rows removed → {len(df)} remain")

    # IQR 3× outlier removal
    rows_before = len(df)
    for col in df.columns:
        Q1, Q3 = df[col].quantile([0.25, 0.75])
        IQR = Q3 - Q1
        df = df[df[col].between(Q1 - 3 * IQR, Q3 + 3 * IQR)]
    print(f"After IQR×3  : {rows_before - len(df)} rows removed → {len(df)} remain")

    return df.reset_index(drop=True)


def train():
    print("=" * 60)
    print("  CardioSense AI — CBC Blood Analysis Model Training")
    print("=" * 60)

    df = load_and_clean(EXCEL_PATH)
    feature_cols = list(df.columns)
    print(f"\nFeatures ({len(feature_cols)}): {feature_cols}")

    # ── Scale ─────────────────────────────────────────────────────────────────
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df)

    # ── Isolation Forest — anomaly detection ──────────────────────────────────
    print("\nTraining IsolationForest (contamination=0.05)...")
    iso_forest = IsolationForest(
        contamination=0.05,
        random_state=42,
        n_estimators=200,
        max_samples="auto",
    )
    iso_forest.fit(X_scaled)
    anomaly_labels = iso_forest.predict(X_scaled)
    n_anomaly = int((anomaly_labels == -1).sum())
    print(f"  Anomalies detected: {n_anomaly} / {len(df)} ({n_anomaly/len(df)*100:.1f}%)")

    # ── KMeans clustering (3 clusters: normal / mild / abnormal) ──────────────
    print("\nTraining KMeans (k=3)...")
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10, max_iter=300)
    kmeans.fit(X_scaled)
    cluster_labels = kmeans.labels_
    for k in range(3):
        count = int((cluster_labels == k).sum())
        print(f"  Cluster {k}: {count} samples ({count/len(df)*100:.1f}%)")

    # ── Map cluster IDs → clinical labels by computed severity, not by ID ────
    # KMeans cluster numbering (0/1/2) is arbitrary and not guaranteed stable
    # across retrains — hardcoding "cluster 0 = Normal" in the serving route
    # would silently mislabel results after any retrain that happens to
    # renumber the clusters. Instead, score each centroid by how far outside
    # the clinical reference ranges (CBC_RANGES) it falls, then rank the
    # three clusters by that score — the lowest-severity centroid is Normal,
    # the highest is Abnormal, regardless of which raw ID KMeans assigned it.
    centroids_original = scaler.inverse_transform(kmeans.cluster_centers_)
    severity_scores = []
    for centroid in centroids_original:
        score = 0.0
        for i, col in enumerate(feature_cols):
            ref = CBC_RANGES.get(col)
            if not ref:
                continue
            lo, hi = ref["min"], ref["max"]
            span = (hi - lo) / 2 or 1.0
            val = centroid[i]
            if val > hi:
                score += (val - hi) / span
            elif val < lo:
                score += (lo - val) / span
        severity_scores.append(score)

    ranked_cluster_ids = sorted(range(3), key=lambda k: severity_scores[k])
    cluster_label_map = {
        str(ranked_cluster_ids[0]): "Normal Pattern",
        str(ranked_cluster_ids[1]): "Mild Concern",
        str(ranked_cluster_ids[2]): "Abnormal Pattern",
    }
    print("\nCluster → label mapping (by computed severity, not raw ID):")
    for cid, label in cluster_label_map.items():
        print(f"  Cluster {cid} (severity={severity_scores[int(cid)]:.2f}): {label}")

    # ── Save artefacts ────────────────────────────────────────────────────────
    joblib.dump(iso_forest, os.path.join(MODELS_DIR, "cbc_anomaly_model.pkl"))
    joblib.dump(kmeans,     os.path.join(MODELS_DIR, "cbc_cluster_model.pkl"))
    joblib.dump(scaler,     os.path.join(MODELS_DIR, "cbc_scaler.pkl"))

    with open(os.path.join(MODELS_DIR, "cbc_ranges.json"), "w") as f:
        json.dump(CBC_RANGES, f, indent=2)

    with open(os.path.join(MODELS_DIR, "cbc_features.json"), "w") as f:
        json.dump(feature_cols, f)

    meta = {
        "n_samples_clean":  len(df),
        "n_features":       len(feature_cols),
        "features":         feature_cols,
        "contamination":    0.05,
        "kmeans_k":         3,
        "n_anomalies":      n_anomaly,
        "cluster_label_map": cluster_label_map,
        "cluster_severity_scores": {str(i): round(s, 4) for i, s in enumerate(severity_scores)},
        "dataset":          "cbc information.xlsx",
        "note":             "Isolation Forest + KMeans on CBC blood parameters. cluster_label_map is recomputed by centroid severity every training run — never assume cluster ID N means the same thing across retrains.",
    }
    with open(os.path.join(MODELS_DIR, "cbc_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n✅ Saved: cbc_anomaly_model.pkl + cbc_cluster_model.pkl + cbc_scaler.pkl")
    print(f"✅ Saved: cbc_ranges.json + cbc_features.json + cbc_meta.json")
    return n_anomaly


if __name__ == "__main__":
    train()
