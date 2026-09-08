/**
 * Deterministic emergency-keyword backstop for AI Doctor calls.
 *
 * The system prompt already instructs the model to break flow and say
 * "call 108" on hearing certain red-flag phrases (ai-doctor.service.ts).
 * That's entirely dependent on the LLM actually catching the phrase
 * mid-conversation, with nothing server-side double-checking it. This
 * scans the saved transcript after the call (see ai-doctor.service.ts'
 * saveCall/handleWebhook) as a deterministic second check — if it finds
 * something the live conversation might have missed, the saved call
 * record gets flagged for real (forced URGENT + a note), regardless of
 * what the model actually said out loud.
 *
 * This is a text-matching heuristic, not a clinical triage system —
 * matches over-flag more than they under-flag on purpose (a false
 * positive costs a receptionist a look; a false negative costs a lot
 * more), and it should be reviewed/extended by a clinician before this
 * is relied on for anything beyond a capstone demo.
 */

interface EmergencyPattern {
    label: string;
    // Every group must have at least one hit for the pattern to match —
    // lets us require co-occurrence (e.g. chest pain AND sweating), not
    // just any one scary-sounding word in isolation.
    requireGroups: string[][];
}

const EMERGENCY_PATTERNS: EmergencyPattern[] = [
    {
        label: 'Possible cardiac emergency (chest pain + associated symptom)',
        requireGroups: [
            ['chest pain', 'seene mein dard', 'chest mein dard', 'seene me dard'],
            ['sweating', 'paseena', 'arm pain', 'baayan haath', 'jaw pain', 'jabde mein dard', 'shortness of breath', 'saans lene mein takleef'],
        ],
    },
    {
        label: 'Sudden severe breathlessness',
        requireGroups: [
            ['can\'t breathe', 'cannot breathe', 'saans nahi aa rahi', 'saans phool rahi', 'severe breathlessness', 'gasping'],
        ],
    },
    {
        label: 'Loss of consciousness / unresponsiveness',
        requireGroups: [
            ['unconscious', 'fainted', 'behosh', 'behoshi', 'passed out', 'not responding'],
        ],
    },
    {
        label: 'Possible stroke signs',
        requireGroups: [
            ['face drooping', 'slurred speech', 'weakness on one side', 'ek taraf kamzori', 'muh tedha', 'bolne mein dikkat', 'sudden confusion'],
        ],
    },
    {
        label: 'GI bleeding',
        requireGroups: [
            ['blood in vomit', 'blood in stool', 'khoon ki ulti', 'khoon aana', 'vomiting blood', 'black stool'],
        ],
    },
    {
        label: 'High fever with confusion',
        requireGroups: [
            ['high fever', 'tez bukhar'],
            ['confusion', 'confused', 'disoriented', 'bewajah bakwaas', 'behosh jaisa'],
        ],
    },
];

export interface EmergencyDetectionResult {
    matched: boolean;
    labels: string[];
}

/**
 * Scans plain transcript text (already flattened from the structured
 * transcript array) for emergency patterns. Case-insensitive.
 */
export function detectEmergencyKeywords(transcriptText: string): EmergencyDetectionResult {
    const lower = (transcriptText || '').toLowerCase();
    const labels: string[] = [];

    for (const pattern of EMERGENCY_PATTERNS) {
        const allGroupsHit = pattern.requireGroups.every((group) =>
            group.some((phrase) => lower.includes(phrase.toLowerCase()))
        );
        if (allGroupsHit) labels.push(pattern.label);
    }

    return { matched: labels.length > 0, labels };
}

/** Flattens a Vapi-style transcript array (role/message pairs) into plain text for scanning. */
export function flattenTranscript(transcript: any[]): string {
    if (!Array.isArray(transcript)) return String(transcript || '');
    return transcript
        .filter((m: any) => m && m.role !== 'system')
        .map((m: any) => m.message || m.content || '')
        .join(' \n ');
}
