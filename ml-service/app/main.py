"""
FastAPI Main Entry Point — MediSense AI ML Service
====================================================
Active ML features (4):
  1. AI Symptom Checker         → /api/medisense/predict-disease
  2. Heart Disease Risk AI      → /api/medisense/predict-risk
  3. CBC Blood Analyzer         → /api/cbc/analyze
  4. Lipid Profile Analyzer     → /api/lipid/analyze
"""
from __future__ import annotations

import time
import threading
import hmac
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
def _preload_models():
    import os

    models_dir = Path(os.getenv("MODEL_PATH", str(Path(__file__).parent / "models")))
    ready = []

    for fname in ["disease_model.pkl", "heart_risk_model.pkl", "cbc_anomaly_model.pkl", "lipid_model.pkl"]:
        if (models_dir / fname).exists():
            ready.append(fname)

    with _metrics_lock:
        _metrics["models_ready"] = ("lipid_model.pkl" in ready)
    print(f"Models pre-checked: {ready}")
    core_models = {"disease_model.pkl", "heart_risk_model.pkl", "cbc_anomaly_model.pkl", "lipid_model.pkl"}
    missing = core_models - set(ready)
    if missing:
        print(f"Missing models (run training scripts): {missing}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"\n{'='*55}")
    print(f"  MediSense AI — ML Service  v{settings.VERSION}")
    print(f"  4 Active ML Features:")
    print(f"    Symptom Checker   ->  /api/medisense/predict-disease")
    print(f"    Heart Disease     ->  /api/medisense/predict-risk")
    print(f"    CBC Blood Analyzer->  /api/cbc/analyze")
    print(f"    Lipid Profile AI  ->  /api/lipid/analyze")
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


# ── Health & Metrics ──────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
def health():
    uptime_s = round(time.time() - _metrics["start_time"], 1)
    return {
        "status":        "ok" if _metrics["models_ready"] else "warming_up",
        "service":       "medisense-ml",
        "version":       settings.VERSION,
        "models_ready":  _metrics["models_ready"],
        "uptime_s":      uptime_s,
        "active_features": [
            "AI Symptom Checker",
            "Heart Disease Risk AI",
            "CBC Blood Analyzer",
            "Lipid Profile Analyzer",
        ],
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