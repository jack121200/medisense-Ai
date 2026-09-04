"""
Shared 1D-CNN autoencoder architecture for the ECG anomaly detector —
imported by both train/train_deep_anomaly.py (training) and
app/api/routes/deep_anomaly.py (serving), so the two never drift apart.

This is the first real use of app/ml/ — previously an empty scaffold
folder despite implying, by its existence, that something lived here.
"""
import torch
import torch.nn as nn

WINDOW_LEN = 256


class ConvAutoencoder(nn.Module):
    """1D-CNN autoencoder: 256 -> 128 -> 64 -> 16 (bottleneck) -> 64 -> 128 -> 256."""

    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv1d(1, 16, kernel_size=7, stride=2, padding=3), nn.ReLU(),   # 256 -> 128
            nn.Conv1d(16, 32, kernel_size=7, stride=2, padding=3), nn.ReLU(),  # 128 -> 64
            nn.Conv1d(32, 8, kernel_size=7, stride=4, padding=3), nn.ReLU(),   # 64 -> 16
        )
        self.decoder = nn.Sequential(
            nn.ConvTranspose1d(8, 32, kernel_size=7, stride=4, padding=3, output_padding=3), nn.ReLU(),
            nn.ConvTranspose1d(32, 16, kernel_size=7, stride=2, padding=3, output_padding=1), nn.ReLU(),
            nn.ConvTranspose1d(16, 1, kernel_size=7, stride=2, padding=3, output_padding=1),
        )

    def forward(self, x):
        z = self.encoder(x)
        return self.decoder(z)


def load_autoencoder(weights_path: str) -> ConvAutoencoder:
    model = ConvAutoencoder()
    model.load_state_dict(torch.load(weights_path, map_location="cpu"))
    model.eval()
    return model
