"""
config.py — Application Settings  ★ ENHANCED ★
"""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME:    str = "MediSense AI - ML Service"
    VERSION:     str = "2.0.0"
    DEBUG:       bool = False
    MODEL_PATH:  str = "./app/models"

    # Infrastructure
    DATABASE_URL: str = "postgresql://medisense:medisense_password@localhost:5432/medisense_db"
    REDIS_URL:    str = "redis://:redis_password@localhost:6379"
    KAFKA_BROKER: str = "localhost:9092"

    # ML settings
    TRAINING_N_SAMPLES:     int   = 10000
    TRAINING_TEST_SIZE:     float = 0.20
    TRAINING_RANDOM_STATE:  int   = 42
    SMOTE_K_NEIGHBORS:      int   = 5
    HPO_N_ITER:             int   = 20        # RandomizedSearchCV iterations
    HPO_CV_FOLDS:           int   = 5
    MAX_BATCH_SIZE:         int   = 100       # /predict/batch limit
    LOS_BOOTSTRAP_N:        int   = 500       # confidence interval bootstraps
    TSNE_SUBSAMPLE:         int   = 2000      # t-SNE point cap

    # Feature flags
    ENABLE_SHAP:            bool  = True
    ENABLE_CATBOOST:        bool  = True
    ENABLE_STACKING:        bool  = True
    ENABLE_TSNE:            bool  = True
    ENABLE_ML_ANOMALY:      bool  = True

    # Monitoring
    LOG_LEVEL:              str   = "INFO"
    ENABLE_METRICS:         bool  = True

    class Config:
        env_file = ".env"
        env_prefix = "MEDISENSE_"


settings = Settings()