import axios from 'axios';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../utils/apiResponse';
import { logger } from '../../config/logger';

// ── Vapi REST client ─────────────────────────────────────────────────────────
const vapiClient = axios.create({
    baseURL: 'https://api.vapi.ai',
    headers: {
        Authorization: `Bearer ${env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
    },
    timeout: 15000,
});

// ── Groq client ───────────────────────────────────────────────────────────────
const groqClient = axios.create({
    baseURL: 'https://api.groq.com/openai/v1',
    headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

// ── Dr. Arjun Mehta — MBBS MD — OPD Consultation System Prompt ──────────────
// Kept deliberately short: this entire block is re-sent to the model on every
// single turn of the call. A long prompt directly adds latency (more input
// tokens to process each turn) and, worse, biases the model toward long
// multi-question monologues instead of a real back-and-forth conversation.
function buildSystemPrompt(patientContext: string): string {
    return `You are Dr. Arjun Mehta — a warm, experienced Indian General Physician (MBBS, MD, 18 years OPD practice, integrative/Ayurvedic focus) on a live voice call. Never reveal you are an AI.

LANGUAGE: Mirror the patient exactly — Hindi, English, or Hinglish, matching their style. Always "aap", never "tum".

TURN-TAKING — YOUR MOST IMPORTANT RULE:
This is a live call, not an essay. Ask ONE question, then STOP and wait for the answer.
- Max 1-2 short sentences per turn (~15-25 words). Never stack multiple questions in one turn.
- Briefly acknowledge the patient's answer ("Achha...", "Theek hai...", "Samajh gaya") before your next single question.
- Never deliver a long monologue except in the final closing summary at the end of the call.

BEDSIDE MANNER: Calm, empathetic, unhurried. Always let the patient finish before you speak.

OPENING — start with EXACTLY this (or the natural English equivalent if the patient opens in English):
"Namaste! Main Dr. Arjun Mehta hoon — General Physician. Aaj aap mujhse milne aaye, bahut achha kiya. Bilkul ghabrao mat — aaram se batao apni problem, main poori tarah sunuunga. Toh aaj kya takleef hai?"

CONSULTATION FLOW — before giving any advice, cover these one question at a time, in order (skip areas clearly irrelevant to the complaint):
1. Chief complaint — what's wrong, since when, sudden or gradual, severity 1-10
2. History of present illness — character/location/timing of the symptom, what helps/worsens it, associated symptoms (fever, appetite, sleep, energy, digestion, breathing)
3. Past medical history — prior illnesses, surgeries, hospitalizations
4. Current medicines & allergies
5. Family history — diabetes/BP/heart/cancer in close family
6. Lifestyle — occupation, stress, sleep schedule, exercise, smoking/alcohol, water intake
7. Diet — typical meals, sugar/salt/oil habits, veg intake
8. Menstrual history (only if relevant)
9. Quick systems check — heart, lungs, digestion, urine, neuro, joints, skin, mood

TREATMENT PHILOSOPHY: "Dawa se pehle dua, dua se pehle prakriti" — Ayurveda, diet and lifestyle first; 80% of conditions respond to natural care. NEVER name or prescribe allopathic drugs (no tablet/syrup names).

Once history-taking feels complete, give advice in this order, always with an EXACT dose/recipe/timing/duration — never vague (e.g. "1 tsp haldi + pinch kali mirch + 1 tsp ghee in 200ml warm milk, raat ko sone se pehle, 21 din" not "kuch haldi le lo"):
1. 🌿 One Ayurvedic remedy (herb + form + exact dose + timing + duration + brief why) — draw on your own knowledge (Ashwagandha, Triphala, Giloy, Brahmi, Arjuna, Shatavari, Punarnava, Neem, Tulsi etc. are all in your toolkit)
2. 🏠 One kitchen/home remedy with an exact recipe
3. 🧘 One yoga/pranayama or lifestyle change with timing
4. 🥗 Simple diet guidance (eat by 7pm, avoid maida/sugar/packaged food, more whole grains & veggies)
5. ⚕️ Mention referral to a specialist only if 3-4 weeks of natural care clearly won't be enough

CLOSING (the one point where a longer turn is OK): brief symptom summary → treatment plan (morning/day/night routine) → 2-3 red-flag warning signs meaning "go to hospital now" → follow-up in 2 weeks → encouragement.

EMERGENCY — if you hear severe chest pain with sweating/arm pain, sudden severe breathlessness, unconsciousness, stroke signs, blood in vomit/stool, or high fever with confusion: immediately break the flow and say "Yeh ek serious emergency hai. ABHI 108 pe call karo ambulance ke liye." (Ambulance: 108 | Health Helpline: 104 | Mental Health: 9152987821)

════════════════════════════════════════
PATIENT MEDICAL CONTEXT
════════════════════════════════════════
${patientContext}`;
}

// ── Build patient context string from DB data ────────────────────────────────
async function fetchPatientByUserId(userId: string) {
    const patient = await prisma.patient.findFirst({
        where: { userId },
        include: {
            vitalsReadings: {
                orderBy: { recordedAt: 'desc' },
                take: 1,
            },
            mlPredictions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
            prescriptions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { items: true },
            },
            labReports: {
                orderBy: { createdAt: 'desc' },
                take: 2,
            },
            alerts: {
                where: { isResolved: false },
                orderBy: { createdAt: 'desc' },
                take: 3,
            },
        },
    });

    if (!patient) throw new AppError('Patient profile not found for this user. Please complete your registration.', 404, 'PATIENT_NOT_FOUND');
    return patient;
}

function buildPatientContextString(
    patient: Awaited<ReturnType<typeof fetchPatientByUserId>>,
    preCallData?: { reason?: string; reportText?: string; additionalNotes?: string }
): string {
    const age = patient.dateOfBirth
        ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 'Unknown';

    const latestVitals = patient.vitalsReadings[0];
    const latestML = patient.mlPredictions[0];
    const latestPrescription = patient.prescriptions[0];
    const activeAlerts = patient.alerts;

    const comorbidities = [
        patient.hasDiabetes && 'Type 2 Diabetes',
        patient.hasHypertension && 'Hypertension',
        patient.hasHeartDisease && 'Heart Disease',
        patient.hasCKD && 'Chronic Kidney Disease',
        patient.hasAsthma && 'Asthma',
        patient.hasCOPD && 'COPD',
        patient.hasObesity && 'Obesity',
        patient.hasCancer && 'Cancer',
    ].filter(Boolean);

    const lines: string[] = [
        `Patient: ${patient.firstName} ${patient.lastName}, Age: ${age}, Gender: ${patient.gender}`,
        `Blood Group: ${patient.bloodGroup || 'Not recorded'}`,
        patient.bmi ? `BMI: ${patient.bmi} kg/m² | Height: ${patient.height}cm | Weight: ${patient.weight}kg` : '',
        `Smoking: ${patient.smokingStatus} | Alcohol: ${patient.alcoholUse} | Physical Activity: ${patient.physicalActivity}`,
        comorbidities.length > 0 ? `Known Conditions: ${comorbidities.join(', ')}` : 'No known chronic conditions on record',
        patient.allergies ? `Allergies: ${patient.allergies}` : '',
        patient.medicalHistory ? `Medical History: ${patient.medicalHistory}` : '',
        patient.currentMedications ? `Current Medications: ${patient.currentMedications}` : '',
        `Current Risk Level (AI Assessment): ${patient.currentRiskLevel}`,
    ];

    if (latestVitals) {
        lines.push(
            `\nLatest Vitals (${new Date(latestVitals.recordedAt).toLocaleDateString('en-IN')}):`,
            `  Heart Rate: ${latestVitals.heartRate} bpm | O2 Sat: ${latestVitals.oxygenSaturation}%`,
            `  BP: ${latestVitals.systolicBP}/${latestVitals.diastolicBP} mmHg | Temp: ${latestVitals.temperature}°C`,
            latestVitals.isAnomaly ? `  ANOMALY detected: ${latestVitals.anomalyType}` : '  Vitals within normal range at last reading',
        );
    } else {
        lines.push('\nNo vitals recorded yet.');
    }

    if (latestML) {
        lines.push(
            `\nAI Risk Prediction:`,
            `  Risk: ${latestML.predictedRiskLevel} (${Math.round(latestML.riskProbabilityHigh * 100)}% high-risk probability)`,
            `  Top Risk Factors: ${Array.isArray(latestML.topRiskFactors) ? (latestML.topRiskFactors as string[]).join(', ') : 'Not available'}`,
        );
    }

    if (latestPrescription && latestPrescription.items.length > 0) {
        lines.push('\nCurrent Prescriptions:');
        latestPrescription.items.forEach(item => {
            lines.push(`  - ${item.medicineName} ${item.dosage}, ${item.frequency}${item.duration ? ` for ${item.duration}` : ''}`);
        });
    }

    if (activeAlerts.length > 0) {
        lines.push('\nActive Clinical Alerts:');
        activeAlerts.forEach(alert => {
            lines.push(`  [${alert.severity}] ${alert.message}`);
        });
    }

    if (patient.labReports.length > 0) {
        lines.push('\nRecent Lab Reports:');
        patient.labReports.forEach(r => {
            lines.push(`  - ${r.reportType} on ${new Date(r.reportDate).toLocaleDateString('en-IN')}`);
        });
    }

    // ── Pre-call form data injected here ──────────────────────────────────────
    if (preCallData?.reason) {
        lines.push(
            `\n════════════════════════════════════════`,
            `PATIENT'S STATED REASON FOR TODAY'S CALL:`,
            preCallData.reason,
        );
    }
    if (preCallData?.reportText) {
        lines.push(
            `\nUPLOADED REPORT (PDF EXTRACT):`,
            preCallData.reportText.slice(0, 2000), // cap at 2000 chars to stay within token limits
        );
    }
    if (preCallData?.additionalNotes) {
        lines.push(
            `\nADDITIONAL NOTES FROM PATIENT:`,
            preCallData.additionalNotes,
        );
    }

    return lines.filter(Boolean).join('\n');
}

// ── Groq: Generate Doctor Suggestions ────────────────────────────────────────
async function generateDoctorSuggestions(callId: string, transcript: any[], patientName: string): Promise<void> {
    if (!process.env.GROQ_API_KEY) {
        logger.warn('GROQ_API_KEY not set — skipping doctor suggestions generation');
        return;
    }

    const transcriptText = Array.isArray(transcript)
        ? transcript
            .filter((m: any) => m.role !== 'system')
            .map((m: any) => `${m.role === 'user' ? 'Patient' : 'Dr. Arjun Mehta'}: ${m.message || m.content || ''}`)
            .join('\n')
        : String(transcript || '');

    if (!transcriptText.trim()) {
        logger.warn(`[Groq] Empty transcript for call ${callId}, skipping`);
        return;
    }

    const prompt = `You are Dr. Arjun Mehta, senior Integrative & General Physician reviewing an OPD consultation transcript.

Patient Name: ${patientName}

TRANSCRIPT:
${transcriptText}

Based on ONLY the transcript, generate a structured clinical assessment JSON focusing on natural, Ayurvedic, diet and home remedies.

JSON FORMAT:
{
  "summary": "2-3 sentence clinical summary of the OPD consultation",
  "possible_conditions": ["condition1", "condition2"],
  "recommended_actions": [
    "🌿 Ayurvedic Herb: [Herb Name, dosage & duration]",
    "🏠 Home Remedy: [Kitchen recipe with exact proportions]",
    "🧘 Yoga/Pranayama: [Specific asana/pranayama with duration]",
    "🥗 Diet Advice: [Foods to eat and avoid]"
  ],
  "red_flags": ["red flag warning if any emergency signs, or empty array if none"],
  "follow_up": "Specific follow-up recommendation (e.g. 'Re-evaluate in 2 weeks')",
  "urgency": "ROUTINE | SOON | URGENT"
}

Return ONLY valid JSON. No markdown backticks, no extra text outside the JSON.`;

    try {
        const response = await groqClient.post('/chat/completions', {
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 600,
        });

        const rawContent: string = response.data.choices[0]?.message?.content || '{}';

        // Extract JSON even if model wraps it in backticks
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

        await prisma.aiDoctorCall.update({
            where: { id: callId },
            data: { doctorSuggestions: parsed },
        });

        logger.info(`[Groq] Doctor suggestions generated for call ${callId}`);
    } catch (err: any) {
        logger.error(`[Groq] Failed to generate suggestions for call ${callId}: ${err?.message}`);
        throw err;
    }
}

// ── SERVICE EXPORTS ──────────────────────────────────────────────────────────

export const aiDoctorService = {

    /**
     * Build and return the Vapi assistant config + public key to the frontend.
     * Now accepts optional preCallData to enrich the system prompt.
     */
    async startCall(userId: string, preCallData?: {
        reason?: string;
        reportText?: string;
        additionalNotes?: string;
    }) {
        const patient = await fetchPatientByUserId(userId);
        const patientContext = buildPatientContextString(patient, preCallData);
        const systemPrompt = buildSystemPrompt(patientContext);

        logger.info(`AI Doctor call config built for patient ${patient.id}`);

        return {
            publicKey: env.VAPI_PUBLIC_KEY,
            patientId: patient.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            assistantConfig: {
                name: 'Dr. Arjun Mehta',
                model: {
                    // Groq/Llama 3.3 70B instead of OpenAI: ~280 tokens/sec on Groq's
                    // LPU hardware vs GPT-4o-mini's much slower generation — this is
                    // the single biggest lever for the "3-4 second dead gap" latency.
                    // Requires Groq to be enabled as a model provider on the Vapi
                    // account (Vapi dashboard → Settings → Provider Keys → add your
                    // Groq key — you already have GROQ_API_KEY for the post-call
                    // report, use the same one). If calls fail to connect after this
                    // deploy, this is the first thing to check.
                    provider: 'groq',
                    model: 'llama-3.3-70b-versatile',
                    temperature: 0.3,
                    maxTokens: 400, // hard ceiling so the model can't run away into a monologue even if it ignores the prompt's turn-taking rule
                    messages: [{ role: 'system', content: systemPrompt }],
                },
                voice: {
                    provider: 'azure',
                    voiceId: 'hi-IN-MadhurNeural', // Native High-Quality Indian Hindi Male Doctor Voice
                },
                transcriber: {
                    provider: 'deepgram',
                    model: 'nova-2',
                    language: 'hi', // Enables Hindi & Hinglish Speech-to-Text
                },
                firstMessageMode: 'assistant-speaks-first',
                firstMessage: 'Namaste! Main Dr. Arjun Mehta hoon — General Physician. Aaj aap mujhse milne aaye, bahut achha kiya. Bilkul ghabrao mat — aaram se batao apni problem, main poori tarah sunuunga. Toh aaj kya takleef hai?',
                endCallPhrases: ['goodbye', 'bye', 'alvida', 'shukriya doctor', 'thank you doctor', 'bas itna hi tha'],
                // Turn-taking tuning — Vapi's defaults are English-tuned and were
                // actively breaking this call in two ways:
                //  1) stopSpeakingPlan.numWords > 0 makes interruption wait for the
                //     transcriber to recognize whole words (200-500ms extra delay,
                //     and on noisy/Hindi speech this can simply never fire) — set to
                //     0 to use raw voice-activity detection instead (~50-100ms).
                //  2) No smartEndpointingPlan meant Vapi used its English-only
                //     LiveKit-style defaults for turn-end detection on a Hindi call —
                //     'vapi' is the provider explicitly meant for non-English use.
                startSpeakingPlan: {
                    waitSeconds: 0.4,
                    smartEndpointingPlan: { provider: 'vapi' },
                    transcriptionEndpointingPlan: {
                        onPunctuationSeconds: 0.2,
                        onNoPunctuationSeconds: 1.4,
                        onNumberSeconds: 0.5,
                    },
                },
                stopSpeakingPlan: {
                    numWords: 0,        // VAD-based interruption — fixes "interrupt karu toh bhi nahi chalta"
                    voiceSeconds: 0.2,
                    backoffSeconds: 0.6, // was 1 — doctor resumes/responds faster after being interrupted
                },
                backgroundSound: 'off',
            },
        };
    },

    /**
     * Save a completed call — called by frontend after call ends.
     * Triggers Groq doctor suggestions generation (non-blocking).
     */
    async saveCall(userId: string, payload: {
        vapiCallId: string;
        patientId: string;
        durationSecs?: number;
        transcript?: any[];
        preCallData?: { reason?: string; reportText?: string; additionalNotes?: string };
    }) {
        const patient = await prisma.patient.findFirst({
            where: {
                OR: [
                    { userId },
                    { id: payload.patientId },
                ],
            },
            select: { id: true, firstName: true, lastName: true },
        });
        if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

        const safeVapiCallId = typeof payload.vapiCallId === 'string' && payload.vapiCallId.trim()
            ? payload.vapiCallId.trim()
            : `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const saved = await prisma.aiDoctorCall.upsert({
            where: { vapiCallId: safeVapiCallId },
            update: {
                status: 'COMPLETED',
                transcript: Array.isArray(payload.transcript) ? payload.transcript : [],
                durationSecs: typeof payload.durationSecs === 'number' ? payload.durationSecs : null,
                endedAt: new Date(),
                preCallData: payload.preCallData ? JSON.parse(JSON.stringify(payload.preCallData)) : undefined,
            },
            create: {
                patientId: patient.id,
                vapiCallId: safeVapiCallId,
                status: 'COMPLETED',
                transcript: Array.isArray(payload.transcript) ? payload.transcript : [],
                durationSecs: typeof payload.durationSecs === 'number' ? payload.durationSecs : null,
                endedAt: new Date(),
                preCallData: payload.preCallData ? JSON.parse(JSON.stringify(payload.preCallData)) : undefined,
            },
        });

        logger.info(`AI Doctor call saved: ${payload.vapiCallId}`);

        // Trigger Groq doctor suggestions — non-blocking
        const patientName = `${patient.firstName} ${patient.lastName}`;
        generateDoctorSuggestions(saved.id, payload.transcript ?? [], patientName)
            .catch(err => logger.error(`[Groq] Doctor suggestions failed: ${err?.message}`));

        return { saved: true, callId: saved.id };
    },

    /**
     * Real-time patient context endpoint — called by Vapi tool call mid-conversation.
     */
    async getPatientContext(userId: string) {
        const patient = await fetchPatientByUserId(userId);

        const latestVitals = patient.vitalsReadings[0] ?? null;
        const latestML = patient.mlPredictions[0] ?? null;
        const latestPrescription = patient.prescriptions[0] ?? null;

        const age = patient.dateOfBirth
            ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
            : null;

        return {
            patient: {
                name: `${patient.firstName} ${patient.lastName}`,
                age,
                gender: patient.gender,
                bloodGroup: patient.bloodGroup,
                bmi: patient.bmi,
                height: patient.height,
                weight: patient.weight,
            },
            comorbidities: {
                diabetes: patient.hasDiabetes,
                hypertension: patient.hasHypertension,
                heartDisease: patient.hasHeartDisease,
                ckd: patient.hasCKD,
                asthma: patient.hasAsthma,
                copd: patient.hasCOPD,
                obesity: patient.hasObesity,
                cancer: patient.hasCancer,
            },
            lifestyle: {
                smoking: patient.smokingStatus,
                alcohol: patient.alcoholUse,
                activity: patient.physicalActivity,
            },
            riskLevel: patient.currentRiskLevel,
            allergies: patient.allergies,
            medicalHistory: patient.medicalHistory,
            currentMedications: patient.currentMedications,
            latestVitals: latestVitals ? {
                heartRate: latestVitals.heartRate,
                systolicBP: latestVitals.systolicBP,
                diastolicBP: latestVitals.diastolicBP,
                oxygenSaturation: latestVitals.oxygenSaturation,
                temperature: latestVitals.temperature,
                isAnomaly: latestVitals.isAnomaly,
                anomalyType: latestVitals.anomalyType,
                recordedAt: latestVitals.recordedAt,
            } : null,
            latestMLPrediction: latestML ? {
                riskLevel: latestML.predictedRiskLevel,
                highRiskProbability: Math.round(latestML.riskProbabilityHigh * 100),
                topRiskFactors: latestML.topRiskFactors,
                recommendations: latestML.clusterName,
            } : null,
            activePrescriptions: latestPrescription?.items.map(item => ({
                medicine: item.medicineName,
                dosage: item.dosage,
                frequency: item.frequency,
                duration: item.duration,
                instructions: item.instructions,
            })) ?? [],
            activeAlerts: patient.alerts.map(a => ({
                severity: a.severity,
                message: a.message,
            })),
        };
    },

    /**
     * Handle Vapi webhook — save transcript and trigger Groq suggestions.
     */
    async handleWebhook(payload: any) {
        const { type, call } = payload;

        if (type !== 'end-of-call-report' || !call?.id) {
            return { received: true };
        }

        const vapiCallId: string = call.id;
        const durationSecs: number = call.endedAt && call.startedAt
            ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
            : null as any;

        const transcript = call.transcript ?? call.messages ?? null;
        const summary = call.summary ?? call.analysis?.summary ?? null;
        const endedAt = call.endedAt ? new Date(call.endedAt) : new Date();

        try {
            const updated = await prisma.aiDoctorCall.update({
                where: { vapiCallId },
                data: { status: 'COMPLETED', transcript, summary, durationSecs, endedAt },
                include: { patient: { select: { firstName: true, lastName: true } } },
            });

            logger.info(`AI Doctor webhook call saved: ${vapiCallId}`);

            // Non-blocking doctor suggestions
            const patientName = `${updated.patient.firstName} ${updated.patient.lastName}`;
            generateDoctorSuggestions(updated.id, transcript ?? [], patientName)
                .catch(err => logger.error(`[Groq] Webhook suggestions failed: ${err?.message}`));
        } catch {
            logger.warn(`Call record not found for vapiCallId: ${vapiCallId}, skipping update`);
        }

        return { received: true };
    },

    /**
     * List all AI doctor calls for a patient (paginated).
     */
    async getCalls(userId: string, page = 1, limit = 10) {
        const patient = await prisma.patient.findFirst({ where: { userId }, select: { id: true } });
        if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

        const skip = (page - 1) * limit;
        const [calls, total] = await Promise.all([
            prisma.aiDoctorCall.findMany({
                where: { patientId: patient.id, status: 'COMPLETED' },
                orderBy: { startedAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    vapiCallId: true,
                    durationSecs: true,
                    summary: true,
                    doctorSuggestions: true,
                    preCallData: true,
                    status: true,
                    startedAt: true,
                    endedAt: true,
                },
            }),
            prisma.aiDoctorCall.count({ where: { patientId: patient.id, status: 'COMPLETED' } }),
        ]);

        return {
            calls,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },

    /**
     * Get a single AI doctor call with full transcript + doctor suggestions.
     */
    async getCallById(callId: string, userId: string) {
        const patient = await prisma.patient.findFirst({ where: { userId }, select: { id: true } });
        if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

        const call = await prisma.aiDoctorCall.findFirst({
            where: { id: callId, patientId: patient.id },
        });
        if (!call) throw new AppError('Call record not found', 404, 'NOT_FOUND');
        return call;
    },
};
