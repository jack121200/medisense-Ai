import React, { useState, useRef } from 'react';
import { Upload, FileText, Activity, AlertTriangle, Info, Heart, Zap } from 'lucide-react';
import { mlApi } from '../../api/ml.api';
import toast from 'react-hot-toast';
import api from '../../api/axiosInstance';

// ── Colour tokens ──────────────────────────────────────────────────────────────
const C = {
    lipid:    'var(--accent-primary)',
    gold:     'var(--risk-medium)',
    crimson:  'var(--risk-critical)',
    teal:     'var(--risk-low)',
    purple:   'var(--vitals-bp)',
    amber:    'var(--vitals-temp)',
    bg:       'var(--surface-1)',
    border:   'var(--surface-border)',
};

// ── Status colour map (NLA-2014) ───────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
    'OPTIMAL':      C.teal,
    'NEAR OPTIMAL': 'var(--accent-green-dim)',
    'PROTECTIVE':   C.teal,
    'NORMAL':       C.teal,
    'BORDERLINE':   C.gold,
    'HIGH':         C.crimson,
    'VERY HIGH':    'var(--risk-critical)',
    'LOW':          C.crimson,
};
const STATUS_BG: Record<string, string> = {
    'OPTIMAL':      `${C.teal}18`,
    'NEAR OPTIMAL': '#3A86FF18',
    'PROTECTIVE':   `${C.teal}18`,
    'NORMAL':       `${C.teal}12`,
    'BORDERLINE':   `${C.gold}18`,
    'HIGH':         `${C.crimson}18`,
    'VERY HIGH':    '#FF006E18',
    'LOW':          `${C.crimson}18`,
};

// ── Risk config ───────────────────────────────────────────────────────────────
const RISK_CFG: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
    HIGH:   { color: C.crimson, bg: `${C.crimson}18`, label: 'HIGH',   emoji: '🔴' },
    MEDIUM: { color: C.gold,    bg: `${C.gold}18`,    label: 'MEDIUM', emoji: '🟡' },
    LOW:    { color: C.teal,    bg: `${C.teal}18`,    label: 'LOW',    emoji: '🟢' },
};

// ── Statin intensity badge ─────────────────────────────────────────────────────
const STATIN_CFG: Record<string, { color: string; bg: string }> = {
    NONE:     { color: C.teal,    bg: `${C.teal}18` },
    LOW:      { color: '#3A86FF', bg: '#3A86FF18' },
    MODERATE: { color: C.gold,    bg: `${C.gold}18` },
    HIGH:     { color: C.crimson, bg: `${C.crimson}18` },
};

// ── Ratio thresholds for color coding ─────────────────────────────────────────
function ratioColor(key: string, val: number): string {
    if (key === 'tc_hdl_ratio')      return val > 5   ? C.crimson : val > 3.5 ? C.gold : C.teal;
    if (key === 'ldl_hdl_ratio')     return val > 3.5 ? C.crimson : val > 2.5 ? C.gold : C.teal;
    if (key === 'tg_hdl_ratio')      return val > 3   ? C.crimson : val > 2   ? C.gold : C.teal;
    if (key === 'atherogenic_index') return val > 0.24 ? C.crimson : val > 0.1 ? C.gold : C.teal;
    return 'var(--text-primary)';
}

// ── Shared small components ───────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder = '', unit = '' }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; unit?: string;
}) {
    const [focused, setFocused] = useState(false);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', justifyContent: 'space-between' }}>
                <span>{label}</span>
                {unit && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{unit}</span>}
            </label>
            <input
                type="number" step="any" value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    padding: '9px 12px',
                    background: focused ? 'rgba(13, 92, 126, 0.06)' : 'var(--surface-2)',
                    border: `1px solid ${focused ? `${C.lipid}60` : 'var(--surface-border)'}`,
                    borderRadius: 9, color: 'var(--text-primary)', fontSize: 13.5,
                    outline: 'none', fontFamily: 'inherit',
                    transition: 'all 0.2s',
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
            />
        </div>
    );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 8,
            background: active ? `${C.lipid}18` : 'var(--surface-2)',
            border: `1px solid ${active ? `${C.lipid}50` : 'var(--surface-border)'}`,
            color: active ? C.lipid : 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
            transition: 'all 0.2s',
        }}>
            <div style={{
                width: 16, height: 16, borderRadius: '50%',
                background: active ? C.lipid : 'var(--surface-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: 'var(--text-primary)', flexShrink: 0,
            }}>
                {active ? '✓' : ''}
            </div>
            {label}
        </button>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LipidProfileTab() {
    const [inputMode, setInputMode] = useState<'manual' | 'pdf'>('manual');
    const [pdfLoading, setPdfLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        total_cholesterol: '', ldl: '', hdl: '', vldl: '',
        triglycerides: '', non_hdl: '',
        age: '', bmi: '', gender: 'M',
    });
    const [flags, setFlags] = useState({ is_diabetic: 0, is_hypertensive: 0, is_smoker: 0 });

    const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
    const toggleFlag = (k: keyof typeof flags) => setFlags(f => ({ ...f, [k]: f[k] === 1 ? 0 : 1 }));

    // ── PDF Upload ─────────────────────────────────────────────────────────────
    const handlePdfUpload = async (file: File) => {
        setPdfLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            // Goes through the backend proxy (POST /ml/pdf-extract/:kind) — ml-service
            // is not reachable from the browser once deployed, and hardcoding
            // localhost:8000 broke this upload outside local dev.
            const res = await api.post('/ml/pdf-extract/lipid', fd);
            const extracted = res.data.extracted || {};
            const stringified: Record<string, string> = {};
            Object.entries(extracted).forEach(([k, v]) => { stringified[k] = String(v); });
            setForm(prev => ({ ...prev, ...stringified }));
            toast.success(`Extracted ${res.data.fields_found} lipid values. Review before analyzing.`);
            setInputMode('manual');
        } catch {
            toast.error('PDF extraction failed — enter values manually');
        } finally {
            setPdfLoading(false);
        }
    };

    // ── Submit ─────────────────────────────────────────────────────────────────
    const submit = async () => {
        const required = ['total_cholesterol', 'ldl', 'hdl', 'triglycerides', 'age'];
        const missing = required.filter(k => !form[k as keyof typeof form]);
        if (missing.length > 0) {
            toast.error(`Required: ${missing.join(', ')}`);
            return;
        }
        setLoading(true);
        try {
            const payload = {
                total_cholesterol: parseFloat(form.total_cholesterol),
                ldl:               parseFloat(form.ldl),
                hdl:               parseFloat(form.hdl),
                vldl:              form.vldl    ? parseFloat(form.vldl)    : null,
                triglycerides:     parseFloat(form.triglycerides),
                non_hdl:           form.non_hdl ? parseFloat(form.non_hdl) : null,
                age:               parseInt(form.age),
                gender:            form.gender,
                bmi:               form.bmi     ? parseFloat(form.bmi)     : null,
                ...flags,
            };
            const res = await mlApi.analyzeLipid(payload);
            const data = res.data?.data ?? res.data;
            setResult(data);
            toast.success('Lipid profile analysis complete');
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Lipid analyzer error — check ML service';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    // ── Panel table row ─────────────────────────────────────────────────────────
    const PanelRow = ({ paramKey, p }: { paramKey: string; p: any }) => {
        const col = STATUS_COLOR[p.status] || 'var(--text-primary)';
        const bg  = STATUS_BG[p.status]   || 'transparent';
        const labels: Record<string, string> = {
            total_cholesterol: 'Total Cholesterol',
            ldl: 'LDL Cholesterol',
            hdl: 'HDL Cholesterol',
            triglycerides: 'Triglycerides',
            vldl: 'VLDL',
            non_hdl: 'Non-HDL',
        };
        return (
            <tr style={{ borderBottom: '1px solid var(--surface-border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(13, 92, 126, 0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ padding: '11px 16px', fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{labels[paramKey] || paramKey}</td>
                <td style={{ padding: '11px 16px', fontFamily: 'monospace', color: col, fontWeight: 800, fontSize: 14 }}>{p.value}</td>
                <td style={{ padding: '11px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{p.unit}</td>
                <td style={{ padding: '11px 16px', color: 'var(--text-muted)', fontSize: 11, maxWidth: 200 }}>{p.reference}</td>
                <td style={{ padding: '11px 16px' }}>
                    <span style={{ padding: '3px 11px', borderRadius: 9999, background: bg, color: col, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
                        {p.status}
                    </span>
                </td>
            </tr>
        );
    };

    // ── Results panel ──────────────────────────────────────────────────────────
    const Results = ({ d }: { d: any }) => {
        const risk    = RISK_CFG[d.risk_category]  || RISK_CFG.LOW;
        const statin  = STATIN_CFG[d.statin_recommendation?.intensity] || STATIN_CFG.NONE;
        const probPct = Math.round((d.risk_probability?.[d.risk_category] || 0) * 100);

        const ratioLabels: Record<string, string> = {
            tc_hdl_ratio:      'TC / HDL',
            ldl_hdl_ratio:     'LDL / HDL',
            tg_hdl_ratio:      'TG / HDL',
            atherogenic_index: 'Atherogenic Index',
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── Risk + Statin row ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Risk Badge */}
                    <div style={{ background: risk.bg, border: `2px solid ${risk.color}35`, borderRadius: 18, padding: '24px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 42, marginBottom: 6 }}>{risk.emoji}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Cardiovascular Risk</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: risk.color }}>{risk.label} RISK</div>
                        <div style={{ fontSize: 32, fontWeight: 900, color: risk.color, fontFamily: 'monospace', marginTop: 4 }}>{probPct}%</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>probability</div>
                    </div>

                    {/* Statin Card */}
                    <div style={{ background: statin.bg, border: `2px solid ${statin.color}35`, borderRadius: 18, padding: '24px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 36, marginBottom: 6 }}>💊</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Statin Therapy</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: d.statin_recommendation?.needs_statin ? C.crimson : C.teal, marginBottom: 8 }}>
                            {d.statin_recommendation?.needs_statin ? 'Recommended' : 'Not Required'}
                        </div>
                        <span style={{ padding: '6px 18px', borderRadius: 9999, background: statin.bg, color: statin.color, fontSize: 13, fontWeight: 800, border: `1px solid ${statin.color}50` }}>
                            {d.statin_recommendation?.intensity} INTENSITY
                        </span>
                    </div>
                </div>

                {/* ── NLA Category ── */}
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>NLA-2014 LDL Category</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{d.nla_category}</div>
                    </div>
                    <Info size={18} color="var(--text-muted)" />
                </div>

                {/* ── Detected Conditions ── */}
                {(d.has_dyslipidemia || d.has_metabolic_syndrome) && (
                    <div style={{ background: `${C.amber}08`, border: `1px solid ${C.amber}30`, borderRadius: 14, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Detected Conditions</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {d.has_dyslipidemia && (
                                <span style={{ padding: '5px 14px', borderRadius: 9999, background: `${C.amber}20`, color: C.amber, fontSize: 12, fontWeight: 700, border: `1px solid ${C.amber}40` }}>
                                    ⚠️ Dyslipidemia
                                </span>
                            )}
                            {d.has_metabolic_syndrome && (
                                <span style={{ padding: '5px 14px', borderRadius: 9999, background: `${C.crimson}20`, color: C.crimson, fontSize: 12, fontWeight: 700, border: `1px solid ${C.crimson}40` }}>
                                    ⚠️ Metabolic Syndrome
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Key Ratios ── */}
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Key Cardiovascular Ratios</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {Object.entries(d.ratios || {}).map(([k, v]: [string, any]) => {
                            const col = ratioColor(k, v);
                            return (
                                <div key={k} style={{ background: `${col}10`, border: `1px solid ${col}25`, borderRadius: 10, padding: '10px 14px' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{ratioLabels[k] || k}</div>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: col, fontFamily: 'monospace' }}>{Number(v).toFixed(2)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Red Flags ── */}
                {d.red_flags?.length > 0 && (
                    <div style={{ background: `${C.crimson}10`, border: `1px solid ${C.crimson}30`, borderRadius: 14, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <AlertTriangle size={15} color={C.crimson} />
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.crimson, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Critical Flags</div>
                        </div>
                        {d.red_flags.map((f: string, i: number) => (
                            <div key={i} style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.65, marginBottom: 6 }}>• {f}</div>
                        ))}
                    </div>
                )}

                {/* ── Clinical Message ── */}
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Clinical Summary</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{d.clinical_message}</div>
                </div>

                {/* ── Recommendations ── */}
                {d.recommendations?.length > 0 && (
                    <div style={{ background: `${C.lipid}08`, border: `1px solid ${C.lipid}25`, borderRadius: 16, padding: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Zap size={14} color={C.lipid} />
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.lipid, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recommendations</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {d.recommendations.map((r: string, i: number) => (
                                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    <span style={{ color: C.lipid, flexShrink: 0, marginTop: 2 }}>•</span>
                                    <span>{r}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ── Panel analysis table ────────────────────────────────────────────────────
    const PanelTable = ({ panel }: { panel: any }) => (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Activity size={16} color={C.lipid} />
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Lipid Panel — NLA-2014 Reference</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: 'rgba(13, 92, 126, 0.04)' }}>
                            {['Parameter', 'Value', 'Unit', 'Reference Range', 'Status'].map(h => (
                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(panel || {}).map(([key, p]: [string, any]) => (
                            <PanelRow key={key} paramKey={key} p={p} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div>
            {/* ── Input Card ── */}
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, marginBottom: 24 }}>

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.lipid}, #0077B6)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Heart size={18} color="#fff" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>Lipid Profile Analyzer</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Random Forest · NLA-2014 · Cardiovascular Risk</div>
                        </div>
                    </div>

                    {/* Mode toggle */}
                    <div style={{ display: 'flex', gap: 6, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 4 }}>
                        {(['manual', 'pdf'] as const).map(m => (
                            <button key={m} onClick={() => setInputMode(m)} style={{
                                padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: inputMode === m ? `${C.lipid}18` : 'transparent',
                                color: inputMode === m ? C.lipid : 'var(--text-muted)',
                                fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6,
                                transition: 'all 0.2s',
                            }}>
                                {m === 'manual' ? <><FileText size={12} />Manual Entry</> : <><Upload size={12} />Upload PDF</>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── PDF upload zone ── */}
                {inputMode === 'pdf' ? (
                    <div style={{ border: `2px dashed ${C.lipid}30`, borderRadius: 14, padding: 44, textAlign: 'center', background: `${C.lipid}04` }}>
                        <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
                            onChange={e => e.target.files?.[0] && handlePdfUpload(e.target.files[0])} />
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🧪</div>
                        <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 800, marginBottom: 6 }}>Upload Lipid Panel Report</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.7 }}>
                            Supports <strong style={{ color: 'var(--text-secondary)' }}>PDF</strong> and <strong style={{ color: 'var(--text-secondary)' }}>DOCX</strong>.
                            <br />AI extracts Total Cholesterol, LDL, HDL, VLDL, Triglycerides, Non-HDL automatically.
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 24 }}>You can review and edit all values before running the analysis.</div>
                        <button onClick={() => fileRef.current?.click()} disabled={pdfLoading} style={{
                            padding: '12px 30px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: `linear-gradient(135deg, ${C.lipid}, #0077B6)`, color: '#fff', fontWeight: 800, fontSize: 14,
                            boxShadow: `0 4px 20px ${C.lipid}30`, opacity: pdfLoading ? 0.7 : 1,
                        }}>
                            {pdfLoading ? '⏳ Extracting...' : '📂 Choose File (PDF / DOCX)'}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* ── Lipid Panel Values ── */}
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Lipid Panel Values</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
                            <Field label="Total Cholesterol *" value={form.total_cholesterol} onChange={set('total_cholesterol')} placeholder="100–350" unit="mg/dL" />
                            <Field label="LDL *" value={form.ldl} onChange={set('ldl')} placeholder="40–250" unit="mg/dL" />
                            <Field label="HDL *" value={form.hdl} onChange={set('hdl')} placeholder="20–90" unit="mg/dL" />
                            <Field label="Triglycerides *" value={form.triglycerides} onChange={set('triglycerides')} placeholder="50–600" unit="mg/dL" />
                            <Field label="VLDL" value={form.vldl} onChange={set('vldl')} placeholder="auto (TG÷5)" unit="mg/dL" />
                            <Field label="Non-HDL" value={form.non_hdl} onChange={set('non_hdl')} placeholder="auto (TC−HDL)" unit="mg/dL" />
                        </div>

                        {/* ── Patient Demographics ── */}
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Patient Demographics</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                            <Field label="Age *" value={form.age} onChange={set('age')} placeholder="20–80" />
                            <Field label="BMI" value={form.bmi} onChange={set('bmi')} placeholder="optional" unit="kg/m²" />
                            {/* Gender selector */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Gender</label>
                                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                    style={{ padding: '9px 12px', background: 'var(--surface-0)', border: '1px solid var(--surface-border-md)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 13.5, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                </select>
                            </div>
                        </div>

                        {/* ── Risk Flags ── */}
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Risk Factors</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 26 }}>
                            <Toggle label="Diabetic" active={flags.is_diabetic === 1} onClick={() => toggleFlag('is_diabetic')} />
                            <Toggle label="Hypertensive" active={flags.is_hypertensive === 1} onClick={() => toggleFlag('is_hypertensive')} />
                            <Toggle label="Smoker" active={flags.is_smoker === 1} onClick={() => toggleFlag('is_smoker')} />
                        </div>

                        {/* Submit */}
                        <button onClick={submit} disabled={loading} style={{
                            padding: '13px 36px', borderRadius: 12, border: 'none',
                            background: loading ? 'var(--surface-2)' : `linear-gradient(135deg, ${C.lipid}, #0077B6)`,
                            color: 'var(--text-primary)', fontWeight: 800, fontSize: 14.5, cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: loading ? 'none' : `0 6px 28px ${C.lipid}35`,
                            transition: 'all 0.2s',
                        }}>
                            {loading ? '⏳ Analyzing Lipid Profile...' : '🫀 Analyze Lipid Profile'}
                        </button>
                    </>
                )}
            </div>

            {/* ── Results section ── */}
            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 22, alignItems: 'start' }}>
                    {/* Left — Panel table */}
                    <div>
                        <PanelTable panel={result.panel_analysis} />

                        {/* Risk probability bar */}
                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Risk Probability Distribution</div>
                            {Object.entries(result.risk_probability || {}).map(([cat, prob]: [string, any]) => {
                                const cfg = RISK_CFG[cat] || RISK_CFG.LOW;
                                const pct = Math.round(prob * 100);
                                return (
                                    <div key={cat} style={{ marginBottom: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cat}</span>
                                            <span style={{ fontSize: 12, fontFamily: 'monospace', color: cfg.color, fontWeight: 700 }}>{pct}%</span>
                                        </div>
                                        <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}aa)`, borderRadius: 99, transition: 'width 0.6s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right — Results cards */}
                    <Results d={result} />
                </div>
            )}
        </div>
    );
}
