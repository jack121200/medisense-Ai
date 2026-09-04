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
    trigger_anomaly: bool                  = Field(default=False, description="Demo mode only: inject a synthetic arrhythmia burst into a generated demo signal when no real signal_waveform is provided")


def _demo_signal(inject_anomaly: bool) -> List[float]:
    """
    Demo-only fallback for exercising the UI when no real signal_waveform
    is supplied. Uses a REAL held-out beat window from PhysioNet MIT-BIH
    (saved by train_deep_anomaly.py), not a hand-crafted synthetic sine
    wave — a synthetic shape doesn't resemble real beat morphology at all,
    so this real model would flag it as anomalous even in "normal" demo
    mode, which is both confusing and an unfair demo of what the model
    actually does. Explicitly labeled in the response (data_source:
    "synthetic_demo") either way — never presented as a real analysis.
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


@router.post("/anomaly-stream", summary="ECG Anomaly Detection via 1D-CNN Autoencoder")
def analyze_deep_waveform(req: SignalVectorRequest):
    """
    Resamples the input signal onto the autoencoder's 256-sample window,
    runs it through the real trained model, and flags an anomaly when
    reconstruction error exceeds the threshold set during training (95th
    percentile of error on held-out normal beats — see
    ecg_autoencoder_meta.json).
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
        data_source = "synthetic_demo"

    # ── Resample + per-signal z-score normalize (matches training prep) ──────
    windowed = _resample_to_window(raw_signal, WINDOW_LEN)
    mu, sigma = float(windowed.mean()), float(windowed.std())
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
    is_anomaly = mse_loss > threshold

    # Attention heatmap: per-sample squared error, scaled by the threshold
    # so a value near/over 1.0 marks the samples actually driving the flag.
    attention_heatmap = [min(1.0, round(float(e) / max(threshold, 1e-9), 3)) for e in per_sample_error]

    if is_anomaly:
        classified_pattern = "Abnormal beat morphology detected"
        severity = "CRITICAL" if mse_loss > threshold * 3 else "WARNING"
        recommendation = (
            "Reconstruction error exceeds the model's learned normal-beat threshold — "
            "morphology differs from typical sinus rhythm. Clinical correlation and "
            "telemetry review advised. This model detects abnormal morphology only; "
            "it does not classify a specific arrhythmia type."
        )
    else:
        classified_pattern = "Normal sinus rhythm morphology"
        severity = "NORMAL"
        recommendation = "Beat morphology reconstructs within the model's normal range."

    return {
        "success": True,
        "data": {
            "model_architecture": meta.get("architecture", "1D-CNN autoencoder (PyTorch)"),
            "data_source": data_source,
            "reconstruction_loss_mse": round(mse_loss, 6),
            "threshold": round(threshold, 6),
            "threshold_method": meta.get("threshold_method"),
            "is_anomaly": is_anomaly,
            "severity": severity,
            "classified_pattern": classified_pattern,
            "recommendation": recommendation,
            "signal_length": WINDOW_LEN,
            "raw_signal_samples": [round(float(v), 4) for v in windowed[:60]],
            "reconstructed_samples": [round(float(v), 4) for v in reconstructed[:60]],
            "attention_heatmap": attention_heatmap[:60],
            "model_eval_metrics": {
                "precision": meta.get("eval_precision"),
                "recall": meta.get("eval_recall"),
                "f1": meta.get("eval_f1"),
                "roc_auc": meta.get("eval_roc_auc"),
                "note": "Held-out evaluation from training — see ecg_autoencoder_meta.json for the full run.",
            },
        },
    }
