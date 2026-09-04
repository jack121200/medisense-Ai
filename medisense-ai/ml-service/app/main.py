"""
FastAPI Main Entry Point — MediSense AI ML Service
====================================================
Trained-model-backed features (5) — see CORE_MODEL_FILES / models_manifest.json:
  1. AI Symptom Checker         → /api/medisense/predict-disease   (RandomForest)
  2. Heart Disease Risk AI      → /api/medisense/predict-risk      (RandomForest)
  3. CBC Blood Analyzer         → /api/cbc/analyze                 (IsolationForest + KMeans)
  4. Bayesian Decision Engine   → /api/bayesian/infer               (pgmpy Bayesian network)
  5. ECG Anomaly Detector       → /api/deep/anomaly-stream          (1D-CNN autoencoder, PyTorch)

Rule-based (no trained model, documented guideline thresholds):
  6. Lipid Profile Analyzer     → /api/lipid/analyze                (ATP III / ACC-AHA rules)
  7. Fuzzy Dosing Engine        → /api/fuzzy/dosage-triage          (Mamdani fuzzy logic)
  8. Population Hypothesis Tests → /api/hypothesis/*                (statistical tests over the training CSV)
"""
from __future__ import annotations

import time
import threading
import hmac
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.routes import medisense_predict, cbc_analyze, hypothesis, pdf_extract, lipid_analyze, bayesian_engine, fuzzy_dosing, deep_anomaly

# ── In-memory metrics ─────────────────────────────────────────────────────────
_metrics: Dict[str, Any] = {
    "requests_total": 0,
    "predict_calls":  0,
    "start_time":     time.time(),
    "models_ready":   False,
}
_metrics_lock = threading.Lock()


def _inc(key: str):
    with _metrics_lock:
        _metrics[key] = _metrics.get(key, 0) + 1


# ── Model pre-load on startup ─────────────────────────────────────────────────
# lipid_model.pkl is intentionally not in this list any more — lipid_analyze.py
# is now a rule-based classifier with no trained model to wait on (see its
# module docstring for why the old RandomForest wrapper was removed).
CORE_MODEL_FILES = {
    "disease_model.pkl",
    "heart_risk_model.pkl",
    "cbc_anomaly_model.pkl",
    "bayesian_network.pkl",
    "ecg_autoencoder.pt",
}


def _preload_models():
    import os

    models_dir = Path(os.getenv("MODEL_PATH", str(Path(__file__).parent / "models")))
    ready = {fname for fname in CORE_MODEL_FILES if (models_dir / fname).exists()}

    with _metrics_lock:
        _metrics["models_ready"] = (ready == CORE_MODEL_FILES)
    print(f"Models pre-checked: {sorted(ready)}")
    missing = CORE_MODEL_FILES - ready
    if missing:
        print(f"Missing models (run training scripts): {missing}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"\n{'='*55}")
    print(f"  MediSense AI — ML Service  v{settings.VERSION}")
    print(f"  Trained-model features:")
    print(f"    Symptom Checker    ->  /api/medisense/predict-disease")
    print(f"    Heart Disease Risk ->  /api/medisense/predict-risk")
    print(f"    CBC Blood Analyzer ->  /api/cbc/analyze")
    print(f"    Bayesian Engine    ->  /api/bayesian/infer")
    print(f"    ECG Anomaly        ->  /api/deep/anomaly-stream")
    print(f"  Rule-based features:")
    print(f"    Lipid Profile      ->  /api/lipid/analyze")
    print(f"    Fuzzy Dosing       ->  /api/fuzzy/dosage-triage")
    print(f"{'='*55}\n")
    t = threading.Thread(target=_preload_models, daemon=True)
    t.start()
    yield
    print("\nShutting down MediSense ML service ...")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "MediSense AI — ML Service",
    version     = settings.VERSION,
    description = (
        "MediSense AI — Medical ML Microservice. "
        "4 features: AI Symptom Checker, Heart Disease Risk Prediction, CBC Blood Analyzer, Lipid Profile Analyzer."
    ),
    docs_url    = "/api/docs",
    redoc_url   = "/api/redoc",
    lifespan    = lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
# Previously allow_origins=["*"] with allow_credentials=True — an invalid
# combination browsers reject anyway, and unnecessary now: this service is
# no longer host-exposed (docker-compose.yml), so the only real caller is
# the backend, never a browser directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.ALLOWED_ORIGIN], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routes that don't require the internal service key — health/docs need to
# be reachable for container healthchecks and local debugging without a key.
_PUBLIC_PATHS = {"/api/health", "/api/docs", "/api/redoc", "/openapi.json"}


@app.middleware("http")
async def internal_auth_middleware(request: Request, call_next):
    if request.url.path not in _PUBLIC_PATHS:
        provided = request.headers.get("x-internal-service-key", "")
        if not hmac.compare_digest(provided, settings.INTERNAL_API_KEY):
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid internal service key"})
    return await call_next(request)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    _inc("requests_total")
    if "/predict" in request.url.path or "/analyze" in request.url.path:
        _inc("predict_calls")
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - t0) * 1000, 2)
    response.headers["X-Response-Time-Ms"] = str(ms)
    return response


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(medisense_predict.router, prefix="/api/medisense", tags=["CardioSense ML"])
app.include_router(cbc_analyze.router,       prefix="/api/cbc",       tags=["CBC Analyzer"])
app.include_router(hypothesis.router,        tags=["Research & Analytics"])
app.include_router(pdf_extract.router,       tags=["PDF Extraction"])
app.include_router(lipid_analyze.router,     prefix="/api/lipid",     tags=["Lipid Profile"])
app.include_router(bayesian_engine.router,   tags=["Bayesian Engine"])
app.include_router(fuzzy_dosing.router,      tags=["Fuzzy Dosing Engine"])
app.include_router(deep_anomaly.router,      tags=["Deep Waveform Autoencoder"])


def _load_manifest_versions() -> Dict[str, str]:
    """Echoes each model's artifact sha256 from models_manifest.json (run
    scripts/build_manifest.py to regenerate) — lets /api/health answer
    "which exact model build is this?" without trusting a hand-maintained
    version string that can drift from what's actually loaded."""
    manifest_path = Path(__file__).parent.parent / "models_manifest.json"
    if not manifest_path.exists():
        return {}
    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
        versions = {}
        for name, entry in manifest.get("models", {}).items():
            if entry.get("status") == "trained":
                hashes = [a["sha256"][:12] for a in entry.get("artifacts", {}).values()]
                versions[name] = hashes[0] if hashes else "unknown"
            else:
                versions[name] = "not_trained"
        return versions
    except Exception:
        return {}


# ── Health & Metrics ──────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
def health():
    uptime_s = round(time.time() - _metrics["start_time"], 1)
    return {
        "status":        "ok" if _metrics["models_ready"] else "warming_up",
        "service":       "medisense-ml",
        "version":       settings.VERSION,
        "models_ready":  _metrics["models_ready"],
        "model_versions": _load_manifest_versions(),
        "uptime_s":      uptime_s,
        "active_features": [
            "AI Symptom Checker",
            "Heart Disease Risk AI",
            "CBC Blood Analyzer",
            "Bayesian Decision Engine",
            "ECG Anomaly Detector",
            "Lipid Profile Analyzer (rule-based)",
            "Fuzzy Dosing Engine (rule-based)",
        ],
        "models_ready_detail": sorted(CORE_MODEL_FILES),
    }


@app.get("/api/metrics", tags=["Admin"])
def metrics():
    uptime_s = round(time.time() - _metrics["start_time"], 1)
    return {
        "requests_total":    _metrics["requests_total"],
        "predict_calls":     _metrics["predict_calls"],
        "uptime_s":          uptime_s,
        "requests_per_min":  round(_metrics["requests_total"] / max(uptime_s / 60, 0.001), 2),
    }