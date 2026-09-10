# Deploying MediSense AI on free tiers

Everything here fits inside free plans. The one genuine cost is voice calls —
see [Voice call costs](#voice-call-costs) before demo day, because that part
is not free and cannot be made free.

You have to create the accounts and paste the secrets yourself; nothing in
this repo can do that for you. Each step below says exactly which values to
copy where.

---

## Architecture once deployed

| Piece | Host | Free tier |
|---|---|---|
| Frontend (static Vite build) | Vercel | Unlimited hobby projects |
| Backend (Node/Express) | Render or Railway | Sleeps after ~15 min idle |
| ML service (FastAPI) | Render or Railway | Sleeps after ~15 min idle |
| Postgres | Neon or Supabase | 0.5 GB |
| Redis | Upstash | 10k commands/day |

**Deploy in this order.** Each step needs a URL from the one before it:
Postgres and Redis first, then ml-service, then backend (needs the ml-service
URL), then frontend (needs the backend URL at *build* time — Vite inlines
`VITE_*` variables into the bundle, so changing them later requires a rebuild,
not just a restart).

---

## 1. Postgres — Neon

1. Create a project at neon.tech. Region: pick the one closest to your users.
2. Copy the **pooled** connection string (it has `-pooler` in the host). The
   direct connection has a low connection cap that a restarting free-tier
   container will exhaust.
3. Keep it for `DATABASE_URL`.

Run migrations once the backend is deployed, from your machine:

```bash
cd backend
DATABASE_URL="<your neon url>" npx prisma migrate deploy
DATABASE_URL="<your neon url>" npx prisma db seed   # demo data, optional
```

Use `migrate deploy`, not `db push`. `db push` skips the migration history and
will silently diverge your production schema from the repo.

## 2. Redis — Upstash

1. Create a Redis database at upstash.com.
2. Copy the connection string in `rediss://` form (TLS).
3. Keep it for `REDIS_URL`.

Redis backs rate limiting, login lockout, password-reset tokens, the
report-generation lock and the AI Doctor daily cost cap. If it is unreachable
those degrade open rather than blocking requests — deliberate, but it means a
missing `REDIS_URL` disables the spend cap silently. Set it.

## 3. ML service — Render

1. New → Web Service → connect the repo.
2. Root directory `ml-service`, environment **Docker**.
3. Health check path: `/api/health`.
4. Environment variables:

   | Key | Value |
   |---|---|
   | `INTERNAL_API_KEY` | `openssl rand -hex 32` — the backend must send the same value |
   | `MODEL_PATH` | `./app/models` |
   | `ALLOWED_ORIGIN` | your backend's Render URL |

Do not attach a persistent disk. Model artifacts and the RAG corpus are baked
into the image at build time, so they survive restarts without one.

Copy the resulting service URL for the next step.

## 4. Backend — Render

1. New → Web Service → same repo, root directory `backend`, environment
   **Docker**.
2. Health check path: `/health`.
3. Environment variables:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Neon pooled string from step 1 |
   | `REDIS_URL` | Upstash string from step 2 |
   | `JWT_ACCESS_SECRET` | `openssl rand -base64 48` |
   | `JWT_REFRESH_SECRET` | `openssl rand -base64 48` — must differ from the access secret |
   | `ML_SERVICE_URL` | ml-service URL from step 3 |
   | `ML_SERVICE_INTERNAL_KEY` | the **same** value as ml-service's `INTERNAL_API_KEY` |
   | `FRONTEND_URL` | your Vercel URL (fill in after step 5, then redeploy) |
   | `VAPI_API_KEY` | Vapi dashboard → API Keys (private) |
   | `VAPI_PUBLIC_KEY` | Vapi dashboard → API Keys (public) |
   | `VAPI_WEBHOOK_SECRET` | `openssl rand -hex 32` — also set as the assistant's Server URL Secret in Vapi |
   | `GROQ_API_KEY` | console.groq.com/keys |
   | `AI_DOCTOR_DAILY_CALL_CAP` | `20` — read [Voice call costs](#voice-call-costs) first |
   | `PUBLIC_API_URL` | this service's own URL (for correct Swagger docs) |

`env.ts` validates all of these at boot and calls `process.exit(1)` on any
missing required value. That is deliberate — a container that crash-loops on
startup is easier to diagnose than one serving traffic with a broken auth
secret. If the service will not start, read the logs: it names the variable.

## 5. Frontend — Vercel

1. New Project → same repo → root directory `frontend`.
2. Framework preset: Vite. Build `npm run build`, output `dist`.
3. Environment variables (these are **build-time**):

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | your backend URL from step 4 |
   | `VITE_SOCKET_URL` | the same backend URL |

4. Deploy, then go back to the backend and set `FRONTEND_URL` to the Vercel
   URL and redeploy it. Both CORS and the Socket.IO origin allowlist check
   that value in production, so websockets fail until it matches exactly —
   including the scheme, and with no trailing slash.

## 6. Vapi webhook

In the Vapi dashboard, open your assistant → Advanced:

- Server URL: `https://<your-backend>/api/v1/ai-doctor/webhook`
- Server URL Secret: the same value as `VAPI_WEBHOOK_SECRET`

Without the secret the webhook signature check rejects every call, and
consultations never receive their transcript or generated report.

---

## Voice call costs

This is the one part that is not free, and it is worth being clear about
before demo day.

Vapi bills per minute — roughly $0.05/min platform fee plus the underlying
speech-to-text, LLM and text-to-speech costs, landing around **$0.07–0.25 per
minute** in practice. New accounts get about $10 in trial credit, so budget
roughly **40–140 minutes of total talk time**, not unlimited use.

Two things follow from that:

- `AI_DOCTOR_DAILY_CALL_CAP` is a real spend guard, not decoration. It is
  enforced globally across all users, not per user. Leave it low.
- Check your remaining Vapi credit before demo day. Nothing in the app can
  see that balance.

Hindi voice specifically: Deepgram Aura has no Hindi voices, and Vapi's own
bundled set is small and largely English, so Azure's `hi-IN-MadhurNeural`
(the configured default) is the practical option. `AI_DOCTOR_TTS_PROVIDER`
and `AI_DOCTOR_TTS_VOICE_ID` let you switch without a code change if that
changes.

---

## Free-tier behaviour to expect

**Cold starts.** Render free services sleep after ~15 minutes idle and take
30–60 seconds to wake. The ml-service is the slower of the two because it
loads XGBoost, pgmpy and PyTorch. Before a demo, open both URLs a few minutes
early so they are warm — a judge watching a spinner for 45 seconds is an
avoidable bad first impression.

**Memory.** The ml-service is the tightest fit. It runs a single worker
deliberately; raising `WEB_CONCURRENCY` will OOM it on a free instance.

**Postgres connections.** Use the pooled Neon string. Restarting containers
otherwise exhaust the direct-connection cap.

---

## Post-deploy smoke test

Run this against the live URLs, not localhost. It follows the same path a
judge will.

1. `GET /health` on the backend returns `{"status":"ok"}`.
2. `GET /api/health` on the ml-service reports models loaded.
3. Register a new patient account, then log out and log back in.
4. Heart risk prediction from the AI tools page returns a result.
5. CBC analyzer accepts values and returns an interpretation.
6. Start an AI Doctor call — microphone permission prompt appears, Priya
   speaks the opening line in Hindi.
7. End the call, wait for the report, download the consultation PDF.
8. Log in as a doctor and confirm that consultation appears on the patient's
   detail page.
9. Trigger an alert and confirm it arrives live (websockets working — this is
   what breaks first when `FRONTEND_URL` does not match exactly).

## If something breaks

| Symptom | Cause |
|---|---|
| Backend crash-loops on boot | A required env var is missing; the log names it |
| Every API call returns CORS errors | `FRONTEND_URL` does not exactly match the Vercel origin |
| Alerts do not arrive live | Same cause — the Socket.IO allowlist reads `FRONTEND_URL` in production |
| ML routes return 401 | `ML_SERVICE_INTERNAL_KEY` and `INTERNAL_API_KEY` differ |
| AI Doctor call connects but no report | Vapi Server URL Secret does not match `VAPI_WEBHOOK_SECRET` |
| First request after idle takes ~45s | Free-tier cold start; warm the service before demoing |
| `/start-call` returns 503 | Daily cap reached — `AI_DOCTOR_DAILY_CALL_CAP` |
