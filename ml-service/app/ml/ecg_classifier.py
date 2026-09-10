"""
Supervised ECG beat classifier architecture.

Lives here rather than in train/ because the serving route has to
reconstruct this exact module to load the checkpoint, and train/ is a
training-time directory that is not guaranteed to be importable from the
running service. The training script imports it from here too, so there is
one definition of the architecture rather than two that can drift.
"""
from __future__ import annotations

from pathlib import Path

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


def load_classifier(path: str | Path) -> tuple[BeatCNN, float]:
    """Returns the loaded model and the decision threshold it was tuned with."""
    blob = torch.load(str(path), map_location="cpu", weights_only=False)
    model = BeatCNN()
    model.load_state_dict(blob["state_dict"])
    model.eval()
    return model, float(blob["threshold"])
