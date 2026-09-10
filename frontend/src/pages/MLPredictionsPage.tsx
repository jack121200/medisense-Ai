import React, { useState, useRef } from 'react';
import { Brain, Heart, Droplets, Upload, FileText, AlertTriangle, CheckCircle, Info, Activity } from 'lucide-react';
import { mlApi } from '../api/ml.api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import apiClient from '../api/axiosInstance';
import LipidProfileTab from '../components/ml/LipidProfileTab';

// ── Colour tokens ──────────────────────────────────────────────────────────────
const C = {
    crimson:  'var(--accent-primary)',
    rose:     'var(--accent-primary-hover)',
    gold:     'var(--risk-medium)',
    teal:     'var(--risk-low)',
    lavender: 'var(--vitals-bp)',
    bg:       'var(--surface-1)',
    border:   'var(--surface-border)',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function RiskBadge({ level, probability }: { level: string; probability: number }) {
    const cfg: Record<string, { color: string; bg: string; icon: string }> = {
        HIGH:   { color: C.crimson, bg: `${C.crimson}15`, icon: '🔴' },
        MEDIUM: { color: C.gold,    bg: `${C.gold}15`,    icon: '🟡' },
        LOW:    { color: C.teal,    bg: `${C.teal}15`,    icon: '🟢' },
    };
    const s = cfg[level] || cfg.LOW;
    const safeProb = typeof probability === 'number' ? probability : 0;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 32, background: s.bg, border: `2px solid ${s.color}30`, borderRadius: 20 }}>
            <div style={{ fontSize: 52 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{level} RISK</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{safeProb.toFixed(1)}%</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Heart Disease Probability</div>
        </div>
    );
}

function InputField({ label, value, onChange, type = 'number', placeholder = '' }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                style={{ padding: '10px 14px', background: 'var(--surface-1)', border: '1px solid var(--surface-border-md)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => (e.currentTarget.style.border = `1px solid ${C.crimson}50`)}
                onBlur={e => (e.currentTarget.style.border = '1px solid var(--surface-border)')}
            />
        </div>
    );
}

function SelectField({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)}
                style={{ padding: '10px 14px', background: 'var(--surface-0)', border: '1px solid var(--surface-border-md)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="">— select —</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Heart Disease Risk
// ══════════════════════════════════════════════════════════════════════════════

function HeartRiskTab() {
    const [form, setForm] = useState({
        age: '', resting_blood_pressure: '', cholestoral: '', Max_heart_rate: '', oldpeak: '',
        sex: '', chest_pain_type: '', fasting_blood_sugar: '', rest_ecg: '',
        exercise_induced_angina: '', slope: '', vessels_colored_by_flourosopy: '', thalassemia: '',
    });
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const [inputMode, setInputMode] = useState<'manual' | 'pdf'>('manual');
    const [pdfLoading, setPdfLoading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

    // PDF upload → extract → auto-fill
    const handlePdfUpload = async (file: File) => {
        setPdfLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await apiClient.post('/ml/pdf-extract/heart', fd);
            const extracted = res.data.extracted || {};
            setForm(prev => ({ ...prev, ...extracted }));
            toast.success(`Extracted ${res.data.fields_found} fields. Review & correct before predicting.`);
            setInputMode('manual'); // switch back to manual so they can review
        } catch {
            toast.error('PDF extraction failed — try manual entry');
        } finally {
            setPdfLoading(false);
        }
    };
    const submit = async () => {
        const required = Object.entries(form).filter(([, v]) => !v);
        if (required.length > 0) {
            toast.error(`Please fill all ${required.length} remaining fields`);
            return;
        }
        setLoading(true);
        try {
            const res = await mlApi.predictHeartRisk({
                ...form,
                age: parseFloat(form.age),
                resting_blood_pressure: parseFloat(form.resting_blood_pressure),
                cholestoral: parseFloat(form.cholestoral),
                Max_heart_rate: parseFloat(form.Max_heart_rate),
                oldpeak: parseFloat(form.oldpeak),
            });
            // Backend wraps ML response in { success, data: {...} }
            setResult(res.data?.data ?? res.data);
            toast.success('Heart risk analysis complete');
        } catch {
            toast.error('Heart risk model not ready — run train_heart_risk.py first');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 360px' : '1fr', gap: 24 }}>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28 }}>
                {/* Input mode toggle — Manual or Upload PDF/DOCX */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 22, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
                    {(['manual', 'pdf'] as const).map(m => (
                        <button key={m} onClick={() => setInputMode(m)} style={{
                            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: inputMode === m ? `${C.crimson}18` : 'transparent',
                            color: inputMode === m ? C.crimson : 'var(--text-muted)',
                            fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                            {m === 'manual' ? <><FileText size={13} /> Manual Entry</> : <><Upload size={13} /> Upload PDF / DOCX</>}
                        </button>
                    ))}
                </div>

                {inputMode === 'pdf' ? (
                    <div style={{ border: '2px dashed rgba(13, 92, 126, 0.3)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
                        <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
                            onChange={e => e.target.files?.[0] && handlePdfUpload(e.target.files[0])} />
                        <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 6 }}>Upload Cardiac Lab Report</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.65 }}>
                            Supports <strong style={{color:'var(--text-secondary)'}}>PDF</strong> and <strong style={{color:'var(--text-secondary)'}}>DOCX</strong> formats.<br/>
                            AI extracts values automatically — unfound fields are left blank.
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>You can review &amp; correct all values before predicting.</div>
                        <button onClick={() => fileRef.current?.click()} disabled={pdfLoading} style={{
                            padding: '11px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: `linear-gradient(135deg, ${C.crimson}, var(--accent-primary-dim))`, color: '#fff', fontWeight: 700, fontSize: 14,
                        }}>
                            {pdfLoading ? '🔄 Extracting...' : '📂 Choose File (PDF / DOCX)'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 24, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Heart size={18} color={C.crimson} /> 14-Feature Cardiac Risk Assessment
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                            <InputField label="Age" value={form.age} onChange={set('age')} placeholder="e.g. 54" />
                            <InputField label="Resting BP (mmHg)" value={form.resting_blood_pressure} onChange={set('resting_blood_pressure')} placeholder="e.g. 130" />
                            <InputField label="Cholesterol (mg/dL)" value={form.cholestoral} onChange={set('cholestoral')} placeholder="e.g. 250" />
                            <InputField label="Max Heart Rate" value={form.Max_heart_rate} onChange={set('Max_heart_rate')} placeholder="e.g. 150" />
                            <InputField label="ST Depression (Oldpeak)" value={form.oldpeak} onChange={set('oldpeak')} placeholder="e.g. 1.5" />
                            <SelectField label="Sex" value={form.sex} onChange={set('sex')} options={['Male', 'Female']} />
                            <SelectField label="Chest Pain Type" value={form.chest_pain_type} onChange={set('chest_pain_type')} options={['Typical angina', 'Atypical angina', 'Non-anginal pain', 'Asymptomatic']} />
                            <SelectField label="Fasting Blood Sugar" value={form.fasting_blood_sugar} onChange={set('fasting_blood_sugar')} options={['Greater than 120 mg/dl', 'Lower than 120 mg/dl']} />
                            <SelectField label="Resting ECG" value={form.rest_ecg} onChange={set('rest_ecg')} options={['Normal', 'ST-T wave abnormality', 'Left ventricular hypertrophy']} />
                            <SelectField label="Exercise-Induced Angina" value={form.exercise_induced_angina} onChange={set('exercise_induced_angina')} options={['Yes', 'No']} />
                            <SelectField label="Slope of ST" value={form.slope} onChange={set('slope')} options={['Upsloping', 'Flat', 'Downsloping']} />
                            <SelectField label="Vessels (Fluoroscopy)" value={form.vessels_colored_by_flourosopy} onChange={set('vessels_colored_by_flourosopy')} options={['Zero', 'One', 'Two', 'Three']} />
                            <SelectField label="Thalassemia" value={form.thalassemia} onChange={set('thalassemia')} options={['Normal', 'Fixed Defect', 'Reversable Defect']} />
                        </div>
                        <button onClick={submit} disabled={loading} style={{
                            padding: '13px 36px', borderRadius: 12, border: 'none',
                            background: loading ? 'var(--surface-2)' : `linear-gradient(135deg, ${C.crimson}, var(--accent-primary-dim))`,
                            color: 'var(--text-primary)', fontWeight: 800, fontSize: 14.5, cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: `0 6px 30px ${C.crimson}30`,
                        }}>
                            {loading ? '🔄 Analyzing...' : '❤️ Predict Heart Disease Risk'}
                        </button>
                    </>
                )}
            </div>

            {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <RiskBadge level={result.risk} probability={result.probability} />
                    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Clinical Message</div>
                        <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.65 }}>{result.message}</div>
                    </div>
                    {result.recommendations?.length > 0 && (
                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Cardiac Recommendations</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {result.recommendations.map((r: string, i: number) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        <span style={{ color: C.gold, flexShrink: 0, marginTop: 1 }}>•</span>{r}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — CBC Analyzer
// ══════════════════════════════════════════════════════════════════════════════

const CBC_FIELDS = [
    { key: 'WBC',   label: 'WBC',   unit: '×10³/μL', placeholder: '4–11' },
    { key: 'LYMp',  label: 'Lymph%', unit: '%',       placeholder: '20–40' },
    { key: 'MIDp',  label: 'Mid%',  unit: '%',       placeholder: '3–9' },
    { key: 'NEUTp', label: 'Neut%', unit: '%',       placeholder: '50–70' },
    { key: 'LYMn',  label: 'LYMn',  unit: '×10³/μL', placeholder: '1–3' },
    { key: 'MIDn',  label: 'MIDn',  unit: '×10³/μL', placeholder: '0.1–1' },
    { key: 'NEUTn', label: 'NEUTn', unit: '×10³/μL', placeholder: '2–7.5' },
    { key: 'RBC',   label: 'RBC',   unit: '×10⁶/μL', placeholder: '4.5–6.5' },
    { key: 'HGB',   label: 'HGB',   unit: 'g/dL',    placeholder: '12–17.5' },
    { key: 'HCT',   label: 'HCT',   unit: '%',       placeholder: '37–52' },
    { key: 'MCV',   label: 'MCV',   unit: 'fL',      placeholder: '80–100' },
    { key: 'MCH',   label: 'MCH',   unit: 'pg',      placeholder: '27–33' },
    { key: 'MCHC',  label: 'MCHC',  unit: 'g/dL',    placeholder: '32–36' },
    { key: 'PLT',   label: 'PLT',   unit: '×10³/μL', placeholder: '150–400' },
    { key: 'MPV',   label: 'MPV',   unit: 'fL',      placeholder: '7.5–12.5' },
];

function CBCTab() {
    const [form, setForm] = useState<Record<string, string>>({});
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [inputMode, setInputMode] = useState<'manual' | 'pdf'>('manual');
    const [pdfLoading, setPdfLoading] = useState(false);
    const cbcFileRef = React.useRef<HTMLInputElement>(null);

    const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

    const handleCbcPdf = async (file: File) => {
        setPdfLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await apiClient.post('/ml/pdf-extract/cbc', fd);
            const extracted = res.data.extracted || {};
            // Convert all extracted values to string for the form
            const stringified: Record<string, string> = {};
            Object.entries(extracted).forEach(([k, v]) => { stringified[k] = String(v); });
            setForm(prev => ({ ...prev, ...stringified }));
            toast.success(`Extracted ${res.data.fields_found} CBC parameters. Review before analyzing.`);
            setInputMode('manual');
        } catch {
            toast.error('CBC PDF extraction failed — enter values manually');
        } finally {
            setPdfLoading(false);
        }
    };

    const submit = async () => {
        const values: Record<string, number> = {};
        CBC_FIELDS.forEach(f => {
            if (form[f.key]) values[f.key] = parseFloat(form[f.key]);
        });
        if (Object.keys(values).length < 3) {
            toast.error('Please enter at least 3 CBC values to analyze');
            return;
        }
        setLoading(true);
        try {
            const res = await mlApi.analyzeCBC(values);
            // Backend wraps ML response in { success, data: {...} }
            setResult(res.data?.data ?? res.data);
            toast.success('CBC analysis complete');
        } catch {
            toast.error('CBC analyzer error — check ML service');
        } finally {
            setLoading(false);
        }
    };

    const statusColor: Record<string, string> = { HIGH: C.crimson, LOW: '#3A86FF', NORMAL: C.teal };
    const statusBg: Record<string, string>    = { HIGH: `${C.crimson}15`, LOW: '#3A86FF15', NORMAL: `${C.teal}10` };

    return (
        <div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, marginBottom: 24 }}>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Droplets size={18} color={C.rose} /> CBC Blood Parameters
                </div>

                {/* PDF/DOCX toggle */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
                    {(['manual', 'pdf'] as const).map(m => (
                        <button key={m} onClick={() => setInputMode(m)} style={{
                            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: inputMode === m ? `${C.rose}18` : 'transparent',
                            color: inputMode === m ? C.rose : 'var(--text-muted)',
                            fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                            {m === 'manual' ? <><FileText size={13} /> Enter Values</> : <><Upload size={13} /> Upload PDF / DOCX</>}
                        </button>
                    ))}
                </div>

                {inputMode === 'pdf' ? (
                    <div style={{ border: '2px dashed rgba(18, 121, 163, 0.3)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
                        <input ref={cbcFileRef} type="file" accept=".pdf" style={{ display: 'none' }}
                            onChange={e => e.target.files?.[0] && handleCbcPdf(e.target.files[0])} />
                        <div style={{ fontSize: 36, marginBottom: 12 }}>🧪</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 6 }}>Upload CBC Lab Report (PDF)</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.65 }}>
                            AI will automatically extract all 20 CBC parameters.<br />You can review values before running the analysis.
                        </div>
                        <button onClick={() => cbcFileRef.current?.click()} disabled={pdfLoading} style={{
                            padding: '11px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: `linear-gradient(135deg, ${C.rose}, var(--accent-primary-dim))`, color: '#fff', fontWeight: 700, fontSize: 14,
                        }}>
                            {pdfLoading ? '🔄 Extracting...' : '📂 Choose PDF File'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 22 }}>
                            {CBC_FIELDS.map(f => (
                                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{f.label}</span>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{f.unit}</span>
                                    </label>
                                    <input type="number" step="any" value={form[f.key] || ''} onChange={e => set(f.key)(e.target.value)}
                                        placeholder={f.placeholder}
                                        style={{ padding: '9px 12px', background: 'var(--surface-1)', border: '1px solid var(--surface-border-md)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }}
                                        onFocus={e => (e.currentTarget.style.border = `1px solid ${C.rose}50`)}
                                        onBlur={e => (e.currentTarget.style.border = '1px solid var(--surface-border)')} />
                                </div>
                            ))}
                        </div>
                        <button onClick={submit} disabled={loading} style={{
                            padding: '12px 32px', borderRadius: 12, border: 'none',
                            background: loading ? 'var(--surface-2)' : `linear-gradient(135deg, ${C.rose}, var(--accent-primary-dim))`,
                            color: 'var(--text-primary)', fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
                        }}>
                            {loading ? '🔄 Analyzing...' : '🩸 Analyze CBC Report'}
                        </button>
                    </>
                )}
            </div>

            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
                    {/* Findings table */}
                    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
                        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>CBC Results</div>
                            <div style={{ padding: '5px 14px', borderRadius: 9999, background: statusBg[result.overall_status === 'NORMAL' ? 'NORMAL' : result.overall_status === 'MILD CONCERN' ? 'LOW' : 'HIGH'], color: statusColor[result.overall_status === 'NORMAL' ? 'NORMAL' : result.overall_status === 'MILD CONCERN' ? 'LOW' : 'HIGH'], fontSize: 12, fontWeight: 700 }}>
                                {result.overall_status}
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: 'var(--surface-1)' }}>
                                        {['Parameter', 'Value', 'Unit', 'Reference', 'Status', 'Flag'].map(h => (
                                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                     {Object.entries(result?.findings || {}).map(([key, f]: [string, any]) => (
                                        <tr key={key} style={{ borderBottom: `1px solid var(--surface-border)` }}
                                            onMouseOver={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-1)'}
                                            onMouseOut={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                                        >
                                            <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{f.name}</td>
                                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: statusColor[f.status] || 'var(--text-primary)', fontWeight: 700 }}>{f.value}</td>
                                            <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{f.unit}</td>
                                            <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{f.reference}</td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ padding: '3px 10px', borderRadius: 9999, background: statusBg[f.status] || 'transparent', color: statusColor[f.status] || 'var(--surface-0)', fontSize: 11, fontWeight: 700 }}>{f.status}</span>
                                            </td>
                                            <td style={{ padding: '10px 16px', fontSize: 16 }}>{f.flag}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Interpretation panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ background: `${result.overall_color}10`, border: `1px solid ${result.overall_color}30`, borderRadius: 16, padding: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Overall Status</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: result.overall_color }}>{result.overall_status}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{result.abnormal_count} abnormal / {result.parameters_tested} tested</div>
                        </div>
                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>AI Interpretation</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {result.interpretations?.map((msg: string, i: number) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                        <span>•</span><span>{msg}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {result.cardiac_note && (
                            <div style={{ background: `${C.crimson}10`, border: `1px solid ${C.crimson}25`, borderRadius: 14, padding: 16 }}>
                                <div style={{ fontSize: 12, color: C.crimson, fontWeight: 700, lineHeight: 1.6 }}>{result.cardiac_note}</div>
                            </div>
                        )}
                        {result.anomaly_detection?.available && (
                            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>ML Anomaly Detector</div>
                                <div style={{ fontSize: 13, color: result.anomaly_detection.is_anomaly ? C.crimson : C.teal, fontWeight: 700 }}>{result.anomaly_detection.flag}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Score: {result.anomaly_detection.score}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — AI Symptom Checker
// ══════════════════════════════════════════════════════════════════════════════

function SymptomTab() {
    const [symptoms, setSymptoms] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [inputMode, setInputMode] = useState<'manual' | 'pdf'>('manual');
    const [docLoading, setDocLoading] = useState(false);
    const symFileRef = useRef<HTMLInputElement>(null);

    // OCR upload for symptoms
    const handleSymptomFile = async (file: File) => {
        setDocLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await apiClient.post('/ml/pdf-extract/symptoms', fd);
            const csv = res.data.symptoms_csv || '';
            if (csv) {
                setSymptoms(prev => prev ? prev + ', ' + csv : csv);
                toast.success(`Found ${res.data.symptoms_found} symptom(s) in document. Review before predicting.`);
            } else {
                toast(`⚠️ ${res.data.message || 'No known symptoms detected.'}`, { icon: '📍', duration: 4000 });
            }
            setInputMode('manual');
        } catch {
            toast.error('File extraction failed — please enter symptoms manually');
        } finally {
            setDocLoading(false);
        }
    };

    const submit = async () => {
        const list = symptoms.split(',').map(s => s.trim().toLowerCase().replace(/ /g, '_')).filter(Boolean);
        if (list.length < 1) { toast.error('Enter at least one symptom'); return; }
        setLoading(true);
        try {
            const res = await mlApi.predictDisease(list);
            // Backend wraps ML response in { success, data: {...} }
            setResult(res.data?.data ?? res.data);
        } catch {
            toast.error('Disease model not ready — run train_disease_model.py first');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 340px' : '1fr', gap: 24 }}>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28 }}>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Brain size={18} color={C.lavender} /> AI Symptom Checker
                </div>

                {/* Manual / PDF+DOCX toggle */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
                    {(['manual', 'pdf'] as const).map(m => (
                        <button key={m} onClick={() => setInputMode(m)} style={{
                            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: inputMode === m ? `${C.lavender}20` : 'transparent',
                            color: inputMode === m ? C.lavender : 'var(--text-muted)',
                            fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                            {m === 'manual' ? <><FileText size={13} /> Type Symptoms</> : <><Upload size={13} /> Upload PDF / DOCX</>}
                        </button>
                    ))}
                </div>

                {inputMode === 'pdf' ? (
                    <div style={{ border: '2px dashed rgba(124, 106, 180, 0.3)', borderRadius: 14, padding: 40, textAlign: 'center', marginBottom: 0 }}>
                        <input ref={symFileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
                            onChange={e => e.target.files?.[0] && handleSymptomFile(e.target.files[0])} />
                        <div style={{ fontSize: 36, marginBottom: 12 }}>🧠</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 6 }}>Upload Patient Report / Referral Letter</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.65 }}>
                            Supports <strong style={{color:'var(--text-secondary)'}}>PDF</strong> and <strong style={{color:'var(--text-secondary)'}}>DOCX</strong> formats.<br/>
                            AI scans for 50+ symptom keywords — only matched symptoms are added.
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>Extracted symptoms will appear in the text box. You can edit before predicting.</div>
                        <button onClick={() => symFileRef.current?.click()} disabled={docLoading} style={{
                            padding: '11px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: `linear-gradient(135deg, ${C.lavender}, #7B2FF7)`, color: '#fff', fontWeight: 700, fontSize: 14,
                        }}>
                            {docLoading ? '🔄 Scanning for Symptoms...' : '📂 Choose File (PDF / DOCX)'}
                        </button>
                    </div>
                ) : (
                    <>
                        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.65 }}>
                            Enter patient symptoms separated by commas. The AI predicts the most likely condition from 134 symptom patterns.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Symptoms (comma-separated)</label>
                            <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)}
                                placeholder="e.g. chest_pain, shortness_of_breath, fatigue, dizziness"
                                rows={4}
                                style={{ padding: '12px 16px', background: 'var(--surface-1)', border: '1px solid var(--surface-border-md)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                            />
                        </div>
                        <button onClick={submit} disabled={loading} style={{
                            padding: '12px 32px', borderRadius: 12, border: 'none',
                            background: loading ? 'var(--surface-2)' : `linear-gradient(135deg, ${C.lavender}, #7B2FF7)`,
                            color: 'var(--text-primary)', fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
                        }}>
                            {loading ? '🔄 Checking...' : '🧠 Predict Condition'}
                        </button>
                    </>
                )}
            </div>

            {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: `${C.lavender}12`, border: `1px solid ${C.lavender}30`, borderRadius: 18, padding: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Primary Diagnosis</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 6 }}>{result.disease}</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: C.lavender, fontFamily: 'monospace' }}>{result.confidence}%</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Confidence</div>
                    </div>
                    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Top Alternatives</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {result.alternatives?.slice(1).map((a: any) => (
                                <div key={a.disease} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-1)', borderRadius: 8 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.disease}</span>
                                    <span style={{ fontSize: 13, color: C.lavender, fontFamily: 'monospace', fontWeight: 700 }}>{a.confidence}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

import BayesianUncertaintyCard from '../components/BayesianUncertaintyCard';
import FuzzyDosingCard from '../components/FuzzyDosingCard';
import LiveWaveformMonitor from '../components/LiveWaveformMonitor';

const TABS = [
    { id: 'bayesian',label: '🔮 Bayesian Engine',      icon: Brain,    color: 'var(--accent-primary)' },
    { id: 'fuzzy',   label: '🎛️ Fuzzy Dosing Engine', icon: Heart,    color: 'var(--risk-medium-text)' },
    { id: 'deep',    label: '⚡ Deep Waveform Monitor',icon: Activity, color: 'var(--risk-critical-text)' },
    { id: 'lipid',   label: '🫀 Lipid Profile',      icon: Heart,    color: 'var(--accent-primary)' },
    { id: 'cbc',     label: '🩸 CBC Analyzer',        icon: Droplets, color: 'var(--accent-primary-hover)' },
    { id: 'symptom', label: '🧠 Symptom Checker',     icon: Brain,    color: 'var(--vitals-bp)' },
];

export default function MLPredictionsPage() {
    const [tab, setTab] = useState('bayesian');
    const { user } = useAuthStore();
    const isPatient = user?.role === 'PATIENT';

    const patientTabs = [
        { id: 'bayesian',label: '🔮 Bayesian Uncertainty', color: 'var(--accent-primary)' },
        { id: 'fuzzy',   label: '🎛️ Fuzzy Drug Dosing',    color: 'var(--risk-medium-text)' },
        { id: 'deep',    label: '⚡ Waveform Monitor',     color: 'var(--risk-critical-text)' },
        { id: 'lipid',   label: '🫀 Lipid Profile',        color: 'var(--accent-primary)' },
        { id: 'cbc',     label: '🩸 CBC Report',            color: 'var(--accent-primary-hover)' },
        { id: 'symptom', label: '🧠 Symptom Checker',      color: 'var(--vitals-bp)' },
    ];
    const doctorTabs = TABS;
    return (
        <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent-primary), #0077B6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🫀</div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>AI Clinical Tools</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Research-Grade Medical AI Engine — Bayesian DAG, Mamdani FIS Dosing, Deep Autoencoder, Lipid Profiler, CBC Analyzer</p>
                    </div>
                </div>
            </div>

            {/* Role-aware tab bar */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 28, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: 6, width: 'fit-content' }}>
                {(isPatient ? patientTabs : doctorTabs).map((t: any) => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: tab === t.id ? `${t.color}18` : 'transparent',
                        color: tab === t.id ? t.color : 'var(--text-secondary)',
                        fontWeight: tab === t.id ? 800 : 600, fontSize: 13.5,
                        boxShadow: tab === t.id ? `0 0 0 1px ${t.color}35` : 'none',
                        transition: 'all 0.15s',
                    }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {tab === 'bayesian' && <BayesianUncertaintyCard />}
            {tab === 'fuzzy'    && <FuzzyDosingCard />}
            {tab === 'deep'     && <LiveWaveformMonitor />}
            {tab === 'lipid'    && <LipidProfileTab />}
            {tab === 'cbc'      && <CBCTab />}
            {tab === 'symptom'  && <SymptomTab />}
        </div>
    );
}
