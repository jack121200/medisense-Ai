/**
 * Herb–drug interaction guard for the AI Doctor.
 *
 * The AI Doctor's toolkit (see buildSystemPrompt in ai-doctor.service.ts)
 * lists Ashwagandha, Triphala, Giloy, Brahmi, Arjuna, Shatavari, Punarnava,
 * Neem, and Tulsi. Every one of these has at least one real, documented
 * interaction with common medication classes or conditions. Previously
 * NOTHING checked a suggested herb against the patient's own
 * currentMedications/comorbidities — it was left entirely to the LLM's
 * judgment mid-conversation, with no deterministic backstop.
 *
 * This is used two ways (see ai-doctor.service.ts):
 *   1. PREVENTION — computed before the call starts and injected into the
 *      system prompt as an explicit "do not suggest" list, so the model
 *      is told up front rather than trusted to infer it from a raw
 *      medications string.
 *   2. DETECTION — run again as a deterministic backstop over the
 *      post-call Groq-generated recommended_actions, in case the live
 *      conversation suggested something anyway.
 *
 * This list is illustrative, not exhaustive or clinically validated —
 * see the project's known-limitations notes. It should be reviewed by a
 * pharmacist/physician before this ever reaches a real patient.
 */

export interface PatientForInteractionCheck {
    currentMedications?: string | null;
    hasHypertension?: boolean;
    hasDiabetes?: boolean;
    hasHeartDisease?: boolean;
    hasCancer?: boolean;
}

export interface HerbRule {
    herb: string;
    /** Case-insensitive substring matches against the patient's free-text currentMedications. */
    medicationKeywords: string[];
    /** Structured comorbidity flags that also trigger this rule, independent of medication text. */
    conditionFlags?: Array<keyof PatientForInteractionCheck>;
    reason: string;
}

export const HERB_INTERACTION_RULES: HerbRule[] = [
    {
        herb: 'Ashwagandha',
        medicationKeywords: [
            'thyroxine', 'levothyroxine', 'eltroxin', 'thyronorm', 'synthroid', 'thyroid',
            'diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'benzodiazepine', 'sedative',
        ],
        reason: 'Ashwagandha can raise thyroid hormone levels and potentiate sedatives — caution with thyroid medication or benzodiazepines.',
    },
    {
        herb: 'Giloy',
        medicationKeywords: [
            'cyclosporine', 'tacrolimus', 'azathioprine', 'mycophenolate', 'immunosuppressant', 'steroid', 'prednisone',
            'metformin', 'insulin', 'glimepiride', 'glipizide',
        ],
        conditionFlags: ['hasDiabetes', 'hasCancer'],
        reason: 'Giloy (Guduchi) stimulates the immune system (caution with immunosuppressants) and can lower blood sugar (caution with diabetes medication — additive hypoglycemia risk).',
    },
    {
        herb: 'Licorice',
        medicationKeywords: [
            'amlodipine', 'losartan', 'telmisartan', 'enalapril', 'ramipril', 'metoprolol', 'atenolol', 'digoxin',
        ],
        conditionFlags: ['hasHypertension', 'hasHeartDisease'],
        reason: 'Licorice (Mulethi) can raise blood pressure and counteract antihypertensive/cardiac medication.',
    },
    {
        herb: 'Brahmi',
        medicationKeywords: ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'sedative', 'thyroxine', 'levothyroxine', 'thyroid'],
        reason: 'Brahmi can potentiate sedatives and may affect thyroid medication levels.',
    },
    {
        herb: 'Arjuna',
        medicationKeywords: ['digoxin', 'metoprolol', 'atenolol', 'amlodipine', 'beta blocker'],
        conditionFlags: ['hasHeartDisease'],
        reason: 'Arjuna has mild cardiac (inotropic) effects and blood-pressure-lowering effects — caution alongside digoxin or other cardiac/BP medication; needs clinician oversight, not self-directed use.',
    },
    {
        herb: 'Neem',
        medicationKeywords: ['metformin', 'insulin', 'glimepiride', 'glipizide', 'cyclosporine', 'tacrolimus', 'immunosuppressant'],
        conditionFlags: ['hasDiabetes'],
        reason: 'Neem can lower blood sugar (additive hypoglycemia risk with diabetes medication) and has immune-stimulating effects.',
    },
    {
        herb: 'Punarnava',
        medicationKeywords: ['furosemide', 'lithium', 'diuretic'],
        reason: 'Punarnava has a diuretic-like effect — caution alongside other diuretics or lithium (risk of dehydration/electrolyte or lithium-level changes).',
    },
];

function textIncludesAny(text: string, keywords: string[]): boolean {
    const lower = text.toLowerCase();
    return keywords.some((k) => lower.includes(k.toLowerCase()));
}

/**
 * Returns the subset of the AI Doctor's herb toolkit that should be
 * avoided (or flagged) for this specific patient, with the reason why.
 */
export function getContraindicatedHerbs(patient: PatientForInteractionCheck): Array<{ herb: string; reason: string }> {
    const meds = (patient.currentMedications || '').trim();
    const flagged: Array<{ herb: string; reason: string }> = [];

    for (const rule of HERB_INTERACTION_RULES) {
        const medicationHit = meds.length > 0 && textIncludesAny(meds, rule.medicationKeywords);
        const conditionHit = (rule.conditionFlags || []).some((flag) => patient[flag] === true);
        if (medicationHit || conditionHit) {
            flagged.push({ herb: rule.herb, reason: rule.reason });
        }
    }

    return flagged;
}

/** Renders the contraindication list as a prompt-ready block, or '' if none apply. */
export function renderContraindicationsForPrompt(patient: PatientForInteractionCheck): string {
    const flagged = getContraindicatedHerbs(patient);
    if (flagged.length === 0) return '';

    const lines = flagged.map((f) => `  - Do NOT suggest ${f.herb}. Reason: ${f.reason}`);
    return [
        '',
        'HERB SAFETY — DO NOT SUGGEST THESE, computed from this patient\'s own medications/conditions:',
        ...lines,
        '  If none of your other toolkit herbs fit, prefer a home/kitchen remedy or diet/lifestyle advice instead.',
    ].join('\n');
}

/**
 * Deterministic post-call backstop: scans Groq's generated
 * recommended_actions text for any herb name that should have been
 * avoided for this patient, in case the live conversation suggested one
 * anyway. Returns the flags found (empty if none) — caller decides how
 * to surface them (e.g. append to red_flags, force urgency up).
 */
export function scanRecommendationsForContraindications(
    recommendedActions: string[],
    patient: PatientForInteractionCheck
): Array<{ herb: string; reason: string }> {
    const contraindicated = getContraindicatedHerbs(patient);
    if (contraindicated.length === 0 || recommendedActions.length === 0) return [];

    const actionsText = recommendedActions.join(' \n ').toLowerCase();
    return contraindicated.filter((c) => actionsText.includes(c.herb.toLowerCase()));
}
