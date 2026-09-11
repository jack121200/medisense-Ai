"""
Supervised ECG beat classifier architecture, and its calibration.

Lives here rather than in train/ because the serving route has to
reconstruct this exact module to load the checkpoint, and train/ is a
training-time directory that is not guaranteed to be importable from the
running service. The training script imports it from here too, so there is
one definition of the architecture rather than two that can drift.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

WINDOW_LEN = 256


class BeatCNN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv1d(1, 32, kernel_size=7, padding=3), nn.BatchNorm1d(32), nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(32, 64, kernel_size=5, padding=2), nn.BatchNorm1d(64), nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(64, 128, kernel_size=3, padding=1), nn.BatchNorm1d(128), nn.ReLU(),
            nn.AdaptiveAvgPool1d(1),
        )
        self.head = nn.Sequential(nn.Flatten(), nn.Dropout(0.3), nn.Linear(128, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.features(x))


class CalibratedClassifier:
    """
    An ensemble of BeatCNNs (mean logit) plus an optional Platt calibration.

    The ensemble members are the patient-fold models from training, so the
    models served are the ones whose out-of-fold predictions set the
    threshold. Training decides whether calibration is applied, by
    measurement: Platt scaling is kept only if it improves calibration on
    folds it was not fitted on; otherwise a=1, b=0 and this is the raw
    sigmoid. Both choices are recorded in models_manifest.json.
    """

    def __init__(self, models: list[BeatCNN], a: float, b: float, threshold: float) -> None:
        self.models = models
        self.a = a
        self.b = b
        self.threshold = threshold

    def probability(self, window: torch.Tensor) -> float:
        with torch.no_grad():
            logit = float(torch.stack([m(window) for m in self.models]).mean().item())
        z = self.a * logit + self.b
        # Numerically stable sigmoid: exp() of a large positive argument overflows.
        if z >= 0:
            return 1.0 / (1.0 + math.exp(-z))
        e = math.exp(z)
        return e / (1.0 + e)


def per_window_normalize(x) -> np.ndarray:
    """
    Z-score each 256-sample beat window on its own statistics.

    Chosen by measurement. The source beats are z-scored per record, and
    serving re-normalised each window on its own, which looked like a
    train/serve skew to be removed. Measured on the held-out patients of the
    earlier 12-record split, the record-trained model scored higher on
    per-window inputs (ROC-AUC 0.917 vs 0.899): standardising each beat strips inter-patient amplitude
    and baseline differences from electrode placement, which do not
    generalise. So the classifier is trained this way and served this way,
    from this one function, so the two cannot drift apart again.
    """
    arr = np.asarray(x, dtype=np.float32)
    single = arr.ndim == 1
    if single:
        arr = arr[None, :]
    mu = arr.mean(axis=1, keepdims=True)
    sd = arr.std(axis=1, keepdims=True)
    sd[sd < 1e-8] = 1.0
    out = ((arr - mu) / sd).astype(np.float32)
    return out[0] if single else out


def load_classifier(path: str | Path) -> CalibratedClassifier:
    blob = torch.load(str(path), map_location="cpu", weights_only=False)
    # Ensemble checkpoints store one state_dict per fold model; older ones a
    # single model, which loads as an ensemble of one.
    models = []
    for state in blob.get("state_dicts") or [blob["state_dict"]]:
        model = BeatCNN()
        model.load_state_dict(state)
        model.eval()
        models.append(model)
    # No calibration block means the threshold was set on the raw sigmoid.
    cal = blob.get("calibration") or {"a": 1.0, "b": 0.0}
    return CalibratedClassifier(models, float(cal["a"]), float(cal["b"]), float(blob["threshold"]))
