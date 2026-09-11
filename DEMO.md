# Demo script

A 10-minute path through the project that leads with what is genuinely
distinctive and gets ahead of the questions an examiner will ask anyway.

## Before you start

- [ ] Open the backend and ml-service URLs a few minutes early. Free-tier
      services sleep, and a 45-second cold start in front of a panel is an
      avoidable bad first impression.
- [ ] Check your remaining Vapi credit. Nothing in the app can see it, and a
      call that fails mid-demo for lack of credit is unrecoverable.
- [ ] **Record a backup video of one full AI Doctor call.** Microphones,
      browser permissions and conference wifi all fail. Do this once, keep it
      open in a tab.
- [ ] Log in once as each role so tokens are fresh.
- [ ] Have `LIMITATIONS.md` open in a tab. When asked about a weakness, being
      able to show you already documented it is worth more than any answer
      improvised on the spot.

Accounts: `admin@medisense.ai`, `doctor@medisense.ai`,
`patient@medisense.ai` — password `MediSense@2024`.

---

## 1. Landing page (30 seconds)

Open the landing page and scroll to the ML section.

> "Five models, and we report the real held-out numbers — including the
> weakest one, the ECG screen, which catches 62% of ventricular beats on
> patients it never saw. Those figures come straight from the training
> manifest."

**Why start here:** it sets the frame for everything that follows. Volunteer
your weakest number in the first thirty seconds and the panel stops hunting
for what you are hiding.

---

## 2. AI Doctor call (4 minutes — the centrepiece)

Log in as the patient, open AI Doctor, start a consultation. Speak in Hindi
or Hinglish — that is the point.

Say something like: *"Do hafte se pet mein jalan ho rahi hai, khaas kar raat
ko khaane ke baad."*

Let Priya take history for a couple of turns. Point out while it runs:

- She opens by stating she is an AI and not a real doctor, without being
  asked.
- She asks one question at a time — a real back-and-forth, not a form.
- She works through a structured 9-phase history: complaint, duration, past
  illness, medicines, lifestyle, diet.

End the call. While the report generates:

> "Her advice isn't recalled from the model's memory — it's retrieved from a
> curated knowledge base of 53 documents. And underneath the model there are
> three deterministic checks that don't depend on the LLM noticing anything."

Show the generated report, then **download the PDF**.

> "This is what the patient carries to an actual appointment. It states what
> generated it, that it isn't a diagnosis, and the emergency number — because
> a printed page outlives the app that explains those things."

---

## 3. The safety layer (2 minutes — your strongest technical argument)

This is what separates the project from a chatbot with a medical prompt.

Open `backend/src/modules/ai-doctor/herbInteractions.ts`.

> "Licorice raises blood pressure. If the model suggests it to a hypertensive
> patient, this catches it regardless of what the model was thinking —
> cross-checked against their actual recorded medications, urgency forced up,
> report flagged for clinician review."

Then `emergencyDetection.ts`.

> "Transcripts are scanned for emergency patterns independently of the model.
> If someone mentions chest pain with sweating, an URGENT result creates a
> real clinical alert over websockets — not a warning buried in a JSON blob."

**The line to land:** *"An LLM can't be the only safety layer in something
health-adjacent. These run whether or not the model cooperates."*

---

## 4. Doctor's view (1 minute)

Log in as `doctor@medisense.ai`, open a patient, scroll to AI Doctor Consultations.

> "The consultation lands on the clinical side. Summary, possible conditions,
> red flags, urgency — and the same PDF. This data used to be siloed in the
> patient's own portal with nothing clinical able to see it."

---

## 5. ML tools (1.5 minutes)

Open AI Clinical Tools and run the heart risk prediction.

> "XGBoost, 0.99 ROC-AUC. Worth being precise: that's a clean, well-known
> public dataset where that result is expected. The scaler is fit inside the
> training split — that was a real leakage bug we found and fixed."

If you have time, show the ECG screen:

> "This one we rebuilt twice. It started as an autoencoder at 0.26 recall.
> Now it's a supervised ensemble on the standard DS1/DS2 benchmark — trained
> on 22 patients, scored once on 22 others. It catches 62% of ventricular
> beats while flagging under 1% of normal ones. It misses supraventricular
> beats, and we can say exactly why: they arrive early, and a single-beat
> window can't see timing."

---

## Questions you should expect

**"Your symptom checker reports 100% accuracy. Isn't that overfitting?"**
> Get in front of this one before they ask. The dataset gives every disease a
> fixed non-overlapping symptom signature with no noise — the model learned a
> lookup table. It's clean-case performance, not diagnostic ability, and it's
> labelled that way in the manifest, on the landing page and in the UI.

**"What stops it giving dangerous advice?"**
> Three layers. Scope — it never names allopathic drugs. Retrieval — advice
> comes from a curated corpus, not model memory. Deterministic checks — herb
> interactions against real medications, and emergency scanning that doesn't
> depend on the model. Plus everything routes to a doctor for review.

**"Is this HIPAA compliant?"**
> No, and we don't claim to be. No formal compliance review, no field-level
> encryption at rest, no pen test. Access control, audit logging and rate
> limiting are real; compliance certification is out of scope for a capstone.
> It's written up in LIMITATIONS.md.

**"Why TF-IDF instead of embeddings?"**
> Resource trade-off, made deliberately. The service already loads XGBoost,
> pgmpy and PyTorch; a sentence-transformer on top risks OOM on a free-tier
> container. At 53 documents with domain-specific vocabulary, keyword overlap
> is a strong enough signal. On a large paraphrase-heavy corpus I'd choose
> differently.

**"What would you do next?"**
> Clinician review before advice reaches the patient — right now escalation
> happens after the fact. Then external validation of the heart model on a
> different population, and expanding the interaction rules beyond 14 herbs.

**"What's the weakest part?"**
> The ECG screen. On patients it never saw it catches 62% of ventricular beats
> but almost no supraventricular ones, so overall recall is 0.39 — though what
> it does flag is usually right (precision 0.84). It's a triage aid for human
> review, and we report benchmark numbers rather than the intra-patient ones
> that would look better.

---

## If something breaks live

- **Call won't connect** — check Vapi credit, then play the backup video.
- **Page hangs on load** — free-tier cold start; keep talking, it will come
  back in under a minute.
- **Report doesn't generate** — the transcript still saved. Open the
  consultation history and show a previous one.

Do not debug in front of the panel. Move to the next section and come back
if there is time.
