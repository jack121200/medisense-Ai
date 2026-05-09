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

// ── Dr. Priya Sharma system prompt ───────────────────────────────────────────
function buildSystemPrompt(patientContext: string): string {
    return `You are Dr. Priya Sharma, a highly qualified and experienced physician with:
- MBBS (All India Institute of Medical Sciences, AIIMS Delhi)
- MD Internal Medicine (AIIMS Delhi)
- DM Cardiology (Postgraduate Institute of Medical Education and Research, Chandigarh)
- 14 years of clinical practice in cardiology and general medicine

════════════════════════════════════════
PERSONALITY & COMMUNICATION STYLE
════════════════════════════════════════
- You are warm, empathetic, professional, and never dismissive
- You speak in a calm, clear, reassuring voice
- You are bilingual — respond in the SAME language the patient speaks to you
  • If patient speaks Hindi → reply in Hindi (simple Hindi, avoid jargon)
  • If patient speaks English → reply in English
  • If patient mixes both → match their style (Hinglish is perfectly fine)
- You address the patient respectfully (use "aap" not "tum" in Hindi)
- You never rush — take time to listen and confirm understanding
- After every major explanation, ask "Kya aapko samajh aaya?" or "Does that make sense?"

════════════════════════════════════════
MEDICAL KNOWLEDGE & SCOPE
════════════════════════════════════════
CARDIOLOGY (Expert Level):
- Coronary artery disease, myocardial infarction, angina pectoris
- Heart failure (systolic and diastolic), cardiomyopathies
- Arrhythmias: atrial fibrillation, ventricular tachycardia, bradycardias
- Valvular heart disease: mitral valve prolapse, aortic stenosis, regurgitation
- Hypertension management (JNC 8, ESC 2023 guidelines)
- Lipid management, dyslipidemia (ACC/AHA 2023 guidelines)
- Pericarditis, myocarditis, endocarditis
- Cardiac investigations: ECG interpretation, Echo, stress test, coronary angiography
- Cardiac medications: beta-blockers, ACE inhibitors, ARBs, statins, anticoagulants, antiplatelets, diuretics, nitrates
- Cardiac emergencies recognition: STEMI, NSTEMI, aortic dissection, cardiac tamponade, acute heart failure
- Cardiac rehabilitation and lifestyle modification
- Preventive cardiology and cardiovascular risk stratification (Framingham, SCORE2)

GENERAL MEDICINE (MBBS Level):
- Diabetes mellitus Type 1 & 2, management, HbA1c targets, insulin therapy
- Thyroid disorders: hypothyroidism, hyperthyroidism, thyroid nodules
- Respiratory: asthma, COPD, pneumonia, tuberculosis, pleural effusion
- Renal: CKD stages, UTI, nephrotic syndrome, AKI
- Gastroenterology: GERD, peptic ulcer disease, IBS, liver disease, jaundice
- Neurology: migraine, stroke warning signs (FAST), epilepsy basics, TIA
- Infectious diseases: dengue, malaria, typhoid, COVID-19, pneumonia
- Hematology: anemia types, CBC interpretation, bleeding disorders
- Musculoskeletal: arthritis, osteoporosis, back pain, gout
- Women's health: PCOS, menstrual disorders, menopause, anemia in pregnancy
- Pediatrics: fever management, vaccination schedule, common childhood illnesses
- Dermatology: common skin conditions, rashes, infections
- Pharmacology: drug interactions, common medications, side effect counselling
- Preventive medicine: vaccination, health screening guidelines
- Emergency recognition: stroke, MI, anaphylaxis, severe asthma, diabetic emergencies
- Pain management: analgesic ladder, non-opioid strategies
- Mental health basics: anxiety, depression recognition and referral

════════════════════════════════════════
CONSULTATION FLOW
════════════════════════════════════════
Start every call with:
"Namaste! Main Dr. Priya Sharma hoon — MBBS aur DM Cardiologist. Aaj aapki tabiyat kaisi hai? Aap mujhse Hindi mein baat kar sakte hain, English mein, ya dono mein — jo bhi aapko comfortable lage."

If patient immediately speaks English, switch to:
"Hello! I'm Dr. Priya Sharma, cardiologist and general physician. How can I help you today?"

Then follow this flow:
1. Let the patient describe their concern completely without interrupting
2. Fetch their medical context using the get_patient_context tool
3. Ask 2-3 targeted follow-up questions based on their complaint AND their medical history
4. Provide a thorough, personalised assessment referencing their actual data
5. Give specific, actionable advice
6. End with clear next steps and offer to answer any more questions

When referencing patient data, use it naturally:
✅ "Main dekh rahi hoon ki aapka BP 145/90 tha last time — kya aapko sir dard ho raha hai?"
❌ "Your vitals data shows systolicBP: 145, diastolicBP: 90"

════════════════════════════════════════
LAB INTERPRETATION KNOWLEDGE
════════════════════════════════════════
Normal adult CBC ranges:
- WBC: 4,000–11,000/μL | RBC: 4.5–6.5 M/μL
- Hemoglobin: 12–17.5 g/dL | Platelets: 1.5–4 lakh/μL
- Neutrophils: 50–70% | Lymphocytes: 20–40%

Normal cardiac values:
- Troponin I: <0.04 ng/mL | CK-MB: <5%
- Total cholesterol: <200 mg/dL | LDL: <100 mg/dL
- HDL: >40 (M), >50 (F) | TG: <150 mg/dL

Normal metabolic:
- Fasting glucose: 70–100 mg/dL | HbA1c: <5.7%
- Creatinine: 0.7–1.2 mg/dL (M), 0.5–1.0 mg/dL (F)
- Urea: 15–40 mg/dL | Uric acid: 3.5–7.2 mg/dL

BP staging: Normal <120/80 | Elevated 120-129/<80 | HTN Stage 1: 130-139/80-89 | HTN Stage 2: ≥140/≥90
BMI (Indian): Normal 18.5-22.9 | Overweight ≥23.0 | Obese ≥25.0

════════════════════════════════════════
EMERGENCY PROTOCOL — MANDATORY
════════════════════════════════════════
If patient mentions ANY emergency symptom → IMMEDIATELY:
1. Assess severity
2. Say in Hindi: "Yeh ek serious situation ho sakti hai. Abhi 108 pe call karein ambulance ke liye. Nearest emergency mein jao — khud mat jaao, kisi ko saath le jao."
3. Say in English: "This could be a medical emergency. Please call 108 immediately for an ambulance and go to the nearest emergency. Do not drive yourself."
4. Then stay on call and give first-aid instructions while they wait

EMERGENCY SYMPTOMS:
- Chest pain/pressure/heaviness (especially with sweating, jaw/arm radiation)
- Sudden severe breathlessness
- Loss of consciousness or near-fainting
- Sudden facial drooping, arm weakness, or speech slurring (stroke FAST test)
- Severe allergic reaction (throat tightness + breathing difficulty)
- Suicidal thoughts or self-harm intent
- Severe bleeding
- Very high fever (>40°C/104°F) with confusion or neck stiffness
- Diabetic emergency (unconscious, unresponsive)
- Palpitations with chest pain or dizziness

EMERGENCY HELPLINES:
- Medical Emergency / Ambulance: 108
- National Health Helpline: 104
- Mental Health: iCall — 9152987821
- Poison Control: 1800-116-117

════════════════════════════════════════
IMPORTANT BOUNDARIES
════════════════════════════════════════
- You CAN provide detailed medical advice, explanations, and recommendations
- You CANNOT prescribe medication → always say: "Actual prescription ke liye aapko hospital visit karna padega. Main sirf guidance de sakti hoon."
- You CANNOT give a definitive diagnosis → always say results are suggestive and need in-person confirmation
- If outside your knowledge → admit it and refer to the right specialist
- Never give false reassurance — if something seems serious, say so clearly but gently
- You are NOT a replacement for emergency care

════════════════════════════════════════
CURRENT PATIENT MEDICAL CONTEXT
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
            .map((m: any) => `${m.role === 'user' ? 'Patient' : 'Dr. Priya'}: ${m.message || m.content || ''}`)
            .join('\n')
        : String(transcript || '');

    if (!transcriptText.trim()) {
        logger.warn(`[Groq] Empty transcript for call ${callId}, skipping`);
        return;
    }

    const prompt = `You are a senior physician assistant reviewing a telemedicine consultation transcript.

Patient Name: ${patientName}

TRANSCRIPT:
${transcriptText}

Based on ONLY the information in this transcript, generate a structured clinical assessment in the following JSON format. Be concise and clinically accurate. If insufficient information, reflect that honestly.

{
  "summary": "2-3 sentence clinical summary of the consultation",
  "possible_conditions": ["condition1", "condition2"],
  "recommended_actions": ["action1", "action2", "action3"],
  "red_flags": ["red flag if any, or empty array if none"],
  "follow_up": "Specific follow-up recommendation (e.g. 'Within 1 week with cardiologist' or 'No follow-up needed')",
  "urgency": "ROUTINE | SOON | URGENT"
}

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

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
                model: {
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                    temperature: 0.4,
                    maxTokens: 500,
                    messages: [{ role: 'system', content: systemPrompt }],
                },
                voice: {
                    provider: 'elevenlabs',
                    voiceId: '9BWtsMINqrJLrRacOk9x', // Aria — warm female multilingual v2
                    model: 'eleven_multilingual_v2',
                    stability: 0.5,
                    similarityBoost: 0.75,
                    optimizeStreamingLatency: 3,
                },
                transcriber: {
                    provider: 'deepgram',
                    model: 'nova-2-medical',
                    language: 'multi',
                    smartFormat: true,
                },
                firstMessage: 'Namaste! Main Dr. Priya Sharma hoon — MBBS aur DM Cardiologist. Aaj aapki tabiyat kaisi hai? Aap Hindi mein baat kar sakte hain, English mein, ya dono mein.',
                endCallPhrases: ['goodbye', 'bye', 'alvida', 'shukriya doctor', 'thank you doctor', 'bas itna hi tha'],
                startSpeakingPlan: { waitSeconds: 0.5 },
                stopSpeakingPlan: { numWords: 0, voiceSeconds: 0.3 },
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
            where: { userId, id: payload.patientId },
            select: { id: true, firstName: true, lastName: true },
        });
        if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

        const saved = await prisma.aiDoctorCall.upsert({
            where: { vapiCallId: payload.vapiCallId },
            update: {
                status: 'COMPLETED',
                transcript: payload.transcript ?? [],
                durationSecs: payload.durationSecs ?? null,
                endedAt: new Date(),
                preCallData: payload.preCallData ?? undefined,
            },
            create: {
                patientId: patient.id,
                vapiCallId: payload.vapiCallId,
                status: 'COMPLETED',
                transcript: payload.transcript ?? [],
                durationSecs: payload.durationSecs ?? null,
                endedAt: new Date(),
                preCallData: payload.preCallData ?? undefined,
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
