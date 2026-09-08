import {
    getContraindicatedHerbs,
    renderContraindicationsForPrompt,
    scanRecommendationsForContraindications,
} from '../src/modules/ai-doctor/herbInteractions';

describe('getContraindicatedHerbs', () => {
    it('flags Ashwagandha for a patient on thyroid medication', () => {
        const flagged = getContraindicatedHerbs({ currentMedications: 'Levothyroxine 50mcg daily' });
        expect(flagged.map(f => f.herb)).toContain('Ashwagandha');
    });

    it('flags Giloy and Neem for a diabetic patient on metformin', () => {
        const flagged = getContraindicatedHerbs({ currentMedications: 'Metformin 500mg twice daily', hasDiabetes: true });
        const herbs = flagged.map(f => f.herb);
        expect(herbs).toContain('Giloy');
        expect(herbs).toContain('Neem');
    });

    it('flags Licorice and Arjuna via the hasHypertension/hasHeartDisease condition flags alone, with no matching medication text', () => {
        const flagged = getContraindicatedHerbs({ currentMedications: '', hasHypertension: true, hasHeartDisease: true });
        const herbs = flagged.map(f => f.herb);
        expect(herbs).toContain('Licorice');
        expect(herbs).toContain('Arjuna');
    });

    it('returns nothing for a patient with no medications or flagged conditions', () => {
        expect(getContraindicatedHerbs({ currentMedications: '' })).toEqual([]);
        expect(getContraindicatedHerbs({})).toEqual([]);
    });

    it('is case-insensitive when matching medication text', () => {
        const flagged = getContraindicatedHerbs({ currentMedications: 'LEVOTHYROXINE' });
        expect(flagged.map(f => f.herb)).toContain('Ashwagandha');
    });
});

describe('renderContraindicationsForPrompt', () => {
    it('returns an empty string when nothing is contraindicated', () => {
        expect(renderContraindicationsForPrompt({ currentMedications: '' })).toBe('');
    });

    it('renders a "do not suggest" block naming the herb and reason', () => {
        const block = renderContraindicationsForPrompt({ currentMedications: 'Levothyroxine' });
        expect(block).toContain('Do NOT suggest Ashwagandha');
        expect(block).toContain('thyroid');
    });
});

describe('scanRecommendationsForContraindications', () => {
    it('catches a contraindicated herb that slipped into the live recommendations anyway', () => {
        const hits = scanRecommendationsForContraindications(
            ['🌿 Ayurvedic Herb: Ashwagandha 500mg at night for 21 days'],
            { currentMedications: 'Levothyroxine 50mcg' }
        );
        expect(hits.map(h => h.herb)).toContain('Ashwagandha');
    });

    it('finds nothing when the recommendations avoided the contraindicated herb', () => {
        const hits = scanRecommendationsForContraindications(
            ['🏠 Home Remedy: warm turmeric milk before bed'],
            { currentMedications: 'Levothyroxine 50mcg' }
        );
        expect(hits).toEqual([]);
    });

    it('finds nothing when the patient has no contraindications at all', () => {
        const hits = scanRecommendationsForContraindications(
            ['🌿 Ayurvedic Herb: Ashwagandha 500mg at night for 21 days'],
            { currentMedications: '' }
        );
        expect(hits).toEqual([]);
    });
});
