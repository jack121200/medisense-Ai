# MediSense AI

An AI-assisted healthcare platform built around a Hindi-speaking voice health
assistant, five trained clinical ML models, and a full hospital workflow
across five roles.

A patient describes how they feel in their own language. The assistant takes
a structured clinical history, grounds its advice in a curated knowledge base
rather than model memory, and produces a reviewable assessment that lands on
a clinician's dashboard as a report and a PDF.

> **Not a medical device.** This is an academic project. It does not diagnose,
> does not prescribe, and every output is framed for review by a qualified
> doctor. In an emergency in India, call 108.

---

## What it does

**AI Doctor** — a voice consultation in Hindi, English or Hinglish. Priya
opens by stating she is an AI, works through a 9-phase OPD-style history one
question at a time, and produces a structured assessment: summary, possible
conditions, suggested self-care, red flags, urgency.

**Three deterministic safety layers** run underneath the model, because an LLM
cannot be the only safeguard in anything health-adjacent:

- Suggested herbs are cross-checked against the patient's recorded medications
  and conditions. Licorice suggested to a hypertensive patient gets caught
  regardless of what the model was thinking.
- Transcripts are scanned for emergency patterns independently of whether the
  model noticed.
- An URGENT result creates a real clinical alert over websockets, not a
  warning buried in a JSON field.

**Five ML models**, each trained from a reproducible script with metrics
recorded in `models_manifest.json`:

| Model | Method | Held-out result |
|---|---|---|
| Heart disease risk | XGBoost | 0.995 ROC-AUC, 95.5% accuracy |
| Symptom checker | Random Forest | 100% — [read why that's a caveat](LIMITATIONS.md#2-the-models) |
| ECG beat screening | Supervised 1D-CNN | 0.899 ROC-AUC, 0.753 recall (inter-patient) |
| CBC analyzer | IsolationForest + KMeans | Unsupervised — no accuracy to quote |
| Bayesian risk engine | pgmpy, 7-node DAG | CPDs fit from 1,025 records |

**Role-based platform** — appointments, billing, prescriptions, lab orders and
dashboards for patients, doctors, receptionists, lab technicians and admins,
all behind ownership-checked access control.

---

## Running it

```bash
docker compose up --build
```

Then open http://localhost. Migrations and demo data:

```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
```

Copy `.env.example` to `.env` and fill it in first — the backend validates
every required variable at boot and exits with the name of whichever one is
missing.

Demo accounts use password `MediSense@2024`:
`admin@medisense.ai` · `doctor@medisense.ai` · `patient@medisense.ai`

### Tests

```bash
cd backend && npx jest          # 38 tests
cd ml-service && pytest tests/  # 22 tests
```

---

## Stack

React 18 + Vite + Zustand · Node/Express/TypeScript + Prisma · Python/FastAPI ·
PostgreSQL · Redis · Docker · Vapi + Groq + Deepgram for voice

---

## Documentation

| | |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System diagram, consultation flow, access-control model |
| [LIMITATIONS.md](LIMITATIONS.md) | Every known weakness, stated plainly with real numbers |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Free-tier deploy, env vars, and what voice calls actually cost |
| [DEMO.md](DEMO.md) | 10-minute demo path and likely examiner questions |

If you are evaluating this project, `LIMITATIONS.md` is the honest one — it
covers what does not work as well as what does.
