# Architecture

## System overview

```mermaid
graph TB
    subgraph client["Browser"]
        UI["React 18 + Vite<br/>role-based dashboards"]
        VAPI_SDK["Vapi Web SDK<br/>(microphone + audio)"]
    end

    subgraph edge["Edge"]
        NGINX["nginx<br/>TLS, security headers,<br/>static assets, /api + /socket.io proxy"]
    end

    subgraph backend["Backend — Node / Express / TypeScript"]
        AUTH["Auth<br/>JWT access + refresh"]
        RBAC["RBAC middleware<br/>ownership resolution per resource"]
        AID["AI Doctor service<br/>prompt assembly, safety backstops"]
        REPORTS["Reports<br/>pdfkit"]
        WS["Socket.IO<br/>live alerts"]
    end

    subgraph ml["ML service — Python / FastAPI"]
        MODELS["5 trained models<br/>XGBoost · RandomForest · pgmpy<br/>IsolationForest · 1D-CNN"]
        RAG["RAG retriever<br/>TF-IDF over 53 curated documents"]
    end

    subgraph data["Data"]
        PG[("PostgreSQL<br/>patients, consultations, audit log")]
        REDIS[("Redis<br/>rate limits, lockout,<br/>report lock, spend cap")]
    end

    subgraph external["External (metered)"]
        VAPI["Vapi — voice orchestration"]
        GROQ["Groq — LLM inference"]
        DG["Deepgram — speech to text"]
        AZ["Azure — Hindi TTS"]
    end

    UI --> NGINX
    VAPI_SDK <-.->|"live audio"| VAPI
    NGINX --> AUTH
    AUTH --> RBAC
    RBAC --> AID & REPORTS
    AID -->|"X-Internal-Service-Key"| RAG
    RBAC -->|"X-Internal-Service-Key"| MODELS
    AID <--> GROQ
    VAPI --> DG & GROQ & AZ
    VAPI -->|"signed webhook"| AID
    AID --> WS
    WS -.->|"alerts"| UI
    backend --> PG & REDIS

    classDef ext fill:#FEF3E2,stroke:#E8833A,color:#0B2B3B
    classDef store fill:#E6F0FA,stroke:#0D5C7E,color:#0B2B3B
    class VAPI,GROQ,DG,AZ ext
    class PG,REDIS store
```

The ml-service is never exposed to the browser. Every call to it goes through
the backend carrying a shared internal key, so "reachable" and "allowed" are
separate things even on the internal network.

---

## An AI Doctor consultation, end to end

This is the flow worth understanding — it is where most of the design
decisions live.

```mermaid
sequenceDiagram
    autonumber
    actor P as Patient
    participant FE as Frontend
    participant BE as Backend
    participant RAG as RAG retriever
    participant V as Vapi
    participant G as Groq

    P->>FE: Opens pre-call form
    Note over FE: Microphone permission requested here,<br/>not after submit — moves the OS prompt<br/>off the critical path
    P->>BE: POST /ai-doctor/start-call

    BE->>BE: Per-user rate limit + global daily spend cap
    BE->>BE: Load patient record, meds, conditions,<br/>prior consultations
    BE->>RAG: Retrieve on complaint + known conditions
    RAG-->>BE: Curated knowledge + red-flag criteria
    BE->>BE: Herb contraindications for THIS patient
    BE-->>FE: Assistant config with assembled prompt

    FE->>V: Start call
    loop Each turn
        V->>G: Transcript + system prompt
        G-->>V: Response
        V-->>P: Hindi speech
    end

    P->>V: Ends call
    V->>BE: Signed webhook (transcript)
    Note over BE: Redis SET NX — the client and the webhook<br/>both fire, only one report is generated

    BE->>RAG: Retrieve on transcript
    BE->>G: Generate structured assessment
    G-->>BE: JSON

    rect rgb(254, 243, 226)
        Note over BE: Deterministic layer — runs regardless<br/>of what the model concluded
        BE->>BE: Scan suggestions for contraindicated herbs
        BE->>BE: Scan transcript for emergency patterns
        BE->>BE: If URGENT → create Alert, emit over websocket
    end

    BE-->>FE: Report
    FE-->>P: Assessment + PDF download
```

**Why retrieval happens twice and never per turn.** Grounding is injected
into the system prompt at call setup and again when the report is generated.
Retrieving per conversation turn would put a network hop inside the live
voice loop, where every added millisecond is audible as a pause.

**Why the deterministic layer exists.** An LLM is not a safety mechanism. The
herb and emergency checks run on every consultation regardless of what the
model concluded, which is the only way they are worth anything.

---

## Access control

One middleware handles every patient-scoped route:

```
authenticate → requireOwnership(resourceType)
                  ├─ staff role in allowRoles → pass
                  ├─ PATIENT → resolve resource's owning patient,
                  │            compare against caller's patient record
                  └─ neither → 403 (404 if the resource doesn't exist,
                               so ids of other patients don't leak)
```

Resource resolvers live in one file (`resourceResolvers.ts`), so adding an
ownership-checked route means adding one resolver rather than hand-rolling a
"does this belong to me" query per router — which is how the original
codebase leaked patient data across accounts.

---

## Repository layout

```
backend/          Node/Express/TypeScript, Prisma over PostgreSQL
  src/middleware/   rbac, resourceResolvers, rate limiting, webhook verify
  src/modules/      auth, patients, ai-doctor, ml, reports, ...
  tests/            38 tests — auth, RBAC, safety backstops, PDF rendering

ml-service/       Python/FastAPI
  app/api/routes/   one router per model + RAG retrieval
  app/ml/           model architectures (shared by training and serving)
  app/rag/          retriever + curated corpus (53 documents)
  train/            reproducible training scripts, one per model
  models_manifest.json   metrics and artifact hashes — the source of truth
  tests/            22 tests — retrieval quality, red-flag surfacing

frontend/         React 18 + Vite + Zustand
  src/index.css     design tokens — one palette, swapped by editing values
  src/components/ui/  shared component library
  src/pages/        25 pages across 5 roles
```

`models_manifest.json` is deliberately the single source of ML truth: the
serving routes read their reported metrics from it rather than hardcoding
numbers, so a retrain cannot leave the API advertising results the model no
longer achieves.
