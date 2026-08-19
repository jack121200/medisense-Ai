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

const CONFIDENCE_COLOR = (c: number) => c >= 75 ? '#00FF87' : c >= 50 ? '#FFD166' : '#FF6B35';

export default function SymptomChecker() {
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
    const s: React.CSSProperties = { fontFamily: '"Inter", system-ui, sans-serif' };

    return (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, padding: 24, ...s }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Brain size={18} color="#fff" />
                </div>
                <div>
                    <div style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>AI Symptom Checker</div>
                    <div style={{ fontSize: 11, color: modelReady === true ? '#00FF87' : modelReady === false ? '#FF2D55' : '#FFD166' }}>
                        {modelReady === true ? '● Model Ready' : modelReady === false ? '● Model not trained yet' : '● Checking...'}
                    </div>
                </div>
            </div>

            {/* Symptom search */}
            <div ref={dropRef} style={{ position: 'relative', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, cursor: 'text' }}
                    onClick={() => { setDropOpen(true); inputRef.current?.focus(); }}>
                    <Search size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setDropOpen(true); }}
                        onFocus={() => setDropOpen(true)}
                        placeholder={loadingSymptoms ? 'Loading symptoms...' : 'Search symptoms (e.g. headache, fever)...'}
                        disabled={loadingSymptoms}
                        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13 }}
                    />
                    {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
                    <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.3)', transform: dropOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
                </div>

                {/* Dropdown */}
                {dropOpen && filtered.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4, background: '#0D1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, maxHeight: 220, overflowY: 'auto' }}>
                        {filtered.map(sym => (
                            <div key={sym} onClick={() => addSymptom(sym)}
                                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
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
                        <span key={sym} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>
                            {formatLabel(sym)}
                            <button onClick={() => removeSymptom(sym)} style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={11} /></button>
                        </span>
                    ))}
                    <button onClick={() => { setSelected([]); setResult(null); setQuery(''); }}
                        style={{ padding: '5px 10px', background: 'transparent', border: '1px solid rgba(255,45,85,0.25)', borderRadius: 20, fontSize: 11, color: '#FF2D55', cursor: 'pointer', fontWeight: 600 }}>
                        Clear all
                    </button>
                </div>
            )}

            {/* Predict button */}
            <button
                onClick={predict}
                disabled={loading || selected.length < 2 || !modelReady}
                style={{
                    width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: (loading || selected.length < 2 || !modelReady) ? 'not-allowed' : 'pointer',
                    background: (selected.length >= 2 && !loading && modelReady) ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(99,102,241,0.2)',
                    color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: (selected.length >= 2 && !loading && modelReady) ? 1 : 0.5, transition: 'all 0.15s',
                }}>
                {loading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...</> : <><Brain size={15} /> Predict Disease ({selected.length} symptoms)</>}
            </button>

            {/* Result */}
            {result && (
                <div style={{ marginTop: 20 }}>
                    {/* Primary prediction */}
                    <div style={{ padding: '18px 20px', background: `${CONFIDENCE_COLOR(result.confidence)}10`, border: `1px solid ${CONFIDENCE_COLOR(result.confidence)}30`, borderRadius: 14, marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>AI Diagnosis</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8 }}>{result.disease}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                                <div style={{ width: `${result.confidence}%`, height: '100%', borderRadius: 3, background: CONFIDENCE_COLOR(result.confidence), transition: 'width 0.6s ease' }} />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: CONFIDENCE_COLOR(result.confidence), minWidth: 46 }}>{result.confidence}%</span>
                        </div>
                    </div>

                    {/* Alternatives */}
                    {result.alternatives.length > 1 && (
                        <div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Other Possibilities</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {result.alternatives.slice(1, 4).map((alt, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', minWidth: 16 }}>{i + 2}.</span>
                                        <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{alt.disease}</span>
                                        <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                                            <div style={{ width: `${alt.confidence}%`, height: '100%', borderRadius: 2, background: CONFIDENCE_COLOR(alt.confidence) }} />
                                        </div>
                                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 36, textAlign: 'right' }}>{alt.confidence}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.unrecognized.length > 0 && (
                        <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.2)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <AlertCircle size={13} style={{ color: '#FFD166', marginTop: 1, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                                Unrecognized: {result.unrecognized.join(', ')}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
