import React, { useState, useEffect, useRef, useCallback } from 'react';
import Vapi from '@vapi-ai/web';
import {
    Mic, MicOff, PhoneOff, Phone, Clock, FileText,
    ChevronDown, ChevronUp, Activity, Stethoscope,
    AlertCircle, CheckCircle, Upload, X, AlertTriangle,
    Zap, Calendar, User, Heart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    aiDoctorApi,
    AiDoctorCallSummary,
    AiDoctorCallDetail,
    TranscriptMessage,
    DoctorSuggestions,
    PreCallData,
} from '../api/aiDoctorApi';

// ── Types ─────────────────────────────────────────────────────────────────────
type CallStatus = 'idle' | 'pre-call-form' | 'connecting' | 'active' | 'ending' | 'ended';
type ActiveTab = 'talk' | 'history';

// ── Urgency config ────────────────────────────────────────────────────────────
const URGENCY_CFG: Record<string, { color: string; bg: string; label: string }> = {
    URGENT:  { color: 'var(--accent-primary)', bg: 'rgba(194, 91, 60, 0.12)',  label: '🚨 URGENT'  },
    SOON:    { color: 'var(--vitals-temp)', bg: 'rgba(210, 132, 60, 0.12)', label: '⚠️ SOON'    },
    ROUTINE: { color: 'var(--risk-low)', bg: 'rgba(62, 142, 126, 0.12)',  label: '✅ ROUTINE'  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(secs: number | null) {
    if (!secs) return '–';
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}
function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// ── Pulsing Orb ───────────────────────────────────────────────────────────────
function PulsingOrb({ active }: { active: boolean }) {
    return (
        <div style={{ position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {active && (
                <>
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))',
                        opacity: 0.15, animation: 'ping 1.5s ease-in-out infinite',
                    }} />
                    <div style={{
                        position: 'absolute', inset: '16px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))',
                        opacity: 0.2, animation: 'ping 2s ease-in-out infinite',
                    }} />
                </>
            )}
            <div style={{
                width: 130, height: 130, borderRadius: '50%',
                background: active
                    ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))'
                    : 'var(--text-muted)',
                border: `3px solid ${active ? 'rgba(194, 91, 60, 0.4)' : 'var(--surface-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.4s ease',
                boxShadow: active ? '0 0 60px rgba(194, 91, 60, 0.35)' : 'none',
            }}>
                <Stethoscope size={48} color={active ? 'var(--text-primary)' : 'var(--text-muted)'} />
            </div>
            <style>{`
                @keyframes ping {
                    0% { transform: scale(1); opacity: 0.25; }
                    70% { transform: scale(1.15); opacity: 0; }
                    100% { transform: scale(1.15); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

// ── Doctor's Report Card ──────────────────────────────────────────────────────
function DoctorReportCard({ suggestions, onDismiss }: { suggestions: DoctorSuggestions; onDismiss?: () => void }) {
    const urgency = URGENCY_CFG[suggestions.urgency] || URGENCY_CFG.ROUTINE;
    return (
        <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--surface-border)',
            borderRadius: 20, overflow: 'hidden',
            animation: 'fadeIn 0.5s ease',
        }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* Header */}
            <div style={{
                padding: '18px 22px',
                background: 'linear-gradient(135deg, rgba(194, 91, 60, 0.15), rgba(162, 71, 44, 0.1))',
                borderBottom: '1px solid var(--surface-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Stethoscope size={18} color="#fff" />
                    </div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Priya's Assessment (AI-Generated)</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>AI-generated post-consultation report</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
                        background: urgency.bg, color: urgency.color,
                        border: `1px solid ${urgency.color}40`,
                    }}>{urgency.label}</span>
                    {onDismiss && (
                        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Summary */}
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>📋 Summary</div>
                    <p style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>{suggestions.summary}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {/* Possible Conditions */}
                    {suggestions.possible_conditions?.length > 0 && (
                        <div style={{ background: 'rgba(194, 91, 60, 0.08)', border: '1px solid rgba(194, 91, 60, 0.2)', borderRadius: 12, padding: '12px 14px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>🔍 Possible Conditions</div>
                            {suggestions.possible_conditions.map((c, i) => (
                                <div key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>• {c}</div>
                            ))}
                        </div>
                    )}

                    {/* Recommended Actions */}
                    {suggestions.recommended_actions?.length > 0 && (
                        <div style={{ background: 'rgba(62, 142, 126, 0.06)', border: '1px solid rgba(62, 142, 126, 0.2)', borderRadius: 12, padding: '12px 14px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--risk-low)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>✅ Recommended Actions</div>
                            {suggestions.recommended_actions.map((a, i) => (
                                <div key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>• {a}</div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Red Flags */}
                {suggestions.red_flags?.length > 0 ? (
                    <div style={{ background: 'rgba(194, 91, 60, 0.08)', border: '1px solid rgba(194, 91, 60, 0.25)', borderRadius: 12, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <AlertTriangle size={13} color="var(--accent-primary)" />
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Red Flags</div>
                        </div>
                        {suggestions.red_flags.map((f, i) => (
                            <div key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>• {f}</div>
                        ))}
                    </div>
                ) : (
                    <div style={{ background: 'rgba(62, 142, 126, 0.06)', border: '1px solid rgba(62, 142, 126, 0.15)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={13} color="var(--risk-low)" />
                        <span style={{ fontSize: 12, color: 'var(--risk-low)' }}>No red flags identified</span>
                    </div>
                )}

                {/* Follow-up */}
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={14} color="var(--text-muted)" />
                    <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Follow-up: </span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{suggestions.follow_up}</span>
                    </div>
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                    * This report is AI-generated for informational purposes only and does not constitute a medical diagnosis or prescription. Please consult a qualified physician for medical advice.
                </p>
            </div>
        </div>
    );
}

// ── Pre-Call Form Modal ───────────────────────────────────────────────────────
function PreCallModal({
    onStart, onCancel,
}: {
    onStart: (data: PreCallData) => void;
    onCancel: () => void;
}) {
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [reportText, setReportText] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    // Ask for mic permission the moment this form opens, not after the user
    // clicks "Proceed" — the OS permission dialog (and any user hesitation
    // answering it) previously sat directly in the critical path right
    // before the call connected. Doing it here overlaps that latency with
    // the time the patient spends typing their reason for the visit.
    useEffect(() => {
        navigator.mediaDevices?.getUserMedia({ audio: true })
            .then(stream => stream.getTracks().forEach(track => track.stop()))
            .catch(() => { /* surfaced again, with a clear error, at actual call start */ });
    }, []);

    const handleFile = async (file: File) => {
        setPdfFile(file);
        setUploading(true);
        try {
            const result = await aiDoctorApi.extractPdfText(file);
            setReportText(result.text);
            toast.success(`Extracted ${result.text.length} characters from ${file.name}`);
        } catch {
            toast.error('PDF extraction failed — report text will not be included');
        } finally {
            setUploading(false);
        }
    };

    const handleStart = () => {
        if (!reason.trim()) { toast.error('Please enter your reason for consultation'); return; }
        onStart({ reason: reason.trim(), reportText: reportText || undefined, additionalNotes: notes.trim() || undefined });
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(90, 65, 45, 0.16)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
            <div style={{
                width: '100%', maxWidth: 560,
                background: 'linear-gradient(180deg, var(--surface-1) 0%, var(--bg-secondary) 100%)',
                border: '1px solid var(--surface-border-md)', borderRadius: 24,
                boxShadow: '0 40px 80px rgba(90, 65, 45, 0.16)',
                animation: 'slideUp 0.3s ease',
            }}>
                <style>{`@keyframes slideUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }`}</style>

                {/* Modal header */}
                <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Before we begin...</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Help Priya, your AI health assistant, prepare</div>
                    </div>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Reason */}
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
                            📋 Main reason for consultation <span style={{ color: 'var(--accent-primary)' }}>*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={3}
                            placeholder="e.g. chest pain for last 2 days, high BP readings, routine checkup..."
                            style={{
                                width: '100%', padding: '11px 14px', boxSizing: 'border-box',
                                background: 'var(--surface-1)', border: '1px solid var(--surface-border-md)',
                                borderRadius: 10, color: 'var(--text-primary)', fontSize: 13.5, resize: 'vertical',
                                outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
                            }}
                            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(194, 91, 60, 0.6)')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'var(--surface-border)')}
                        />
                    </div>

                    {/* PDF Upload */}
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
                            📎 Upload Medical Report (optional)
                        </label>
                        <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
                            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

                        {pdfFile ? (
                            <div style={{
                                padding: '10px 14px', background: 'rgba(194, 91, 60, 0.08)', border: '1px solid rgba(194, 91, 60, 0.3)',
                                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FileText size={14} color="var(--accent-primary)" />
                                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{pdfFile.name}</span>
                                    {uploading && <span style={{ fontSize: 11, color: 'var(--accent-primary)' }}>Extracting...</span>}
                                    {!uploading && reportText && <CheckCircle size={13} color="var(--risk-low)" />}
                                </div>
                                <button onClick={() => { setPdfFile(null); setReportText(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => fileRef.current?.click()} style={{
                                width: '100%', padding: '12px', background: 'var(--surface-1)',
                                border: '2px dashed var(--surface-border-md)', borderRadius: 10,
                                color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                transition: 'all 0.2s',
                            }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(194, 91, 60, 0.5)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--surface-border-md)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--surface-border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--surface-border)'; }}
                            >
                                <Upload size={16} /> Choose PDF / DOCX (lab report, prescription, etc.)
                            </button>
                        )}
                    </div>

                    {/* Additional Notes */}
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
                            📝 Anything else Priya should know? (optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            placeholder="e.g. currently on Metformin, diabetic, allergic to penicillin..."
                            style={{
                                width: '100%', padding: '10px 14px', boxSizing: 'border-box',
                                background: 'var(--surface-1)', border: '1px solid var(--surface-border-md)',
                                borderRadius: 10, color: 'var(--text-primary)', fontSize: 13.5, resize: 'vertical',
                                outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
                            }}
                            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(194, 91, 60, 0.6)')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'var(--surface-border)')}
                        />
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                        <button onClick={onCancel} style={{
                            flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--surface-border-md)',
                            background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
                        }}>Cancel</button>
                        <button onClick={handleStart} disabled={uploading} style={{
                            flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                            background: uploading ? 'rgba(194, 91, 60, 0.4)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))',
                            color: 'var(--text-primary)', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 13.5, fontWeight: 800,
                            boxShadow: '0 4px 20px rgba(194, 91, 60, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}>
                            <Phone size={16} /> Proceed to Consultation →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Live Transcript Panel ─────────────────────────────────────────────────────
function LiveTranscriptPanel({ messages, partial }: { messages: TranscriptMessage[]; partial: TranscriptMessage | null }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [messages, partial]);

    return (
        <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
            borderRadius: 18, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block', animation: 'ping 1.2s ease infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Transcript</span>
            </div>
            <div ref={ref} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'thin' }}>
                {messages.length === 0 && !partial ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 30 }}>
                        Conversation will appear here...
                    </div>
                ) : (
                    <>
                        {messages.filter(m => m.role !== 'system').map((msg, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--risk-low)', marginBottom: 3, letterSpacing: '0.05em' }}>
                                    {msg.role === 'user' ? 'You' : 'Priya (AI)'}
                                </div>
                                <div style={{
                                    maxWidth: '88%', padding: '9px 13px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                    background: msg.role === 'user' ? 'rgba(194, 91, 60, 0.25)' : 'var(--surface-2)',
                                    border: `1px solid ${msg.role === 'user' ? 'rgba(194, 91, 60, 0.3)' : 'var(--surface-border)'}`,
                                    fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55,
                                }}>
                                    {msg.message}
                                </div>
                            </div>
                        ))}
                        {/* In-progress (not-yet-final) speech — shows what's being said right now */}
                        {partial && partial.message.trim() && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: partial.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: partial.role === 'user' ? 'var(--accent-primary)' : 'var(--risk-low)', marginBottom: 3, letterSpacing: '0.05em' }}>
                                    {partial.role === 'user' ? 'You' : 'Priya (AI)'} <span style={{ opacity: 0.5, fontWeight: 400 }}>· speaking…</span>
                                </div>
                                <div style={{
                                    maxWidth: '88%', padding: '9px 13px', borderRadius: partial.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                    background: partial.role === 'user' ? 'rgba(194, 91, 60, 0.12)' : 'var(--surface-2)',
                                    border: `1px dashed ${partial.role === 'user' ? 'rgba(194, 91, 60, 0.3)' : 'var(--surface-border)'}`,
                                    fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, fontStyle: 'italic',
                                }}>
                                    {partial.message}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── History Item ──────────────────────────────────────────────────────────────
function CallHistoryItem({ call }: { call: AiDoctorCallSummary }) {
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState<AiDoctorCallDetail | null>(null);
    const [loading, setLoading] = useState(false);

    async function toggle() {
        if (!expanded && !detail) {
            setLoading(true);
            try {
                const res = await aiDoctorApi.getCallById(call.id);
                setDetail(res.data.data);
            } catch { toast.error('Could not load transcript'); }
            finally { setLoading(false); }
        }
        setExpanded(v => !v);
    }

    const suggestions = (detail?.doctorSuggestions ?? call.doctorSuggestions) as DoctorSuggestions | null;

    return (
        <div style={{ border: '1px solid var(--surface-border)', background: 'var(--surface-1)', borderRadius: 16, overflow: 'hidden' }}>
            <button onClick={toggle} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(194, 91, 60, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Stethoscope size={17} color="var(--accent-primary)" />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                            AI Doctor Consultation
                            {call.doctorSuggestions && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: 'rgba(62, 142, 126, 0.15)', color: 'var(--risk-low)', fontWeight: 700 }}>REPORT READY</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={10} />{fmtDate(call.startedAt)}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} />{fmtDuration(call.durationSecs)}</span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 9999, fontWeight: 700, background: 'rgba(62, 142, 126, 0.12)', color: 'var(--risk-low)' }}>{call.status}</span>
                    {expanded ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
                </div>
            </button>

            {expanded && (
                <div style={{ borderTop: '1px solid var(--surface-border)', padding: '16px 18px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <span style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Pre-call reason */}
                            {call.preCallData?.reason && (
                                <div style={{ padding: '10px 14px', background: 'rgba(194, 91, 60, 0.08)', border: '1px solid rgba(194, 91, 60, 0.2)', borderRadius: 10 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Reason for visit</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{call.preCallData.reason}</div>
                                </div>
                            )}

                            {/* Doctor's Report */}
                            {suggestions ? (
                                <DoctorReportCard suggestions={suggestions} />
                            ) : (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0', fontStyle: 'italic' }}>
                                    Doctor's report not available for this call.
                                </div>
                            )}

                            {/* Transcript */}
                            {detail?.transcript && Array.isArray(detail.transcript) && detail.transcript.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Full Transcript</div>
                                    <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, scrollbarWidth: 'thin' }}>
                                        {(detail.transcript as TranscriptMessage[]).filter(m => m.role !== 'system').map((msg, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                                <div style={{
                                                    maxWidth: '80%', padding: '8px 12px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.55,
                                                    background: msg.role === 'user' ? 'rgba(194, 91, 60, 0.15)' : 'var(--surface-2)',
                                                    color: 'var(--text-secondary)', border: '1px solid var(--surface-border)',
                                                }}>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--risk-low)', marginBottom: 3 }}>
                                                        {msg.role === 'user' ? 'You' : 'Priya'}
                                                    </div>
                                                    {msg.message}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AiDoctorPage() {
    const [activeTab, setActiveTab] = useState<ActiveTab>('talk');

    // ── Call state ─────────────────────────────────────────────────────────
    const [callStatus, setCallStatus] = useState<CallStatus>('idle');
    const [isMuted, setIsMuted] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [liveMessages, setLiveMessages] = useState<TranscriptMessage[]>([]);
    const [partialMessage, setPartialMessage] = useState<TranscriptMessage | null>(null);
    const liveMessagesRef = useRef<TranscriptMessage[]>([]);
    const [preCallData, setPreCallData] = useState<PreCallData | null>(null);
    const [activeCallId, setActiveCallId] = useState<string | null>(null);
    const [activePatientId, setActivePatientId] = useState<string | null>(null);
    const [doctorReport, setDoctorReport] = useState<DoctorSuggestions | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const vapiRef = useRef<Vapi | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const elapsedRef = useRef(0);

    // ── History state ──────────────────────────────────────────────────────
    const [calls, setCalls] = useState<AiDoctorCallSummary[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // ── Daily quota (global cost cap) ──────────────────────────────────────
    const [usage, setUsage] = useState<{ count: number; cap: number } | null>(null);

    useEffect(() => {
        aiDoctorApi.getUsageToday()
            .then(res => setUsage(res.data.data))
            .catch(() => { /* non-critical — hide quota UI on failure */ });
    }, [callStatus]);

    // ── Load localStorage report on mount ─────────────────────────────────
    useEffect(() => {
        try {
            const stored = localStorage.getItem('medisense_last_report');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.doctorSuggestions) {
                    setDoctorReport(parsed.doctorSuggestions);
                }
            }
        } catch { /* ignore */ }
    }, []);

    // ── Load history ───────────────────────────────────────────────────────
    useEffect(() => {
        if (activeTab === 'history') loadHistory(1);
    }, [activeTab]);

    async function loadHistory(page: number) {
        setHistoryLoading(true);
        try {
            const res = await aiDoctorApi.getCalls(page, 8);
            setCalls(res.data.data);
            setTotalPages(res.data.pagination?.totalPages ?? 1);
            setHistoryPage(page);
        } catch { toast.error('Could not load call history'); }
        finally { setHistoryLoading(false); }
    }

    // ── Poll for doctor suggestions after call ends ────────────────────────
    function pollForReport(callId: string) {
        setReportLoading(true);
        let attempts = 0;
        const max = 6; // 6 × 5s = 30s max

        pollRef.current = setInterval(async () => {
            attempts++;
            try {
                const res = await aiDoctorApi.getCallById(callId);
                const suggestions = res.data.data?.doctorSuggestions as DoctorSuggestions | null;
                if (suggestions?.summary) {
                    clearInterval(pollRef.current!);
                    setDoctorReport(suggestions);
                    setReportLoading(false);
                    // Save to localStorage
                    try { localStorage.setItem('medisense_last_report', JSON.stringify({ callId, doctorSuggestions: suggestions })); } catch { /* ignore */ }
                    toast.success("Doctor's report is ready!");
                }
            } catch { /* ignore */ }
            if (attempts >= max) {
                clearInterval(pollRef.current!);
                setReportLoading(false);
            }
        }, 5000);
    }

    // ── Start call flow ────────────────────────────────────────────────────
    const openPreCallForm = useCallback(() => {
        setCallStatus('pre-call-form');
    }, []);

    const startCall = useCallback(async (data: PreCallData) => {
        setPreCallData(data);
        setCallStatus('connecting');
        setLiveMessages([]);
        liveMessagesRef.current = [];
        setPartialMessage(null);
        setElapsed(0);
        elapsedRef.current = 0;
        setDoctorReport(null);

        // Pre-verify microphone permission to prevent Daily audio ejection
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Release the temporary stream so Vapi can acquire it cleanly
            stream.getTracks().forEach(track => track.stop());
        } catch {
            toast.error('Microphone permission required! Please allow microphone access in your browser to speak with the doctor.');
            setCallStatus('idle');
            return;
        }

        // Clean up any existing Vapi instance before starting a new call
        if (vapiRef.current) {
            try {
                vapiRef.current.removeAllListeners();
                vapiRef.current.stop();
            } catch {
                /* ignore cleanup errors */
            }
            vapiRef.current = null;
        }

        try {
            const res = await aiDoctorApi.startCall(data);
            const { publicKey, patientId, assistantConfig } = res.data.data;
            setActivePatientId(patientId);

            if (!publicKey) {
                toast.error('VAPI Public Key missing — please check environment setup.');
                setCallStatus('idle');
                return;
            }

            const vapi = new Vapi(publicKey);
            vapiRef.current = vapi;

            vapi.on('call-start', () => {
                setCallStatus('active');
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = setInterval(() => setElapsed(e => { elapsedRef.current = e + 1; return e + 1; }), 1000);
            });

            vapi.on('call-end', async () => {
                setCallStatus('ended');
                setPartialMessage(null);
                if (timerRef.current) clearInterval(timerRef.current);

                // Collect final transcript + save (use ref — closures here are stale for state)
                const finalTranscript = liveMessagesRef.current;
                const rawCallId = (vapi as any)?.callId;
                const vapiCallId = typeof rawCallId === 'string' && rawCallId.trim() ? rawCallId : `local-${Date.now()}`;

                try {
                    const saveRes = await aiDoctorApi.saveCall({
                        vapiCallId,
                        patientId: patientId,
                        durationSecs: elapsedRef.current,
                        transcript: finalTranscript,
                        preCallData: data,
                    });
                    const savedCallId = saveRes.data.data?.callId;
                    if (savedCallId) {
                        setActiveCallId(savedCallId);
                        pollForReport(savedCallId);
                    }
                } catch (err) {
                    console.error('Failed to save call:', err);
                }

                toast.success('Consultation ended. Generating Doctor\'s report...');
            });

            vapi.on('message', (message: any) => {
                const text = message.transcript || message.text || message.content;
                if (!text || !text.trim()) return;

                // Interim (not-yet-final) speech — show immediately so the user sees
                // what they're saying in real time instead of waiting for finalization
                if (message.type === 'transcript' && message.transcriptType === 'partial') {
                    setPartialMessage({ role: message.role || 'user', message: text });
                    return;
                }

                if (
                    (message.type === 'transcript' && message.transcriptType === 'final') ||
                    (message.type === 'speech-update' && message.status === 'stopped' && text) ||
                    (message.role && text && (message.transcriptType === 'final' || !message.transcriptType))
                ) {
                    setPartialMessage(null);
                    setLiveMessages(prev => {
                        // Avoid duplicate consecutive identical messages
                        const last = prev[prev.length - 1];
                        if (last && last.role === message.role && last.message === text) return prev;
                        const next = [...prev, { role: message.role || 'assistant', message: text }];
                        liveMessagesRef.current = next;
                        return next;
                    });
                }
            });

            vapi.on('error', (err: any) => {
                console.error('Vapi error:', err);
                // Daily ejection or call end errors shouldn't crash if call already ended
                const errorMsg = err?.error?.errorMsg || err?.message || '';
                if (errorMsg.includes('ejection') || errorMsg.includes('ended')) {
                    setCallStatus('ended');
                } else {
                    setCallStatus('idle');
                    toast.error('Call connection notice. You can reconnect anytime.');
                }
                if (timerRef.current) clearInterval(timerRef.current);
            });

            await vapi.start(assistantConfig);
        } catch (err: any) {
            setCallStatus('idle');
            toast.error(err?.response?.data?.message || 'Could not start call. Please try again.');
        }
    }, []);

    const endCall = useCallback(() => {
        setCallStatus('ending');
        if (vapiRef.current) {
            try {
                vapiRef.current.stop();
            } catch {
                /* ignore */
            }
        }
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    const toggleMute = useCallback(() => {
        if (!vapiRef.current) return;
        const nm = !isMuted;
        vapiRef.current.setMuted(nm);
        setIsMuted(nm);
    }, [isMuted]);

    useEffect(() => () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (pollRef.current) clearInterval(pollRef.current);
        vapiRef.current?.stop();
    }, []);

    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');

    // ──────────────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>

            {/* Pre-call modal */}
            {callStatus === 'pre-call-form' && (
                <PreCallModal
                    onStart={startCall}
                    onCancel={() => setCallStatus('idle')}
                />
            )}

            {/* ── Header ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Stethoscope size={20} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>AI Doctor OPD</h1>
                        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>Priya — AI Health Assistant · Integrative & Natural Healing Guidance · Hindi & English</p>
                    </div>
                </div>
            </div>

            {/* ── Tabs ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 26, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: 5, width: 'fit-content' }}>
                {[
                    { key: 'talk', label: '🩺 Talk to AI Doctor', },
                    { key: 'history', label: '📋 My Consultations' },
                ].map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key as ActiveTab)} style={{
                        padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: activeTab === t.key ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))' : 'transparent',
                        color: activeTab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: activeTab === t.key ? 800 : 600, fontSize: 13.5,
                        transition: 'all 0.2s',
                    }}>{t.label}</button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════
                TAB 1 — TALK
            ══════════════════════════════════════════════════════ */}
            {activeTab === 'talk' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* ── Active call: two-column ── */}
                    {callStatus === 'active' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, height: 500 }}>
                            {/* Left — Doctor orb + controls */}
                            <div style={{
                                background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                                borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32,
                            }}>
                                <PulsingOrb active />
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Priya</div>
                                    {/* Persistent, always-visible AI disclosure during the live call —
                                        not just spoken once at the start, so it stays visible even if
                                        the patient joined the call already in progress or looks away
                                        from the opening line. */}
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                                        fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 9999,
                                        background: 'rgba(194, 91, 60, 0.18)', color: 'var(--accent-primary-hover)',
                                        border: '1px solid rgba(194, 91, 60, 0.35)', letterSpacing: '0.03em',
                                    }}>
                                        🤖 AI ASSISTANT — NOT A REAL DOCTOR
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Integrative &amp; Ayurvedic self-care guidance</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--risk-low)', animation: 'ping 1.2s ease infinite', display: 'inline-block' }} />
                                    <span style={{ color: 'var(--risk-low)', fontSize: 13, fontWeight: 700 }}>LIVE</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'monospace', marginLeft: 6 }}>{mins}:{secs}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={toggleMute} style={{
                                        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
                                        border: '1px solid var(--surface-border-md)', cursor: 'pointer',
                                        background: isMuted ? 'var(--risk-critical)' : 'var(--surface-2)',
                                        color: isMuted ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13,
                                    }}>
                                        {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
                                        {isMuted ? 'Unmute' : 'Mute'}
                                    </button>
                                    <button onClick={endCall} style={{
                                        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
                                        border: 'none', cursor: 'pointer',
                                        background: 'var(--risk-critical)', color: '#fff', fontWeight: 700, fontSize: 13,
                                        boxShadow: '0 4px 16px rgba(220,38,38,0.35)',
                                    }}>
                                        <PhoneOff size={15} /> End Call
                                    </button>
                                </div>
                            </div>

                            {/* Right — Live transcript */}
                            <LiveTranscriptPanel messages={liveMessages} partial={partialMessage} />
                        </div>
                    )}

                    {/* ── Connecting ── */}
                    {callStatus === 'connecting' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '60px 0', background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20 }}>
                            <div style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid rgba(194, 91, 60, 0.3)', borderTopColor: 'var(--accent-primary)', animation: 'spin 0.8s linear infinite' }} />
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Connecting to Priya...</div>
                                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>Please allow microphone access when prompted</div>
                            </div>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    )}

                    {/* ── Idle or Ended → Doctor card + Start button ── */}
                    {(callStatus === 'idle' || callStatus === 'ended') && (
                        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20, padding: '32px 36px', display: 'flex', alignItems: 'center', gap: 32 }}>
                            <PulsingOrb active={false} />
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)' }}>Priya</div>
                                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 9999, background: 'rgba(194, 91, 60, 0.18)', color: 'var(--accent-primary-hover)', border: '1px solid rgba(194, 91, 60, 0.35)', letterSpacing: '0.03em' }}>AI HEALTH ASSISTANT — NOT A REAL DOCTOR</span>
                                </div>
                                <div style={{ fontSize: 13.5, color: 'var(--accent-primary)', fontWeight: 600, marginBottom: 16 }}>Voice-based AI trained to discuss symptoms and suggest natural/Ayurvedic self-care — not a substitute for medical diagnosis or a licensed physician</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                                    {['Ayurveda & Home Remedies', '9-Phase OPD-style Interview', 'Hindi & English'].map(tag => (
                                        <span key={tag} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 9999, background: 'rgba(194, 91, 60, 0.12)', color: 'var(--accent-primary)', border: '1px solid rgba(194, 91, 60, 0.25)' }}>{tag}</span>
                                    ))}
                                </div>
                                {callStatus === 'ended' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                        <CheckCircle size={16} color="var(--risk-low)" />
                                        <span style={{ fontSize: 13, color: 'var(--risk-low)', fontWeight: 600 }}>Consultation saved — check My Consultations tab</span>
                                    </div>
                                ) : (
                                    <div style={{ padding: '12px 16px', background: 'rgba(194, 91, 60, 0.08)', border: '1px solid rgba(194, 91, 60, 0.2)', borderRadius: 12, marginBottom: 18, display: 'flex', gap: 10 }}>
                                        <AlertCircle size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
                                        <div>
                                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 3 }}>Hindi, English ya Hinglish mein aaram se baat karein</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                                Priya ek 9-phase OPD-style interview lengi aur aapko pure Ayurvedic, diet & home remedies suggest karenge. Emergency ke liye call <strong style={{ color: 'var(--text-primary)' }}>108</strong>.
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {usage && usage.count >= usage.cap ? (
                                    <div style={{ padding: '12px 16px', background: 'rgba(179, 64, 46, 0.08)', border: '1px solid rgba(179, 64, 46, 0.25)', borderRadius: 12, marginBottom: 10 }}>
                                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--risk-high)' }}>
                                            Daily consultation limit reached ({usage.cap}/{usage.cap}). Please try again tomorrow.
                                        </span>
                                    </div>
                                ) : (
                                    <button onClick={openPreCallForm} style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '13px 30px',
                                        borderRadius: 12, border: 'none', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, var(--accent-green-dim), var(--risk-low))',
                                        color: '#fff', fontWeight: 800, fontSize: 15,
                                        boxShadow: '0 8px 24px rgba(47, 114, 100, 0.35)',
                                        transition: 'all 0.2s',
                                    }}>
                                        <Phone size={20} /> Start Consultation
                                    </button>
                                )}
                                {usage && usage.count < usage.cap && (
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                                        {usage.cap - usage.count} of {usage.cap} consultations left today (shared demo limit)
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Doctor's Report (post call) ── */}
                    {callStatus === 'ended' && (
                        reportLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', background: 'rgba(194, 91, 60, 0.08)', border: '1px solid rgba(194, 91, 60, 0.2)', borderRadius: 16 }}>
                                <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid rgba(194, 91, 60, 0.4)', borderTopColor: 'var(--accent-primary)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Generating Doctor's Report...</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Priya is analysing your consultation. This takes ~20s.</div>
                                </div>
                            </div>
                        ) : doctorReport ? (
                            <DoctorReportCard suggestions={doctorReport} onDismiss={() => setDoctorReport(null)} />
                        ) : null
                    )}

                    {/* ── Show last stored report on idle ── */}
                    {callStatus === 'idle' && doctorReport && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Last Consultation Report</div>
                            <DoctorReportCard suggestions={doctorReport} onDismiss={() => {
                                setDoctorReport(null);
                                localStorage.removeItem('medisense_last_report');
                            }} />
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB 2 — HISTORY
            ══════════════════════════════════════════════════════ */}
            {activeTab === 'history' && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>Past Consultations</div>
                        <button onClick={() => loadHistory(historyPage)} style={{ fontSize: 12.5, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--surface-border-md)', background: 'rgba(194, 91, 60, 0.1)', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}>
                            ↻ Refresh
                        </button>
                    </div>

                    {historyLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(194, 91, 60, 0.3)', borderTopColor: 'var(--accent-primary)', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    ) : calls.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20 }}>
                            <Stethoscope size={48} color="var(--text-muted)" style={{ marginBottom: 16 }} />
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>No consultations yet</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Start your first AI Doctor consultation from the Talk tab.</div>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {calls.map(call => <CallHistoryItem key={call.id} call={call} />)}
                            </div>
                            {totalPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                        <button key={p} onClick={() => loadHistory(p)} style={{
                                            width: 32, height: 32, borderRadius: 8, border: '1px solid var(--surface-border-md)',
                                            background: p === historyPage ? 'var(--accent-primary)' : 'var(--surface-1)',
                                            color: p === historyPage ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                                        }}>{p}</button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
