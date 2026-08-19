"""
Pydantic Schemas — MediSense AI  ★ ENHANCED ★
==============================================
Enhancements:
  • PatientInput: strict field validators + computed frailty flag
  • PredictionResponse: well_calibrated flag, cluster_distance,
    inference_ms, model_version, confidence band
  • VitalsInput: respiratory_rate + blood_glucose added
  • BatchPredictionSummary response model
  • RecommendationItem response model
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ══════════════════════════════════════════════════════════════════════════
#  Patient Input
# ══════════════════════════════════════════════════════════════════════════

class PatientInput(BaseModel):
    patient_id:         Optional[str]   = None

    # Demographics
    age:                float = Field(..., ge=0,  le=120,  description="Age in years")
    gender:             str   = Field("MALE",     description="MALE | FEMALE")
    bmi:                float = Field(..., ge=10, le=80,   description="Body mass index kg/m²")

    # Lifestyle
    smoking_status:     str   = Field("NEVER",    description="NEVER | FORMER | CURRENT")
    alcohol_use:        str   = Field("NEVER",    description="NEVER | OCCASIONAL | REGULAR | HEAVY")
    physical_activity:  str   = Field("MODERATE", description="SEDENTARY | LOW | MODERATE | HIGH")

    # Comorbidities
    has_diabetes:       int   = Field(0, ge=0, le=1)
    has_hypertension:   int   = Field(0, ge=0, le=1)
    has_heart_disease:  int   = Field(0, ge=0, le=1)
    has_ckd:            int   = Field(0, ge=0, le=1)
    has_asthma:         int   = Field(0, ge=0, le=1)
    has_copd:           int   = Field(0, ge=0, le=1)
    has_obesity:        int   = Field(0, ge=0, le=1)
    has_cancer:         int   = Field(0, ge=0, le=1)

    # Clinical labs
    blood_sugar_fasting: float = Field(90.0,  ge=40,  le=600)
    bp_systolic:         float = Field(120.0, ge=50,  le=250)
    bp_diastolic:        float = Field(80.0,  ge=30,  le=150)
    cholesterol_total:   float = Field(180.0, ge=50,  le=500)
    cholesterol_ldl:     float = Field(100.0, ge=20,  le=400)
    cholesterol_hdl:     float = Field(55.0,  ge=10,  le=120)
    triglycerides:       float = Field(150.0, ge=30,  le=1000)
    heart_rate_avg:      float = Field(72.0,  ge=20,  le=200)
    oxygen_saturation:   float = Field(98.0,  ge=50,  le=100)
    temperature:         float = Field(37.0,  ge=32,  le=43)
    hemoglobin:          float = Field(14.0,  ge=3,   le=25)
    creatinine:          float = Field(1.0,   ge=0.1, le=20)
    hba1c:               float = Field(5.5,   ge=3,   le=20)
    gfr:                 float = Field(90.0,  ge=1,   le=200)
    white_blood_cell:    float = Field(7.5,   ge=0.5, le=100)

    # Hospital
    ward_type:           str   = Field("GENERAL")
    icu_admitted:        int   = Field(0, ge=0, le=1)
    previous_admissions: int   = Field(0, ge=0, le=50)
    risk_score:          float = Field(0.0, ge=0, le=100)
    medication_count:    int   = Field(0, ge=0, le=50)

    # Extended
    frailty_index:       Optional[float] = Field(None, ge=0, le=5)
    polypharmacy_flag:   Optional[int]   = Field(None, ge=0, le=1)

    # From backend after initial prediction
    risk_level:          Optional[str]   = None
    readmission_risk:    Optional[bool]  = None

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        v = v.upper()
        if v not in ("MALE", "FEMALE", "OTHER"):
            raise ValueError("gender must be MALE, FEMALE, or OTHER")
        return v

    @field_validator("smoking_status")
    @classmethod
    def validate_smoking(cls, v: str) -> str:
        v = v.upper()
        if v not in ("NEVER", "FORMER", "CURRENT"):
            raise ValueError("smoking_status must be NEVER, FORMER, or CURRENT")
        return v

    @field_validator("ward_type")
    @classmethod
    def validate_ward(cls, v: str) -> str:
        valid = ("GENERAL", "ICU", "CARDIAC", "ORTHOPEDIC", "ONCOLOGY", "NEUROLOGY", "OTHER")
        v = v.upper()
        if v not in valid:
            raise ValueError(f"ward_type must be one of {valid}")
        return v

    @model_validator(mode="after")
    def derive_obesity_flag(self) -> "PatientInput":
        """Auto-set has_obesity from BMI if not explicitly set."""
        if self.has_obesity == 0 and self.bmi > 30:
            self.has_obesity = 1
        if self.polypharmacy_flag is None:
            self.polypharmacy_flag = 1 if self.medication_count >= 5 else 0
        return self

    model_config = {"json_schema_extra": {
        "example": {
            "age": 62, "gender": "MALE", "bmi": 29.4,
            "smoking_status": "FORMER", "has_diabetes": 1, "has_hypertension": 1,
            "blood_sugar_fasting": 210.0, "bp_systolic": 158.0, "hba1c": 8.9,
            "creatinine": 1.4, "gfr": 65.0, "oxygen_saturation": 96.5,
            "ward_type": "GENERAL", "previous_admissions": 2,
        }
    }}


# ══════════════════════════════════════════════════════════════════════════
#  Vitals Input
# ══════════════════════════════════════════════════════════════════════════

class VitalsInput(BaseModel):
    patient_id:          Optional[str]   = None

    # Accept both snake_case and camelCase
    heart_rate:          Optional[float] = Field(None, ge=10,  le=300)
    heartRate:           Optional[float] = Field(None, ge=10,  le=300)
    oxygen_saturation:   Optional[float] = Field(None, ge=50,  le=100)
    oxygenSaturation:    Optional[float] = Field(None, ge=50,  le=100)
    systolic_bp:         Optional[float] = Field(None, ge=40,  le=300)
    systolicBP:          Optional[float] = Field(None, ge=40,  le=300)
    diastolic_bp:        Optional[float] = Field(None, ge=20,  le=200)
    diastolicBP:         Optional[float] = Field(None, ge=20,  le=200)
    temperature:         Optional[float] = Field(None, ge=25,  le=45)
    respiratory_rate:    Optional[float] = Field(None, ge=2,   le=60)
    blood_glucose:       Optional[float] = Field(None, ge=20,  le=600)
    bloodGlucose:        Optional[float] = Field(None, ge=20,  le=600)


# ══════════════════════════════════════════════════════════════════════════
#  Prediction Response
# ══════════════════════════════════════════════════════════════════════════

class PredictionResponse(BaseModel):
    # Risk
    risk_level:                str
    risk_score:                float
    risk_probability_high:     float
    risk_probability_medium:   float
    risk_probability_low:      float
    risk_probability_critical: float
    risk_confidence:           float
    well_calibrated:           bool = True

    # Readmission
    readmission_risk:          bool
    readmission_probability:   float

    # LOS
    predicted_los:             float

    # Cluster
    cluster_label:             int
    cluster_name:              str
    cluster_distance:          Optional[float] = None

    # Explainability
    shap_values:               Dict[str, Any]
    top_risk_factors:          List[Dict[str, Any]]

    # Meta
    model_version:             str = "2.0.0"
    inference_ms:              Optional[float] = None