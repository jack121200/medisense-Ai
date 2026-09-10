import axios from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * Client for ml-service's curated health knowledge base.
 *
 * Retrieval runs twice per consultation — once at call setup (keyed on the
 * patient's stated reason) and once when the post-call report is generated
 * (keyed on the transcript). Never per conversation turn: the retrieved text
 * is baked into the system prompt at setup, so the live voice loop never
 * waits on this.
 *
 * Mirrors the mlClient pattern in modules/ml/ml.service.ts rather than
 * importing it, because this needs a much shorter timeout — grounding is a
 * nice-to-have on a call that is already connecting, and a slow ml-service
 * must not hold up call setup.
 */
const ragClient = axios.create({
    baseURL: env.ML_SERVICE_URL,
    timeout: 4000,
    headers: { 'X-Internal-Service-Key': env.ML_SERVICE_INTERNAL_KEY },
});

export interface RetrievedKnowledge {
    promptBlock: string;
    hasRedFlag: boolean;
    documentIds: string[];
}

const EMPTY: RetrievedKnowledge = { promptBlock: '', hasRedFlag: false, documentIds: [] };

/**
 * Fetch grounding text for a complaint. Always resolves — retrieval failing
 * degrades the answer to un-grounded (which is what the assistant did before
 * this existed), and that is strictly better than failing the call.
 */
export async function retrieveKnowledge(query: string, topK = 4): Promise<RetrievedKnowledge> {
    const trimmed = (query || '').trim();
    if (!trimmed) return EMPTY;

    try {
        const { data } = await ragClient.post('/api/rag/retrieve', {
            query: trimmed.slice(0, 4000),
            top_k: topK,
            render: true,
        });
        return {
            promptBlock: data?.prompt_block || '',
            hasRedFlag: Boolean(data?.has_red_flag),
            documentIds: (data?.documents || []).map((d: { id: string }) => d.id),
        };
    } catch (err: any) {
        logger.warn(`[RAG] Retrieval failed, continuing without grounding: ${err?.message}`);
        return EMPTY;
    }
}

/** Wraps retrieved text in the block the system prompt expects. */
export function renderKnowledgeBlock(knowledge: RetrievedKnowledge): string {
    if (!knowledge.promptBlock) return '';
    return [
        '',
        '════════════════════════════════════════',
        'VERIFIED KNOWLEDGE BASE — GROUND YOUR ADVICE IN THIS',
        'These entries are retrieved from MediSense\'s curated reference set for',
        'this specific complaint. Prefer them over recalled knowledge, follow the',
        'stated doses, and honour every "Avoid if" and "See a doctor" line.',
        '════════════════════════════════════════',
        knowledge.promptBlock,
    ].join('\n');
}
