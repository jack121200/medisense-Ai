# Known limitations

Written to be read by an examiner. Every number here is traceable to
`ml-service/models_manifest.json` or to a test in the repo — nothing is
rounded up, and the weak results are stated as plainly as the strong ones.

If you are defending this project, read this before the viva. Being asked
about a weakness you already named is a much better position than being
caught by one you did not.

---

## 1. The models

### Heart disease risk — strong, but the dataset is small
XGBoost, 0.9947 ROC-AUC, 95.5% accuracy on a held-out stratified split of
1,025 records.

The honest caveat is the dataset, not the model. This is a well-known public
cardiac dataset that is unusually clean and separable; ~0.99 AUC is the
expected result on it, not evidence of anything novel. It has no external
validation cohort, so nothing here demonstrates it would hold on a different
hospital's population. The scaler is fit inside the training split only, so
there is no leakage — that was a real bug, fixed.

### Symptom checker — the 100% is a warning sign, not an achievement
Random Forest, 4,920 rows, 41 disease classes, 100% test accuracy and 100%
5-fold CV.

**A perfect score on held-out data almost always means the task is too easy,
and that is the case here.** The public dataset gives every disease a fixed,
non-overlapping symptom signature with no noise and no ambiguous
presentations. The model has learned a lookup table, essentially perfectly.

Real patients present with overlapping, partial and contradictory symptoms.
This number describes clean-case performance and says nothing about
real-world diagnostic ability. It is labelled that way in the manifest, on
the landing page and in the UI.

### ECG beat screening — an honest benchmark, still the weakest model
A supervised 1D-CNN ensemble, evaluated on the standard inter-patient
benchmark: trained and tuned on the 22 patients of MIT-BIH DS1, then scored
once on the 22 different patients of DS2 (de Chazal et al., 2004; the four
paced records excluded, as AAMI EC57 recommends).

| On DS2 — 22 patients never seen in training | |
|---|---|
| ROC-AUC | 0.818 |
| Specificity (normal beats left unflagged) | 0.991 |
| Precision | 0.839 |
| Recall, all abnormal beats | 0.388 |
| Ventricular beats caught | 62% |
| Supraventricular beats caught | 1% |
| Calibration error (ECE) | 0.050 |

It replaced a reconstruction-error autoencoder that scored 0.750 ROC-AUC and
**0.255 recall**: trained only on normal beats, it ignored the labelled
abnormal beats the annotations provide.

Things to be able to defend:

- **Why DS1/DS2.** An earlier version trained on 12 records and tested on
  three. Its threshold was tuned on a validation set where one patient
  supplied 97% of the abnormal beats; it held 0.90 recall there and 0.63 on
  the test patients. With that few patients, the numbers mostly measured which
  patients were picked. DS1/DS2 is the split published inter-patient work
  uses, so these figures can be compared with it. Intra-patient splits, with
  beats from the same person in both train and test, routinely report 95%+
  and do not survive a new patient.
- **Why supraventricular beats are missed.** They differ from normal beats
  mainly in timing — they arrive early — and a single 0.7-second beat window
  cannot see timing. Published DS2 models that detect them add RR-interval
  features (time since the previous beat), which need a rhythm strip rather
  than one beat. Record 232 alone holds 1,382 of them, so they dominate the
  overall recall figure.
- **The operating point is strict by design, and landed stricter.** The
  threshold targets flagging at most 1 in 20 normal beats, chosen on
  cross-validated predictions. The served model averages four patient-fold
  networks, which made it more conservative: on DS2 it flagged about 1 in 110.
  It was not re-tuned on DS2 — that would be fitting the test set.
- **Patients unlike anyone in training are hard.** In cross-validation, the
  fold holding out the right-bundle-branch-block patient (record 118) scored
  0.66 ROC-AUC: those beats are wide like ventricular ones but count as normal.
- **It is a triage aid.** It surfaces beats for human review, states which
  kinds it catches and which it misses, and does not classify arrhythmia
  *type* — only normal vs abnormal morphology.

### CBC analyzer — unsupervised, so there is no accuracy to quote
IsolationForest + KMeans over 20 parameters on 416 samples. There are no
ground-truth labels, so "accuracy" is not a meaningful measure. Cluster
severity is recomputed from centroids at every training run, because cluster
IDs are not stable across retrains — an earlier version hardcoded the mapping
and produced inverted results.

### Bayesian risk engine — real inference, small network
7-node DAG fit with pgmpy from 1,025 records. Every conditional probability
is estimated from data; an earlier version used hardcoded likelihood ratios
dressed up as Bayesian inference. Seven nodes is a teaching-scale network, not
a clinical one.

---

## 2. The AI Doctor

**It is not a doctor and does not diagnose.** It takes a structured history,
suggests traditional self-care, and produces a summary for a clinician. It
never names allopathic drugs, and it discloses that it is an AI in its
opening line rather than waiting to be asked.

**Advice is retrieved, not recalled.** 53 curated documents (14 herbs with
doses and interactions, 20 complaint entries, 10 red-flag triage entries,
9 lifestyle entries), retrieved by TF-IDF and injected into the prompt.

Why TF-IDF and not embeddings: the service already loads XGBoost, pgmpy and
PyTorch, and a sentence-transformer on top risks OOM on a free-tier
container. At 53 documents with domain-specific vocabulary, keyword overlap
is a strong signal. This is a resource trade-off made deliberately, and it
would not be the right call on a large paraphrase-heavy corpus.

**Three deterministic backstops sit under the model**, because an LLM cannot
be trusted as the only safety layer:

1. Suggested herbs are cross-checked against the patient's recorded
   medications and conditions; a hit forces urgency up and flags the report.
2. Transcripts are scanned for emergency co-occurrence patterns independently
   of whether the model noticed.
3. URGENT results create a real clinical Alert over websockets, rather than
   leaving a warning buried in JSON.

### What it cannot do
- No physical examination, vitals, imaging or lab work.
- The interaction rule set covers 14 herbs. Real herb-drug interaction space
  is far larger. This catches the common dangerous combinations, not all of
  them.
- Advice reaches the patient without a human reviewing it first. Escalation
  is after the fact.
- Retrieval is lexical: an unusual phrasing that shares no vocabulary with
  the corpus retrieves nothing and the model falls back to its own knowledge.
- Corpus scope is general primary care and common Ayurvedic remedies. It has
  no paediatric dosing, no oncology, no psychiatry beyond crisis routing.

---

## 3. Security and privacy

**Done:** ownership-based access control on every patient-scoped route, JWT
access/refresh, Redis-backed rate limiting and login lockout, signed Vapi
webhooks, audit logging, non-root containers, secret scanning in CI, and a
global daily cap on AI Doctor spend.

**Not done, and worth saying so:**

- No formal compliance review against India's DPDP Act or HIPAA. Patient
  health data is stored without field-level encryption at rest.
- No penetration test.
- Secrets live in environment variables, not a managed secret store.
- No automated database backups configured.
- No 2FA, even for admin accounts.

For a capstone this is a reasonable posture. For real patient data it is not
sufficient, and that gap is a deliberate scope decision rather than an
oversight.

---

## 4. Scale and operations

Never load-tested. Free-tier hosting sleeps after ~15 minutes idle, so the
first request after a quiet period takes 30–60 seconds. The ml-service runs a
single worker because a free instance cannot hold two copies of the model
stack. Postgres is capped at 0.5 GB.

**Voice calls cost real money.** Vapi bills roughly $0.07–0.25 per minute all
in, against about $10 of trial credit — roughly 40–140 minutes of total talk
time. `AI_DOCTOR_DAILY_CALL_CAP` is a genuine spend guard, enforced globally
rather than per user.

---

## 5. Testing

38 backend tests (auth, RBAC, herb interactions, emergency detection, webhook
verification, PDF generation) and 29 ml-service tests (retrieval quality in
English and Hinglish, red-flag surfacing, prompt budget, and the ECG route:
its verdict matches the probability it reports, demo beats are labelled as
real recordings, and it names the model that actually decided).

Not covered: end-to-end browser tests, load tests, and the live voice call
path — which cannot be tested without spending call credit.

---

## The honest summary

The ML is real and honestly measured, with one model (symptom checker) whose
headline number reflects an easy dataset and one (ECG) that is a screening
aid with known misses. The AI Doctor is grounded in a curated knowledge base
with deterministic safety layers underneath, and is scoped so it never
prescribes. The security model is solid for a student project and explicitly
short of clinical-grade.

Nothing in this project is a medical device, and nothing here should be used
to make a real clinical decision without a qualified doctor.
