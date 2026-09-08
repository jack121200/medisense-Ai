import { detectEmergencyKeywords, flattenTranscript } from '../src/modules/ai-doctor/emergencyDetection';

describe('detectEmergencyKeywords', () => {
    it('matches chest pain co-occurring with sweating', () => {
        const result = detectEmergencyKeywords('Patient: mujhe chest pain ho raha hai aur bahut paseena aa raha hai');
        expect(result.matched).toBe(true);
        expect(result.labels.some(l => l.includes('cardiac'))).toBe(true);
    });

    it('does NOT match chest pain alone, without a co-occurring symptom', () => {
        const result = detectEmergencyKeywords('Patient: mujhe thoda chest pain hai, kal se');
        expect(result.matched).toBe(false);
    });

    it('matches unconsciousness in English', () => {
        const result = detectEmergencyKeywords('The patient became unconscious for a minute');
        expect(result.matched).toBe(true);
    });

    it('matches high fever with confusion (two-group requirement)', () => {
        const result = detectEmergencyKeywords('Patient has tez bukhar and is confused since morning');
        expect(result.matched).toBe(true);
    });

    it('does not false-positive on an ordinary consultation transcript', () => {
        const result = detectEmergencyKeywords(
            'Patient: mujhe thoda sardi zukam hai. Doctor: theek hai, tulsi kadha lijiye. Patient: dhanyavaad.'
        );
        expect(result.matched).toBe(false);
        expect(result.labels).toEqual([]);
    });
});

describe('flattenTranscript', () => {
    it('joins message text from a Vapi-style transcript array, skipping system turns', () => {
        const text = flattenTranscript([
            { role: 'system', message: 'system prompt here' },
            { role: 'assistant', message: 'Namaste!' },
            { role: 'user', message: 'Mujhe chest pain hai' },
        ]);
        expect(text).not.toContain('system prompt here');
        expect(text).toContain('Namaste!');
        expect(text).toContain('Mujhe chest pain hai');
    });

    it('handles a non-array input gracefully', () => {
        expect(flattenTranscript(null as any)).toBe('');
        expect(flattenTranscript(undefined as any)).toBe('');
    });
});
