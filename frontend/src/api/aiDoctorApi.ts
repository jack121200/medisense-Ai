import api from './axiosInstance';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DoctorSuggestions {
    summary: string;
    possible_conditions: string[];
    recommended_actions: string[];
    red_flags: string[];
    follow_up: string;
    urgency: 'ROUTINE' | 'SOON' | 'URGENT';
}

export interface PreCallData {
    reason?: string;
    reportText?: string;
    additionalNotes?: string;
}

export interface AiDoctorCallSummary {
    id: string;
    vapiCallId: string;
    durationSecs: number | null;
    summary: string | null;
    doctorSuggestions: DoctorSuggestions | null;
    preCallData: PreCallData | null;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NO_ANSWER';
    startedAt: string;
    endedAt: string | null;
}

export interface AiDoctorCallDetail extends AiDoctorCallSummary {
    transcript: TranscriptMessage[] | null;
}

export interface TranscriptMessage {
    role: 'user' | 'assistant' | 'system';
    message: string;
    time?: number;
}

export interface StartCallResponse {
    publicKey: string;
    patientId: string;
    patientName: string;
    assistantConfig: any;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const aiDoctorApi = {
    /** Start a new AI Doctor call — send pre-call form data, get Vapi assistant config back */
    startCall: (preCallData?: PreCallData) =>
        api.post<{ success: boolean; data: StartCallResponse }>('/ai-doctor/start-call', preCallData ?? {}),

    /** Save call after it ends — triggers Groq doctor suggestions generation */
    saveCall: (payload: {
        vapiCallId: string;
        patientId: string;
        durationSecs?: number;
        transcript?: TranscriptMessage[];
        preCallData?: PreCallData;
    }) => api.post<{ success: boolean; data: { saved: boolean; callId: string } }>('/ai-doctor/save-call', payload),

    /** Get paginated call history */
    getCalls: (page = 1, limit = 10) =>
        api.get<{
            success: boolean;
            data: AiDoctorCallSummary[];
            pagination: { page: number; limit: number; total: number; totalPages: number };
        }>('/ai-doctor/calls', { params: { page, limit } }),

    /** Get a single call with full transcript + doctor suggestions */
    getCallById: (id: string) =>
        api.get<{ success: boolean; data: AiDoctorCallDetail }>(`/ai-doctor/calls/${id}`),

    /**
     * Extract raw text from a PDF for the pre-call form upload.
     * Goes through the backend proxy (POST /ml/pdf-extract/text) — ml-service
     * is no longer reachable directly from the browser (see Phase 1.8).
     */
    extractPdfText: async (file: File): Promise<{ text: string; pages: number }> => {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/ml/pdf-extract/text', fd);
        return res.data;
    },
};
