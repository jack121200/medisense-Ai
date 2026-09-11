"""
ECG screening route: what it reports must agree with what it decided.

These exist because the route shipped a normal beat with an "abnormal
probability" of 0.93 and a Normal verdict, described reconstruction error
when a different model made the call, and labelled real MIT-BIH beats as
synthetic. Each test pins one of those down.
"""
import json
import os
import random
from pathlib import Path

os.environ.setdefault("INTERNAL_API_KEY", "testkey")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

HEADERS = {"x-internal-service-key": os.environ["INTERNAL_API_KEY"]}
client = TestClient(app)
DEMO = json.loads((Path(__file__).resolve().parents[1] / "app" / "models" / "ecg_demo_samples.json")
                  .read_text(encoding="utf-8"))


def screen(**body) -> dict:
    r = client.post("/api/deep/anomaly-stream", headers=HEADERS, json=body)
    assert r.status_code == 200, r.text
    return r.json()["data"]


@pytest.mark.parametrize("abnormal", [False, True])
def test_verdict_agrees_with_the_probability_shown(abnormal):
    random.seed(0)
    for _ in range(6):
        d = screen(trigger_anomaly=abnormal)
        assert d["detector"] == "supervised_1d_cnn_classifier"
        p, t = d["abnormal_probability"], d["decision_threshold"]
        assert 0.0 <= p <= 1.0 and 0.0 < t < 1.0
        if abs(p - t) > 1e-3:  # both are rounded to 4 dp in the response
            assert d["is_anomaly"] == (p >= t)
        assert d["severity"] == ("FLAGGED" if d["is_anomaly"] else "NORMAL")


def test_demo_beats_are_labelled_as_real_recordings():
    assert screen(trigger_anomaly=False)["data_source"] == "mitbih_demo_sample"


def test_uploaded_signal_is_labelled_as_provided():
    assert screen(signal_waveform=DEMO["normal"][0])["data_source"] == "provided_signal"


def test_reports_the_model_that_actually_decided():
    d = screen(trigger_anomaly=True)
    assert "autoencoder" not in d["model_architecture"].lower()
    assert "reconstruction error exceeds" not in d["recommendation"].lower()


def test_no_critical_grade_from_a_single_beat_screen():
    random.seed(1)
    grades = {screen(trigger_anomaly=True)["severity"] for _ in range(6)}
    assert grades <= {"FLAGGED", "NORMAL"}


def test_abnormal_demo_beats_score_higher_than_normal_ones():
    """
    End-to-end check through the real serving path: averaged over the demo
    pools, abnormal beats must score clearly higher than normal ones.
    """
    random.seed(2)
    normal = [screen(trigger_anomaly=False)["abnormal_probability"] for _ in range(12)]
    abnormal = [screen(trigger_anomaly=True)["abnormal_probability"] for _ in range(12)]
    assert sum(abnormal) / len(abnormal) - sum(normal) / len(normal) > 0.3
