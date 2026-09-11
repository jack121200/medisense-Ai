import React, { useState, useRef } from 'react';
import { Brain, Heart, Droplets, Upload, FileText } from 'lucide-react';
import { mlApi } from '../api/ml.api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import apiClient from '../api/axiosInstance';
import LipidProfileTab from '../components/ml/LipidProfileTab';
import SymptomChecker from '../components/SymptomChecker';
import BayesianUncertaintyCard from '../components/BayesianUncertaintyCard';
import FuzzyDosingCard from '../components/FuzzyDosingCard';
import LiveWaveformMonitor from '../components/LiveWaveformMonitor';

// ── Colour tokens ──────────────────────────────────────────────────────────────
// Literal hex, mirrored from index.css. Tints here are built by appending an
// alpha suffix (`${C.accent}18`), which a var() reference cannot take — with
// variables every one of those backgrounds and borders was silently dropped.
const C = {
    accent: '#235347',      // --accent-primary
    accentHover: '#2E6B5B', // --accent-primary-hover
    accentDim: '#163832',   // --accent-primary-dim
    lavender: '#7A68AE',    // --vitals-bp
    bg: 'var(--surface-1)',
    border: 'var(--surface-border)',
};
// Text-safe semantic shades (--risk-*-text). Risk is shown in these, never in
// the brand accent: a HIGH heart-risk result used to render in brand green.
const RISK = { critical: '#B0363F', high: '#924E21', medium: '#7A5C14', low: '#2B6A4F', info: '#256876' };

const primaryButton = (color: string, busy: boolean): React.CSSProperties => ({
    padding: '12px 32px', borderRadius: 12, border: 'none',
    background: busy ? 'var(--surface-3)' : color,
    color: busy ? 'var(--text-muted)' : '#fff', fontWeight: 800, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer',
});

// ── Sub-components ─────────────────────────────────────────────────────────────

function RiskBadge({ level, probability }: { level: string; probability: number }) {
    const cfg: Record<string, { color: string; icon: string }> = {
        HIGH:   { color: RISK.critical, icon: '🔴' },
        MEDIUM: { color: RISK.medium,   icon: '🟡' },
        LOW:    { color: RISK.low,      icon: '🟢' },
    };
    const s = cfg[level] || cfg.LOW;
    const safeProb = typeof probability === 'number' ? probability : 0;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 32, background: `${s.color}14`, border: `2px solid ${s.color}40`, borderRadius: 20 }}>
            <div style={{ fontSize: 52 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{level} RISK</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: s.color, fontFamily: 'var(--font-mono)' }}>{safeProb.toFixed(1)}%</div>
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
                onFocus={e => (e.currentTarget.style.border = `1px solid ${C.accent}80`)}
                onBlur={e => (e.currentTarget.style.border = '1px solid var(--surface-border-md)')}
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

function ModeToggle<T extends string>({ modes, value, onChange, color }: {
    modes: Array<[T, React.ReactNode]>; value: T; onChange: (m: T) => void; color: string;
}) {
    return (
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {modes.map(([m, label]) => (
                <button key={m} onClick={() => onChange(m)} style={{
                    padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: value === m ? `${color}18` : 'transparent',
                    color: value === m ? color : 'var(--text-muted)',
                    fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    {label}
                </button>
            ))}
        </div>
    );
}

function UploadBox({ icon, title, hint, accept, busy, busyLabel, color, onFile }: {
    icon: string; title: string; hint: React.ReactNode; accept: string; busy: boolean; busyLabel: string; color: string; onFile: (f: File) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <div style={{ border: `2px dashed ${color}4D`, borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <input ref={ref} type="file" accept={accept} style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
            <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.65 }}>{hint}</div>
            <button onClick={() => ref.current?.click()} disabled={busy} style={{ ...primaryButton(color, busy), padding: '11px 28px' }}>
                {busy ? busyLabel : '📂 Choose file'}
            </button>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Heart Disease Risk
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
        const missing = Object.entries(form).filter(([, v]) => !v);
        if (missing.length > 0) {
            toast.error(`Please fill all ${missing.length} remaining fields`);
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
        <div style={{ display: 'grid', gridTemplateColumns: result ? 'minmax(0, 1fr) 360px' : '1fr', gap: 24 }}>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28 }}>
                <ModeToggle color={C.accent} value={inputMode} onChange={setInputMode}
                    modes={[['manual', <><FileText size={13} /> Manual entry</>], ['pdf', <><Upload size={13} /> Upload PDF / DOCX</>]]} />

                {inputMode === 'pdf' ? (
                    <UploadBox icon="📄" title="Upload a cardiology report" accept=".pdf,.docx" color={C.accent}
                        busy={pdfLoading} busyLabel="🔄 Extracting…" onFile={handlePdfUpload}
                        hint={<>PDF or DOCX. Values found are filled in automatically; anything not found is left blank for you to enter.</>} />
                ) : (
                    <>
                        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 24, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Heart size={18} color={RISK.critical} /> 13-Feature Heart Disease Risk Assessment
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
                        <button onClick={submit} disabled={loading} style={{ ...primaryButton(C.accent, loading), padding: '13px 36px', fontSize: 14.5 }}>
                            {loading ? '🔄 Analyzing…' : '❤️ Predict heart disease risk'}
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
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Recommendations</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {result.recommendations.map((r: string, i: number) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        <span style={{ color: RISK.medium, flexShrink: 0, marginTop: 1 }}>•</span>{r}
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
// CBC Analyzer
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

const CBC_STATUS: Record<string, string> = { HIGH: RISK.critical, LOW: RISK.info, NORMAL: RISK.low };
// Coloured from the status itself rather than a colour sent by the API, so the
// panel stays in the palette whatever the service returns.
const overallTone = (status: string) => status === 'NORMAL' ? RISK.low : status === 'MILD CONCERN' ? RISK.medium : RISK.critical;

function CBCTab() {
    const [form, setForm] = useState<Record<string, string>>({});
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [inputMode, setInputMode] = useState<'manual' | 'pdf'>('manual');
    const [pdfLoading, setPdfLoading] = useState(false);

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

    const tone = result ? overallTone(result.overall_status) : RISK.low;

    return (
        <div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, marginBottom: 24 }}>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Droplets size={18} color={C.accentHover} /> CBC Blood Parameters
                </div>

                <ModeToggle color={C.accentHover} value={inputMode} onChange={setInputMode}
                    modes={[['manual', <><FileText size={13} /> Enter values</>], ['pdf', <><Upload size={13} /> Upload PDF</>]]} />

                {inputMode === 'pdf' ? (
                    <UploadBox icon="🧪" title="Upload a CBC lab report (PDF)" accept=".pdf" color={C.accentHover}
                        busy={pdfLoading} busyLabel="🔄 Extracting…" onFile={handleCbcPdf}
                        hint={<>The CBC parameters found in the report are filled in for you to review before analysis.</>} />
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
                                        onFocus={e => (e.currentTarget.style.border = `1px solid ${C.accentHover}80`)}
                                        onBlur={e => (e.currentTarget.style.border = '1px solid var(--surface-border-md)')} />
                                </div>
                            ))}
                        </div>
                        <button onClick={submit} disabled={loading} style={primaryButton(C.accentHover, loading)}>
                            {loading ? '🔄 Analyzing…' : '🩸 Analyze CBC report'}
                        </button>
                    </>
                )}
            </div>

            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20 }}>
                    {/* Findings table */}
                    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
                        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>CBC Results</div>
                            <div style={{ padding: '5px 14px', borderRadius: 9999, background: `${tone}1A`, color: tone, fontSize: 12, fontWeight: 700 }}>
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
                                    {Object.entries(result?.findings || {}).map(([key, f]: [string, any]) => {
                                        const sc = CBC_STATUS[f.status];
                                        return (
                                            <tr key={key} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                                <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{f.name}</td>
                                                <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: sc || 'var(--text-primary)', fontWeight: 700 }}>{f.value}</td>
                                                <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{f.unit}</td>
                                                <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{f.reference}</td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{ padding: '3px 10px', borderRadius: 9999, background: sc ? `${sc}1A` : 'transparent', color: sc || 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>{f.status}</span>
                                                </td>
                                                <td style={{ padding: '10px 16px', fontSize: 16 }}>{f.flag}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Interpretation panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ background: `${tone}12`, border: `1px solid ${tone}40`, borderRadius: 16, padding: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Overall Status</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: tone }}>{result.overall_status}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{result.abnormal_count} abnormal / {result.parameters_tested} tested</div>
                        </div>
                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Interpretation</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {result.interpretations?.map((msg: string, i: number) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                        <span>•</span><span>{msg}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {result.cardiac_note && (
                            <div style={{ background: `${C.accent}0F`, border: `1px solid ${C.accent}30`, borderRadius: 14, padding: 16 }}>
                                <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, lineHeight: 1.6 }}>{result.cardiac_note}</div>
                            </div>
                        )}
                        {result.anomaly_detection?.available && (
                            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>ML Anomaly Detector</div>
                                <div style={{ fontSize: 13, color: result.anomaly_detection.is_anomaly ? RISK.critical : RISK.low, fontWeight: 700 }}>{result.anomaly_detection.flag}</div>
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
// Symptom Checker
// ══════════════════════════════════════════════════════════════════════════════

// The picker (SymptomChecker) replaces free-text entry, which asked people to
// type the model's snake_case terms. Symptoms read from an uploaded document
// drop into the picker for review.
function SymptomTab() {
    const [inputMode, setInputMode] = useState<'pick' | 'pdf'>('pick');
    const [docLoading, setDocLoading] = useState(false);
    const [seed, setSeed] = useState<string[]>([]);

    const handleSymptomFile = async (file: File) => {
        setDocLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await apiClient.post('/ml/pdf-extract/symptoms', fd);
            const found = String(res.data.symptoms_csv || '')
                .split(',').map(s => s.trim().toLowerCase().replace(/ /g, '_')).filter(Boolean);
            if (found.length) {
                setSeed(found);
                toast.success(`Found ${found.length} symptom(s) in the document — review them before predicting.`);
                setInputMode('pick');
            } else {
                toast(res.data.message || 'No known symptoms found in that document.', { icon: '📍', duration: 4000 });
            }
        } catch {
            toast.error('File extraction failed — pick symptoms instead');
        } finally {
            setDocLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 760 }}>
            <ModeToggle color={C.lavender} value={inputMode} onChange={setInputMode}
                modes={[['pick', <><Brain size={13} /> Pick symptoms</>], ['pdf', <><Upload size={13} /> Upload PDF / DOCX</>]]} />
            {inputMode === 'pdf' ? (
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28 }}>
                    <UploadBox icon="🧠" title="Upload a patient report or referral letter" accept=".pdf,.docx" color={C.lavender}
                        busy={docLoading} busyLabel="🔄 Scanning for symptoms…" onFile={handleSymptomFile}
                        hint={<>PDF or DOCX. Recognised symptoms are added to the picker so you can review them before predicting.</>} />
                </div>
            ) : (
                <SymptomChecker seedSymptoms={seed} />
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

// Tab colours are literal hex for the same reason as C above.
const TABS = [
    { id: 'heart',   label: '❤️ Heart Risk',          color: '#924E21' },
    { id: 'bayesian',label: '🔮 Bayesian Engine',     color: '#235347' },
    { id: 'fuzzy',   label: '🎛️ Fuzzy Dosing Engine', color: '#7A5C14' },
    { id: 'deep',    label: '⚡ ECG Beat Screen',     color: '#B0363F' },
    { id: 'lipid',   label: '🫀 Lipid Profile',       color: '#235347' },
    { id: 'cbc',     label: '🩸 CBC Analyzer',        color: '#2E6B5B' },
    { id: 'symptom', label: '🧠 Symptom Checker',     color: '#7A68AE' },
];

// Heart risk, the Bayesian risk network, fuzzy dosing and ECG beat screening
// read like clinical instruments — model inputs such as fluoroscopy and ST
// slope, a raw probability network, a drug-dosing calculator, a single-beat
// morphology flag meant to be correlated against a full rhythm strip. They
// are for a clinician's judgement, not a patient's, so patients see only the
// tools meant to be read directly: CBC report, lipid profile and the symptom
// checker.
const PATIENT_TABS = [
    { id: 'cbc',     label: '🩸 CBC Report',      color: '#2E6B5B' },
    { id: 'lipid',   label: '🫀 Lipid Profile',   color: '#235347' },
    { id: 'symptom', label: '🧠 Symptom Checker', color: '#7A68AE' },
];

export default function MLPredictionsPage() {
    const { user } = useAuthStore();
    const isPatient = user?.role === 'PATIENT';
    const tabs = isPatient ? PATIENT_TABS : TABS;
    const [tab, setTab] = useState(isPatient ? 'cbc' : 'heart');

    return (
        <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-magenta))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🫀</div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                            {isPatient ? 'AI Health Tools' : 'AI Clinical Tools'}
                        </h1>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                            {isPatient
                                ? 'CBC analyzer, lipid profiler and symptom checker'
                                : 'Heart disease risk, Bayesian risk network, fuzzy-logic dosing, ECG beat screening, lipid profiler, CBC analyzer and symptom checker'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Role-aware tab bar */}
            <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: 6, width: 'fit-content', maxWidth: '100%' }}>
                {tabs.map(t => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{
                        padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: tab === t.id ? `${t.color}18` : 'transparent',
                        color: tab === t.id ? t.color : 'var(--text-secondary)',
                        fontWeight: tab === t.id ? 800 : 600, fontSize: 13.5,
                        boxShadow: tab === t.id ? `0 0 0 1px ${t.color}40` : 'none',
                        transition: 'all 0.15s',
                    }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Content — clinician-only tools are gated even if `tab` were ever
                forced to one of their ids, since a patient's tab bar cannot
                set it there. */}
            {!isPatient && tab === 'heart'    && <HeartRiskTab />}
            {!isPatient && tab === 'bayesian' && <BayesianUncertaintyCard />}
            {!isPatient && tab === 'fuzzy'    && <FuzzyDosingCard />}
            {!isPatient && tab === 'deep'     && <LiveWaveformMonitor />}
            {tab === 'lipid'                  && <LipidProfileTab />}
            {tab === 'cbc'                    && <CBCTab />}
            {tab === 'symptom'                && <SymptomTab />}
        </div>
    );
}
