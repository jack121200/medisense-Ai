import React, { useEffect, useState, useRef } from 'react';
import { mlApi } from '../api/ml.api';
import { Search, X, Brain, ChevronDown, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Alternative {
    disease: string;
    confidence: number;
}

interface PredictionResult {
    disease: string;
    confidence: number;
    alternatives: Alternative[];
    symptoms_used: string[];
    unrecognized: string[];
}

// Literal hex — the text-safe shade of each band — so the alpha-suffixed tints
// built from it are valid CSS; a var() reference cannot take an alpha suffix.
const confidenceColor = (c: number) => c >= 75 ? '#2B6A4F' : c >= 50 ? '#7A5C14' : '#924E21';

export default function SymptomChecker({ seedSymptoms = [] }: { seedSymptoms?: string[] }) {
    const [allSymptoms, setAllSymptoms] = useState<string[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const [filtered, setFiltered] = useState<string[]>([]);
    const [dropOpen, setDropOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingSymptoms, setLoadingSymptoms] = useState(true);
    const [result, setResult] = useState<PredictionResult | null>(null);
    const [modelReady, setModelReady] = useState<boolean | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadSymptoms();
        checkModel();
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setFiltered(allSymptoms.filter(s => !selected.includes(s)).slice(0, 30));
        } else {
            const q = query.toLowerCase().replace(/ /g, '_');
            setFiltered(
                allSymptoms
                    .filter(s => s.includes(q) && !selected.includes(s))
                    .slice(0, 20)
            );
        }
    }, [query, allSymptoms, selected]);

    // Symptoms read from an uploaded document are added for review, keeping
    // only terms the model was actually trained on.
    useEffect(() => {
        if (!seedSymptoms.length || !allSymptoms.length) return;
        const known = seedSymptoms.filter(s => allSymptoms.includes(s));
        if (known.length) setSelected(prev => Array.from(new Set([...prev, ...known])));
    }, [seedSymptoms, allSymptoms]);

    useEffect(() => {
        function handle(e: MouseEvent) {
            if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
                setDropOpen(false);
            }
        }
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    async function loadSymptoms() {
        try {
            const res = await mlApi.getSymptoms();
            setAllSymptoms(res.data.data?.symptoms || []);
        } catch {
            setAllSymptoms([]);
        } finally {
            setLoadingSymptoms(false);
        }
    }

    async function checkModel() {
        try {
            const res = await mlApi.modelStatus();
            setModelReady(res.data.data?.models?.disease_model?.ready || false);
        } catch {
            setModelReady(false);
        }
    }

    function addSymptom(sym: string) {
        if (!selected.includes(sym)) setSelected(prev => [...prev, sym]);
        setQuery('');
        setDropOpen(false);
        inputRef.current?.focus();
    }

    function removeSymptom(sym: string) {
        setSelected(prev => prev.filter(s => s !== sym));
        setResult(null);
    }

    async function predict() {
        if (selected.length < 2) return toast.error('Select at least 2 symptoms');
        setLoading(true);
        setResult(null);
        try {
            const res = await mlApi.predictDisease(selected);
            setResult(res.data.data);
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.response?.data?.detail || 'Prediction failed — ML model may not be ready yet';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    const formatLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const canPredict = selected.length >= 2 && !loading && !!modelReady;

    return (
        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(35, 83, 71, 0.2)', borderRadius: 20, padding: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-magenta))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Brain size={18} color="#fff" />
                </div>
                <div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 15 }}>AI Symptom Checker</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: modelReady === true ? 'var(--risk-low-text)' : modelReady === false ? 'var(--risk-critical-text)' : 'var(--risk-medium-text)' }}>
                        {modelReady === true ? '● Model ready' : modelReady === false ? '● Model not trained yet' : '● Checking…'}
                    </div>
                </div>
            </div>

            {/* Symptom search */}
            <div ref={dropRef} style={{ position: 'relative', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--surface-1)', border: '1px solid var(--surface-border-md)', borderRadius: 12, cursor: 'text' }}
                    onClick={() => { setDropOpen(true); inputRef.current?.focus(); }}>
                    <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setDropOpen(true); }}
                        onFocus={() => setDropOpen(true)}
                        placeholder={loadingSymptoms ? 'Loading symptoms…' : 'Search symptoms (e.g. headache, fever)…'}
                        disabled={loadingSymptoms}
                        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }}
                    />
                    {query && <button onClick={() => setQuery('')} aria-label="Clear search" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
                    <ChevronDown size={13} style={{ color: 'var(--text-muted)', transform: dropOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
                </div>

                {/* Dropdown */}
                {dropOpen && filtered.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4, background: 'var(--surface-0)', border: '1px solid var(--surface-border-md)', borderRadius: 12, maxHeight: 220, overflowY: 'auto', boxShadow: 'var(--shadow-md, 0 8px 24px rgba(11, 43, 38, 0.12))' }}>
                        {filtered.map(sym => (
                            <div key={sym} onClick={() => addSymptom(sym)}
                                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--surface-border)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(35, 83, 71, 0.08)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                {formatLabel(sym)}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Selected symptom chips */}
            {selected.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                    {selected.map(sym => (
                        <span key={sym} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(35, 83, 71, 0.12)', border: '1px solid rgba(35, 83, 71, 0.3)', borderRadius: 20, fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {formatLabel(sym)}
                            <button onClick={() => removeSymptom(sym)} aria-label={`Remove ${formatLabel(sym)}`} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={11} /></button>
                        </span>
                    ))}
                    <button onClick={() => { setSelected([]); setResult(null); setQuery(''); }}
                        style={{ padding: '5px 10px', background: 'transparent', border: '1px solid rgba(200, 67, 75, 0.25)', borderRadius: 20, fontSize: 11, color: 'var(--risk-critical-text)', cursor: 'pointer', fontWeight: 600 }}>
                        Clear all
                    </button>
                </div>
            )}

            {/* Predict button */}
            <button
                onClick={predict}
                disabled={!canPredict}
                style={{
                    width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: canPredict ? 'pointer' : 'not-allowed',
                    background: canPredict ? 'var(--accent-primary)' : 'var(--surface-3)',
                    color: canPredict ? '#fff' : 'var(--text-muted)', fontWeight: 800, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s',
                }}>
                {loading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing…</> : <><Brain size={15} /> Predict condition ({selected.length} symptoms)</>}
            </button>

            {/* Result */}
            {result && (() => {
                const color = confidenceColor(result.confidence);
                return (
                    <div style={{ marginTop: 20 }}>
                        {/* Primary prediction */}
                        <div style={{ padding: '18px 20px', background: `${color}14`, border: `1px solid ${color}40`, borderRadius: 14, marginBottom: 14 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Most likely condition</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8 }}>{result.disease}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 3 }}>
                                    <div style={{ width: `${result.confidence}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.6s ease' }} />
                                </div>
                                <span className="font-mono" style={{ fontSize: 14, fontWeight: 800, color, minWidth: 46 }}>{result.confidence}%</span>
                            </div>
                        </div>

                        {/* Alternatives */}
                        {result.alternatives.length > 1 && (
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Other possibilities</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {result.alternatives.slice(1, 4).map((alt, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 10 }}>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 16 }}>{i + 2}.</span>
                                            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{alt.disease}</span>
                                            <div style={{ width: 60, height: 4, background: 'var(--surface-3)', borderRadius: 2 }}>
                                                <div style={{ width: `${alt.confidence}%`, height: '100%', borderRadius: 2, background: confidenceColor(alt.confidence) }} />
                                            </div>
                                            <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{alt.confidence}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {result.unrecognized.length > 0 && (
                            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(201, 154, 42, 0.08)', border: '1px solid rgba(201, 154, 42, 0.2)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <AlertCircle size={13} style={{ color: 'var(--risk-medium-text)', marginTop: 1, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    Unrecognized: {result.unrecognized.join(', ')}
                                </span>
                            </div>
                        )}

                        <p style={{ margin: '12px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                            Trained on a public dataset where every disease has a clean, fixed symptom pattern — a starting point for the differential, not a diagnosis.
                        </p>
                    </div>
                );
            })()}
        </div>
    );
}
