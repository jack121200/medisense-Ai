"""
pdf_extract.py — Universal OCR-style Extraction for PDF + DOCX
===============================================================
Supports ALL THREE ML features:
  POST /api/pdf/extract-heart     → Heart Risk (14 cardiac fields)
  POST /api/pdf/extract-cbc       → CBC Analyzer (20 blood params)
  POST /api/pdf/extract-symptoms  → AI Symptom Checker (symptom list)

Rules:
  • Accepts .pdf and .docx files
  • If a value cannot be extracted, that field is skipped (not returned)
  • Frontend populates only fields present in the response
"""
import re
import io
import json
import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/api/pdf", tags=["PDF Extraction"])

# ── Optional imports ─────────────────────────────────────────────────────────
try:
    import pdfplumber
    PDF_OK = True
except ImportError:
    PDF_OK = False

try:
    from docx import Document as DocxDocument
    DOCX_OK = True
except ImportError:
    DOCX_OK = False

MODELS_DIR = Path(__file__).parent.parent.parent / "models"


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  TEXT EXTRACTION  (PDF or DOCX → plain string)                     ║
# ╚══════════════════════════════════════════════════════════════════════╝

def _extract_text(content: bytes, filename: str) -> str:
    """Extract raw text from a PDF or DOCX file."""
    fname = filename.lower()

    if fname.endswith(".pdf"):
        if not PDF_OK:
            raise HTTPException(503, "pdfplumber not installed. Run: pip install pdfplumber")
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        return "\n".join(pages)

    elif fname.endswith(".docx"):
        if not DOCX_OK:
            raise HTTPException(503, "python-docx not installed. Run: pip install python-docx")
        from docx import Document as DocxDocument
        doc = DocxDocument(io.BytesIO(content))
        parts = [p.text for p in doc.paragraphs]
        # Also grab table cell text
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    parts.append(cell.text)
        return "\n".join(parts)

    else:
        raise HTTPException(400, "Only .pdf and .docx files are supported")


def _validate_file(file: UploadFile):
    fname = (file.filename or "").lower()
    if not (fname.endswith(".pdf") or fname.endswith(".docx")):
        raise HTTPException(400, "Only .pdf and .docx files are supported")


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  HELPERS                                                            ║
# ╚══════════════════════════════════════════════════════════════════════╝

def _find_number(text: str, *patterns: str) -> str | None:
    """Try each regex, return first numeric match or None (never empty string)."""
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            if val:
                return val
    return None


def _find_category(text: str, options: dict[str, list[str]]) -> str | None:
    """Match text against keyword patterns per category option."""
    for opt_val, opt_patterns in options.items():
        for pat in opt_patterns:
            if re.search(pat, text, re.IGNORECASE):
                return opt_val
    return None


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  FEATURE 1 — HEART RISK (14 cardiac fields)                        ║
# ╚══════════════════════════════════════════════════════════════════════╝

_HEART_NUM = {
    "age":                    [r"age[:\s]+(\d+)"],
    "resting_blood_pressure": [r"(?:resting\s*)?(?:blood\s*pressure|BP)[:\s]+([\d.]+)",
                               r"systolic[:\s]+([\d.]+)"],
    "cholestoral":            [r"cholesterol[:\s]+([\d.]+)",
                               r"total\s+cholesterol[:\s]+([\d.]+)"],
    "Max_heart_rate":         [r"(?:max(?:imum)?\s*)?heart\s*rate[:\s]+([\d.]+)",
                               r"\bHR[:\s]+([\d.]+)"],
    "oldpeak":                [r"(?:ST[\s-]depression|oldpeak|ST[\s-]segment)[:\s]+([\d.]+)"],
}

_HEART_CAT = {
    "sex": {
        "Male":   [r"\b(male|man)\b"],
        "Female": [r"\b(female|woman)\b"],
    },
    "chest_pain_type": {
        "Typical angina":   [r"typical\s+angina"],
        "Atypical angina":  [r"atypical\s+angina"],
        "Non-anginal pain": [r"non[\-\s]?anginal"],
        "Asymptomatic":     [r"\basymptomatic\b"],
    },
    "fasting_blood_sugar": {
        "Greater than 120 mg/ml": [r"fasting.{0,20}>\s*120", r"fasting.{0,20}high"],
        "Lower than 120 mg/ml":   [r"fasting.{0,20}<\s*120", r"fasting.{0,20}normal"],
    },
    "rest_ecg": {
        "Normal":                         [r"ecg\s*normal", r"normal\s+ecg"],
        "ST-T wave abnormality":          [r"ST[\-\s]T\s+wave", r"ST\s+abnormal"],
        "Left ventricular hypertrophy":   [r"left\s+ventricular\s+hypertrophy", r"\bLVH\b"],
    },
    "exercise_induced_angina": {
        "Yes": [r"exercise.{0,20}angina.{0,10}yes", r"exertional\s+angina"],
        "No":  [r"exercise.{0,20}angina.{0,10}no",  r"no\s+exertional"],
    },
    "slope": {
        "Upsloping":   [r"upslop"],
        "Flat":        [r"\bflat\b"],
        "Downsloping": [r"downslop"],
    },
    "vessels_colored_by_flourosopy": {
        "Zero":  [r"\bzero\s+vessel", r"vessels?[:\s]+0"],
        "One":   [r"\bone\s+vessel",  r"vessels?[:\s]+1"],
        "Two":   [r"\btwo\s+vessel",  r"vessels?[:\s]+2"],
        "Three": [r"\bthree\s+vessel",r"vessels?[:\s]+3"],
    },
    "thalassemia": {
        "Normal":            [r"\bnormal\s+thal"],
        "Fixed Defect":      [r"fixed\s+defect"],
        "Reversable Defect": [r"reversib"],
    },
}


@router.post("/extract-heart", summary="Extract cardiac fields from PDF/DOCX report")
async def extract_heart(file: UploadFile = File(...)):
    _validate_file(file)
    content = await file.read()
    text = _extract_text(content, file.filename or "upload.pdf")

    result: dict = {}

    # Numeric fields — only add if found
    for field, patterns in _HEART_NUM.items():
        val = _find_number(text, *patterns)
        if val is not None:
            result[field] = val

    # Categorical fields — only add if matched
    for field, options in _HEART_CAT.items():
        val = _find_category(text, options)
        if val is not None:
            result[field] = val

    return {
        "extracted": result,
        "fields_found": len(result),
        "raw_text_preview": text[:600].strip(),
        "message": (
            f"Extracted {len(result)} / 13 field(s) from {file.filename}. "
            "Empty fields were left blank — please fill them in manually."
        ) if result else (
            "Could not extract any fields automatically. "
            "The document may be scanned or poorly formatted. Please enter values manually."
        ),
    }


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  FEATURE 2 — CBC ANALYZER (20 blood parameters)                    ║
# ╚══════════════════════════════════════════════════════════════════════╝

_CBC_NUM = {
    "WBC":    [r"\bWBC[:\s]+([\d.]+)", r"white\s+blood\s+cells?[:\s]+([\d.]+)"],
    "LYMp":  [r"\bLYM%?[:\s]+([\d.]+)", r"lymphocyte[s]?\s*%[:\s]+([\d.]+)"],
    "MIDp":  [r"\bMID%?[:\s]+([\d.]+)"],
    "NEUTp": [r"\bNEUT%?[:\s]+([\d.]+)", r"neutrophil[s]?\s*%[:\s]+([\d.]+)"],
    "LYMn":  [r"\bLYM#[:\s]+([\d.]+)", r"lymphocyte[s]?\s*#[:\s]+([\d.]+)",
              r"lymphocyte\s+(?:abs|absolute)[:\s]+([\d.]+)"],
    "MIDn":  [r"\bMID#[:\s]+([\d.]+)"],
    "NEUTn": [r"\bNEUT#[:\s]+([\d.]+)", r"neutrophil[s]?\s*#[:\s]+([\d.]+)"],
    "RBC":   [r"\bRBC[:\s]+([\d.]+)", r"red\s+blood\s+cells?[:\s]+([\d.]+)"],
    "HGB":   [r"\bHGB[:\s]+([\d.]+)", r"hemoglobin[:\s]+([\d.]+)", r"\bHb[:\s]+([\d.]+)"],
    "HCT":   [r"\bHCT[:\s]+([\d.]+)", r"hematocrit[:\s]+([\d.]+)"],
    "MCV":   [r"\bMCV[:\s]+([\d.]+)"],
    "MCH":   [r"\bMCH[:\s]+([\d.]+)"],
    "MCHC":  [r"\bMCHC[:\s]+([\d.]+)"],
    "RDWSD": [r"\bRDW-?SD[:\s]+([\d.]+)"],
    "RDWCV": [r"\bRDW-?CV[:\s]+([\d.]+)", r"\bRDW[:\s]+([\d.]+)"],
    "PLT":   [r"\bPLT[:\s]+([\d.]+)", r"platelets?[:\s]+([\d.]+)"],
    "MPV":   [r"\bMPV[:\s]+([\d.]+)"],
    "PDW":   [r"\bPDW[:\s]+([\d.]+)"],
    "PCT":   [r"\bPCT[:\s]+([\d.]+)"],
    "PLCR":  [r"\bPLCR[:\s]+([\d.]+)", r"\bP-?LCR[:\s]+([\d.]+)"],
}


@router.post("/extract-cbc", summary="Extract CBC parameters from PDF/DOCX lab report")
async def extract_cbc(file: UploadFile = File(...)):
    _validate_file(file)
    content = await file.read()
    text = _extract_text(content, file.filename or "upload.pdf")

    result: dict = {}
    for field, patterns in _CBC_NUM.items():
        val = _find_number(text, *patterns)
        if val is not None:
            result[field] = val

    return {
        "extracted": result,
        "fields_found": len(result),
        "raw_text_preview": text[:600].strip(),
        "message": (
            f"Extracted {len(result)} / 20 CBC parameter(s) from {file.filename}. "
            "Missing fields are left empty — fill them in if available."
        ) if result else (
            "No CBC values detected automatically. "
            "Please enter values manually."
        ),
    }


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  FEATURE 3 — AI SYMPTOM CHECKER (extract symptom keywords)         ║
# ╚══════════════════════════════════════════════════════════════════════╝

# Map human-readable phrases → model symptom column names
_SYMPTOM_ALIASES: dict[str, str] = {
    "chest pain":              "chest_pain",
    "chest discomfort":        "chest_pain",
    "shortness of breath":     "breathlessness",
    "difficulty breathing":    "breathlessness",
    "breathlessness":          "breathlessness",
    "fatigue":                 "fatigue",
    "tiredness":               "fatigue",
    "dizziness":               "dizziness",
    "light headed":            "dizziness",
    "palpitations":            "palpitations",
    "heart pounding":          "palpitations",
    "sweating":                "sweating",
    "excessive sweating":      "sweating",
    "nausea":                  "nausea",
    "vomiting":                "vomiting",
    "fever":                   "high_fever",
    "high fever":              "high_fever",
    "headache":                "headache",
    "back pain":               "back_pain",
    "ankle swelling":          "swelling_of_stomach",
    "swollen ankles":          "swelling_of_stomach",
    "leg swelling":            "swelling_of_stomach",
    "leg pain":                "pain_in_muscles",
    "muscle pain":             "pain_in_muscles",
    "muscle ache":             "pain_in_muscles",
    "jaw pain":                "chest_pain",
    "arm pain":                "chest_pain",
    "irregular heartbeat":     "palpitations",
    "high blood pressure":     "headache",
    "hypertension":            "headache",
    "weakness":                "weakness_of_one_body_side",
    "fainting":                "altered_sensorium",
    "loss of consciousness":   "altered_sensorium",
    "swollen lymph nodes":     "enlarged_lymph_nodes",
    "weight loss":             "weight_loss",
    "cough":                   "cough",
    "cold":                    "runny_nose",
    "sore throat":             "throat_irritation",
    "joint pain":              "joint_pain",
    "abdominal pain":          "stomach_pain",
    "stomach pain":            "stomach_pain",
    "diarrhoea":               "diarrhoea",
    "diarrhea":                "diarrhoea",
    "constipation":            "constipation",
    "indigestion":             "indigestion",
    "blurred vision":          "blurred_and_distorted_vision",
    "rash":                    "skin_rash",
    "skin rash":               "skin_rash",
    "itching":                 "itching",
    "burning urination":       "burning_micturition",
    "frequent urination":      "frequent_urination",
    "yellowish skin":          "yellowing_of_eyes",
    "jaundice":                "yellowing_of_eyes",
    "anxiety":                 "anxiety",
    "depression":              "depression",
    "insomnia":                "depression",
    "sleep problems":          "depression",
    "phlegm":                  "phlegm",
    "mucus":                   "phlegm",
    "chills":                  "chills",
    "shivering":               "shivering",
    "cramps":                  "stomach_pain",
    "bloating":                "stomach_pain",
    "stiff neck":              "stiff_neck",
    "swelling":                "swelling_of_stomach",
    "breathing difficulty":    "breathlessness",
    "edema":                   "swelling_of_stomach",
    "numbness":                "weakness_of_one_body_side",
    "tingling":                "weakness_of_one_body_side",
}


def _extract_symptoms_from_text(text: str, known_columns: list[str]) -> list[str]:
    """
    1. Match alias phrases against text
    2. Also try direct column-name match (e.g. 'chest_pain' in text)
    3. Return unique sorted list of matched symptom column names
    """
    found: set[str] = set()
    lower = text.lower()

    # Step 1: alias matching
    for phrase, col_name in _SYMPTOM_ALIASES.items():
        if phrase in lower and col_name in known_columns:
            found.add(col_name)

    # Step 2: direct column name match (handles reports already using ML column names)
    for col in known_columns:
        readable = col.replace("_", " ")
        if col in lower or readable in lower:
            found.add(col)

    return sorted(found)


@router.post("/extract-symptoms", summary="Extract symptoms from PDF/DOCX for AI Symptom Checker")
async def extract_symptoms(file: UploadFile = File(...)):
    _validate_file(file)
    content = await file.read()
    text = _extract_text(content, file.filename or "upload.pdf")

    # Load known symptom columns
    symptom_col_path = MODELS_DIR / "symptom_columns.json"
    known_columns: list[str] = []
    if symptom_col_path.exists():
        with open(symptom_col_path) as f:
            known_columns = json.load(f)

    matched = _extract_symptoms_from_text(text, known_columns)

    return {
        "symptoms": matched,
        "symptoms_csv": ", ".join(matched),
        "symptoms_found": len(matched),
        "raw_text_preview": text[:600].strip(),
        "message": (
            f"Detected {len(matched)} symptom(s): {', '.join(matched)}. "
            "You can add/remove symptoms before running the check."
        ) if matched else (
            "Could not detect any known symptoms automatically. "
            "Please type your symptoms manually in the text box."
        ),
    }


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  FEATURE 4 — LIPID PROFILE ANALYZER (NLA-2014 format)              ║
# ╚══════════════════════════════════════════════════════════════════════╝

_LIPID_NUM = {
    "total_cholesterol": [
        r"total\s+cholesterol[:\s]+([0-9.]+)",
        r"cholesterol,?\s*total[:\s]+([0-9.]+)",
        r"\bTC[:\s]+([0-9.]+)",
    ],
    "ldl": [
        r"\bLDL[-\s]*C(?:holesterol)?[:\s]+([0-9.]+)",
        r"low[- ]density\s+lipoprotein[:\s]+([0-9.]+)",
        r"\bLDL[:\s]+([0-9.]+)",
    ],
    "hdl": [
        r"\bHDL[-\s]*C(?:holesterol)?[:\s]+([0-9.]+)",
        r"high[- ]density\s+lipoprotein[:\s]+([0-9.]+)",
        r"\bHDL[:\s]+([0-9.]+)",
    ],
    "vldl": [
        r"\bVLDL[-\s]*C(?:holesterol)?[:\s]+([0-9.]+)",
        r"very\s+low[- ]density\s+lipoprotein[:\s]+([0-9.]+)",
        r"\bVLDL[:\s]+([0-9.]+)",
    ],
    "triglycerides": [
        r"triglycerides?[:\s]+([0-9.]+)",
        r"triacylglycerol[:\s]+([0-9.]+)",
        r"\bTG[:\s]+([0-9.]+)",
        r"\bTRIG[:\s]+([0-9.]+)",
    ],
    "non_hdl": [
        r"non[- ]?HDL[:\s]+([0-9.]+)",
        r"non[- ]HDL\s+cholesterol[:\s]+([0-9.]+)",
    ],
}


@router.post("/extract-lipid", summary="Extract Lipid Profile values from PDF/DOCX lab report")
async def extract_lipid(file: UploadFile = File(...)):
    """
    Extract total cholesterol, LDL, HDL, VLDL, triglycerides, and Non-HDL
    from a PDF or DOCX lipid panel report (NLA-2014 format).
    """
    _validate_file(file)
    content = await file.read()
    text = _extract_text(content, file.filename or "upload.pdf")

    result: dict = {}
    for field, patterns in _LIPID_NUM.items():
        val = _find_number(text, *patterns)
        if val is not None:
            result[field] = val

    total_fields = 6
    return {
        "extracted": result,
        "fields_found": len(result),
        "raw_text_preview": text[:600].strip(),
        "message": (
            f"Extracted {len(result)} / {total_fields} lipid value(s) from {file.filename}. "
            "Review extracted values before running the analysis."
        ) if result else (
            "No lipid values detected automatically. "
            "The PDF may be scanned or use a non-standard format. Please enter values manually."
        ),
    }


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  FEATURE 5 — GENERIC TEXT EXTRACTOR (AI Doctor pre-call upload)    ║
# ╚══════════════════════════════════════════════════════════════════════╝

@router.post("/extract-text", summary="Extract raw text from any PDF or DOCX file")
async def extract_text(file: UploadFile = File(...)):
    """
    Returns raw extracted text from a PDF or DOCX file.
    Used by the AI Doctor pre-call form so patients can upload any medical report
    and have its text injected into Dr. Arjun's system prompt.
    """
    _validate_file(file)
    content = await file.read()
    text = _extract_text(content, file.filename or "upload.pdf")

    # Count approximate pages (pdfplumber) or estimate by word count
    pages = 1
    if (file.filename or "").lower().endswith(".pdf") and PDF_OK:
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                pages = len(pdf.pages)
        except Exception:
            pages = max(1, len(text) // 3000)

    clean_text = text.strip()
    return {
        "text": clean_text,
        "pages": pages,
        "char_count": len(clean_text),
        "filename": file.filename,
        "message": (
            f"Successfully extracted {len(clean_text)} characters ({pages} page(s)) from {file.filename}."
        ) if clean_text else (
            "No text could be extracted. The file may be a scanned image or use a non-standard format."
        ),
    }
