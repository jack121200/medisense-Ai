"""
build_manifest.py — Generates models_manifest.json from each model's own
meta.json + artifact file(s). Run after any train/*.py script.

One entry per trained-model feature: name, version marker (artifact
sha256 — the actual content hash, not a hand-incremented number that can
drift from what's really deployed), dataset, algorithm, key metrics, and
the training script that produced it. Rule-based features (lipid, fuzzy
dosing) are intentionally not listed here — there's no artifact to
version, since the "model" is the guideline thresholds visible directly
in their route source (see lipid_analyze.py, fuzzy_dosing.py).
"""
import hashlib
import json
import os
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "app", "models")
OUT_PATH = os.path.join(BASE_DIR, "..", "models_manifest.json")

# (feature name, meta filename, [artifact filenames], training script)
ENTRIES = [
    ("symptom_checker", "disease_model_meta.json", ["disease_model.pkl"], "train/train_disease_model.py"),
    ("heart_disease_risk", "heart_risk_meta.json", ["heart_risk_model.pkl", "heart_scaler.pkl", "heart_encoder.pkl"], "train/train_heart_risk.py"),
    ("cbc_analyzer", "cbc_meta.json", ["cbc_anomaly_model.pkl", "cbc_cluster_model.pkl", "cbc_scaler.pkl"], "train/train_cbc_model.py"),
    ("bayesian_engine", "bayesian_meta.json", ["bayesian_network.pkl"], "train/train_bayesian_network.py"),
    ("ecg_anomaly_detector", "ecg_autoencoder_meta.json", ["ecg_autoencoder.pt"], "train/prepare_ecg_dataset.py + train/train_deep_anomaly.py"),
]


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def build():
    manifest = {"generated_at": datetime.now(timezone.utc).isoformat(), "models": {}}

    for name, meta_file, artifact_files, script in ENTRIES:
        meta_path = os.path.join(MODELS_DIR, meta_file)
        if not os.path.exists(meta_path):
            manifest["models"][name] = {"status": "not_trained", "training_script": script}
            print(f"  [missing] {name} — run {script}")
            continue

        with open(meta_path) as f:
            meta = json.load(f)

        artifacts = {}
        for fname in artifact_files:
            fpath = os.path.join(MODELS_DIR, fname)
            if os.path.exists(fpath):
                artifacts[fname] = {
                    "sha256": sha256_of(fpath),
                    "size_bytes": os.path.getsize(fpath),
                    "modified_at": datetime.fromtimestamp(os.path.getmtime(fpath), tz=timezone.utc).isoformat(),
                }

        manifest["models"][name] = {
            "status": "trained",
            "training_script": script,
            "meta": meta,
            "artifacts": artifacts,
        }
        print(f"  [ok] {name} — {len(artifacts)} artifact(s) hashed")

    with open(OUT_PATH, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nWrote {OUT_PATH}")


if __name__ == "__main__":
    print("Building models_manifest.json...")
    build()
