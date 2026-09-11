"""
deep_anomaly.py — Feature 3: ECG Anomaly Detector (1D-CNN Autoencoder)
=========================================================================
Syllabus Mapping: Unit IV & VI — Deep Learning, 1D-CNN, Autoencoders,
                   Unsupervised Anomaly Detection.

This route previously "reconstructed" a synthetic sine-wave ECG generated
with Python's `random.uniform()` at request time — there was no model, no
training, and no deep-learning dependency anywhere in this project. It's
now backed by a real 1D-CNN autoencoder (PyTorch) trained on 28k real
labeled heartbeats from PhysioNet's open MIT-BIH Arrhythmia Database (see
train/prepare_ecg_dataset.py + train/train_deep_anomaly.py). See
ecg_autoencoder_meta.json for the model's actual held-out precision/recall
— it is a binary anomaly detector (normal vs. abnormal beat morphology),
not a multi-class arrhythmia classifier, and this route no longer invents
specific diagnoses (AFib/PVC/etc.) it has no basis to name.
"""
from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import torch
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ml.ecg_autoencoder import load_autoencoder, WINDOW_LEN
from app.ml.ecg_classifier import per_window_normalize

router = APIRouter(prefix="/api/deep", tags=["ECG Anomaly Detector"])

MODELS_DIR = Path(__file__).parent.parent.parent / "models"
_cache: Dict[str, Any] = {}


def _load_model():
    if "ecg_autoencoder" not in _cache:
        path = MODELS_DIR / "ecg_autoencoder.pt"
        if not path.exists():
            return None
        _cache["ecg_autoencoder"] = load_autoencoder(str(path))
    return _cache["ecg_autoencoder"]


def _load_classifier():
    """
    Supervised beat classifier — the primary detector. Kept separate from the
    autoencoder loader so a missing classifier degrades to the autoencoder
    rather than failing the route.
    """
    if "ecg_classifier" not in _cache:
        path = MODELS_DIR / "ecg_classifier.pt"
        if not path.exists():
            _cache["ecg_classifier"] = None
        else:
            from app.ml.ecg_classifier import load_classifier
            _cache["ecg_classifier"] = load_classifier(path)
    return _cache["ecg_classifier"]


def _load_meta():
    if "ecg_meta" not in _cache:
        path = MODELS_DIR / "ecg_autoencoder_meta.json"
        if not path.exists():
            return None
        with open(path) as f:
            _cache["ecg_meta"] = json.load(f)
    return _cache["ecg_meta"]


def _load_demo_samples():
    if "ecg_demo" not in _cache:
        path = MODELS_DIR / "ecg_demo_samples.json"
        if not path.exists():
            return None
        with open(path) as f:
            _cache["ecg_demo"] = json.load(f)
    return _cache["ecg_demo"]


# ══════════════════════════════════════════════════════════════════
#  SCHEMAS
# ══════════════════════════════════════════════════════════════════

class SignalVectorRequest(BaseModel):
    signal_waveform: Optional[List[float]] = Field(default=None, description="ECG time-series vector (any length — resampled to the model's 256-sample window)")
    sample_rate_hz:  int                   = Field(default=100, description="Sampling rate in Hz")
    trigger_anomaly: bool                  = Field(default=False, description="Demo mode only: when no signal_waveform is supplied, analyse a held-out abnormal MIT-BIH beat instead of a normal one")


def _demo_signal(inject_anomaly: bool) -> List[float]:
    """
    Demo-only fallback for exercising the UI when no real signal_waveform
    is supplied. Uses a REAL beat window from PhysioNet MIT-BIH test records
    neither model trained on (saved by train_ecg_classifier.py), not a hand-crafted synthetic sine
    wave — a synthetic shape doesn't resemble real beat morphology at all,
    so this real model would flag it as anomalous even in "normal" demo
    mode, which is both confusing and an unfair demo of what the model
    actually does. Labelled data_source "mitbih_demo_sample" in the response, so a
    held-out demo beat is never presented as the caller's own recording.
    """
    samples = _load_demo_samples()
    if samples:
        pool = samples["abnormal"] if inject_anomaly else samples["normal"]
        return list(random.choice(pool))

    # Only reachable if the model is trained but ecg_demo_samples.json is
    # missing (e.g. an artifact built before this fallback existed) — a
    # flat line is an honest "no demo data available" placeholder, not a
    # disguised fake signal.
    return [0.0] * WINDOW_LEN


def _resample_to_window(signal: List[float], target_len: int = WINDOW_LEN) -> np.ndarray:
    """Linear-interpolate an arbitrary-length input onto the model's fixed window size."""
    x_old = np.linspace(0, 1, num=len(signal))
    x_new = np.linspace(0, 1, num=target_len)
    return np.interp(x_new, x_old, signal).astype(np.float32)


def _manifest_meta(model_key: str) -> dict:
    """
    Read a model's recorded metrics from models_manifest.json rather than
    hardcoding them here, so a retrain cannot leave the API quoting numbers
    the model no longer achieves.
    """
    if "manifest" not in _cache:
        path = MODELS_DIR.parent.parent / "models_manifest.json"
        try:
            _cache["manifest"] = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            _cache["manifest"] = {}
    return _cache["manifest"].get("models", {}).get(model_key, {}).get("meta", {})


def _eval_metrics(detector: str, meta: dict) -> dict:
    """
    Report whichever model actually produced the verdict. Quoting the
    autoencoder's numbers while the classifier decides would misrepresent
    the result.
    """
    if detector == "supervised_1d_cnn_classifier":
        clf = _manifest_meta("ecg_beat_classifier")
        return {
            "precision": clf.get("precision"),
            "recall": clf.get("recall"),
            "f1": clf.get("f1"),
            "roc_auc": clf.get("roc_auc"),
            "specificity": clf.get("specificity"),
            # Share of each AAMI beat class flagged on the unseen patients — the
            # single recall figure hides that ventricular beats are caught and
            # supraventricular ones mostly are not.
            "detection_by_class": clf.get("detection_by_class"),
            "evaluation": clf.get("evaluation"),
            "note": clf.get("note"),
        }
    return {
        "precision": meta.get("eval_precision"),
        "recall": meta.get("eval_recall"),
        "f1": meta.get("eval_f1"),
        "roc_auc": meta.get("eval_roc_auc"),
        "note": "Autoencoder fallback — the supervised classifier is not loaded. "
                "See ecg_autoencoder_meta.json for the full run.",
    }


@router.post("/anomaly-stream", summary="ECG beat screening — supervised 1D-CNN, autoencoder as a secondary signal")
def analyze_deep_waveform(req: SignalVectorRequest):
    """
    Resamples the input signal onto a 256-sample beat window and screens it
    with the supervised 1D-CNN, which makes the call against the threshold
    recorded in models_manifest.json. The autoencoder's reconstruction error
    is returned alongside as a secondary signal, and decides only if the
    classifier checkpoint is missing.
    """
    model = _load_model()
    meta = _load_meta()
    if model is None or meta is None:
        raise HTTPException(
            503,
            "ECG autoencoder not trained — run train/prepare_ecg_dataset.py "
            "then train/train_deep_anomaly.py first"
        )

    data_source = "provided_signal"
    raw_signal = req.signal_waveform
    if not raw_signal or len(raw_signal) < 10:
        raw_signal = _demo_signal(inject_anomaly=req.trigger_anomaly)
        data_source = "mitbih_demo_sample"

    # ── Feed each model input in the scale it was trained on ───────────────
    # The autoencoder (secondary signal) was trained on beats z-scored per
    # RECORD: demo beats are already in that scale, and an uploaded signal is
    # treated as its own record and normalised once. The classifier is
    # trained on per-window normalised beats, chosen because that measured
    # better on held-out patients, and gets exactly that below via the same
    # function training uses.
    windowed = _resample_to_window(raw_signal, WINDOW_LEN)
    if data_source == "mitbih_demo_sample":
        mu, sigma = 0.0, 1.0
    else:
        arr = np.asarray(raw_signal, dtype=np.float32)
        mu, sigma = float(arr.mean()), float(arr.std())
        sigma = sigma if sigma > 1e-8 else 1.0
    normalized = (windowed - mu) / sigma

    # ── Real autoencoder forward pass ─────────────────────────────────────────
    with torch.no_grad():
        x = torch.tensor(normalized, dtype=torch.float32).view(1, 1, WINDOW_LEN)
        x_hat = model(x)
        per_sample_error = ((x - x_hat) ** 2).squeeze().numpy()
        mse_loss = float(per_sample_error.mean())
        reconstructed_norm = x_hat.squeeze().numpy()

    # Undo normalization so the returned "reconstructed" trace is in the
    # same scale as the input signal, for display purposes.
    reconstructed = (reconstructed_norm * sigma + mu).tolist()

    threshold = float(meta["threshold"])
    reconstruction_flag = mse_loss > threshold

    # The supervised classifier is the primary detector. The autoencoder,
    # trained only on normal beats, measured 0.75 ROC-AUC / 0.26 recall — it
    # missed roughly three of every four abnormal beats — so it now serves as
    # a secondary unsupervised signal rather than the verdict.
    classifier = _load_classifier()
    if classifier is not None:
        # Probability on the scale training chose (raw, or Platt-calibrated if
        # that improved cross-validated calibration), compared against the
        # threshold tuned on that same scale — see app/ml/ecg_classifier.py.
        abnormal_probability = classifier.probability(
            torch.tensor(per_window_normalize(windowed), dtype=torch.float32).view(1, 1, WINDOW_LEN))
        decision_threshold = classifier.threshold
        is_anomaly = abnormal_probability >= decision_threshold
        detector = "supervised_1d_cnn_classifier"
    else:
        abnormal_probability = None
        decision_threshold = None
        is_anomaly = reconstruction_flag
        detector = "reconstruction_error_autoencoder"

    # Attention heatmap: per-sample squared error, scaled by the threshold
    # so a value near/over 1.0 marks the samples actually driving the flag.
    attention_heatmap = [min(1.0, round(float(e) / max(threshold, 1e-9), 3)) for e in per_sample_error]

    # This used to describe reconstruction error even when the classifier
    # made the call, and graded severity CRITICAL off the autoencoder's loss.
    # A single-beat morphology screen cannot support a CRITICAL grade at all:
    # it raises a flag for review, and says so.
    if detector == "supervised_1d_cnn_classifier":
        basis = (f"The screening model estimates a {abnormal_probability:.0%} probability that this "
                 f"beat's morphology is abnormal (review flag raised at {decision_threshold:.0%}).")
    else:
        basis = "Reconstruction error exceeds the autoencoder's learned normal-beat threshold."
    if is_anomaly:
        classified_pattern = "Abnormal beat morphology"
        severity = "FLAGGED"
        recommendation = (f"{basis} Review the full rhythm strip and correlate clinically. This is a "
                          "binary morphology screen: it does not identify the arrhythmia type.")
    else:
        classified_pattern = "Normal beat morphology"
        severity = "NORMAL"
        recommendation = f"{basis} No review flag raised for this beat."

    return {
        "success": True,
        "data": {
            "model_architecture": (_manifest_meta("ecg_beat_classifier").get("architecture", "Supervised 1D-CNN")
                                   if detector == "supervised_1d_cnn_classifier"
                                   else meta.get("architecture", "1D-CNN autoencoder (PyTorch)")),
            "data_source": data_source,
            "detector": detector,
            "abnormal_probability": round(abnormal_probability, 4) if abnormal_probability is not None else None,
            "decision_threshold": round(decision_threshold, 4) if decision_threshold is not None else None,
            "reconstruction_loss_mse": round(mse_loss, 6),
            "reconstruction_flag": reconstruction_flag,
            "threshold": round(threshold, 6),
            "threshold_method": meta.get("threshold_method"),
            "is_anomaly": is_anomaly,
            "severity": severity,
            "classified_pattern": classified_pattern,
            "recommendation": recommendation,
            "signal_length": WINDOW_LEN,
            # The whole 256-sample window. Only the first 60 samples were sent,
            # which is baseline before the R-peak at sample 128: the monitor
            # never drew the beat it was screening.
            "raw_signal_samples": [round(float(v), 4) for v in windowed],
            "reconstructed_samples": [round(float(v), 4) for v in reconstructed],
            "attention_heatmap": attention_heatmap,
            "model_eval_metrics": _eval_metrics(detector, meta),
        },
    }
