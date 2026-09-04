/**
 * CBC Blood Report Analyzer — CardioSense AI
 * ===========================================
 * Full-page CBC analyzer for lab technicians and doctors.
 * Supports manual input OR table-guided entry for all 15 CBC parameters.
 */
import React, { useState } from 'react';
import { Droplets, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { mlApi } from '../api/ml.api';
import toast from 'react-hot-toast';

const C = {
    crimson:  '#E63946',
    rose:     '#FF6B6B',
    gold:     '#FFD166',
    teal:     '#06D6A0',
    lavender: '#C77DFF',
};

const CBC_PARAMS = [
    { key: 'WBC',   name: 'White Blood Cells',       unit: '×10³/μL', ref: '4.0 – 11.0',    placeholder: '4–11' },
    { key: 'LYMp',  name: 'Lymphocyte %',             unit: '%',       ref: '20.0 – 40.0',   placeholder: '20–40' },
    { key: 'MIDp',  name: 'Mid-range Cells %',        unit: '%',       ref: '3.0 – 9.0',     placeholder: '3–9' },
    { key: 'NEUTp', name: 'Neutrophil %',              unit: '%',       ref: '50.0 – 70.0',   placeholder: '50–70' },
    { key: 'LYMn',  name: 'Lymphocyte Count',          unit: '×10³/μL', ref: '1.0 – 3.0',    placeholder: '1–3' },
    { key: 'MIDn',  name: 'Mid-range Count',           unit: '×10³/μL', ref: '0.1 – 1.0',    placeholder: '0.1–1' },
    { key: 'NEUTn', name: 'Neutrophil Count',          unit: '×10³/μL', ref: '2.0 – 7.5',    placeholder: '2–7.5' },
    { key: 'RBC',   name: 'Red Blood Cells',           unit: '×10⁶/μL', ref: '4.5 – 6.5',    placeholder: '4.5–6.5' },
    { key: 'HGB',   name: 'Hemoglobin',                unit: 'g/dL',    ref: '12.0 – 17.5',   placeholder: '12–17.5' },
    { key: 'HCT',   name: 'Hematocrit',                unit: '%',       ref: '37.0 – 52.0',   placeholder: '37–52' },
    { key: 'MCV',   name: 'Mean Cell Volume',          unit: 'fL',      ref: '80.0 – 100.0',  placeholder: '80–100' },
    { key: 'MCH',   name: 'Mean Cell Hemoglobin',      unit: 'pg',      ref: '27.0 – 33.0',   placeholder: '27–33' },
    { key: 'MCHC',  name: 'MCHC',                      unit: 'g/dL',    ref: '32.0 – 36.0',   placeholder: '32–36' },
    { key: 'PLT',   name: 'Platelets',                 unit: '×10³/μL', ref: '150.0 – 400.0', placeholder: '150–400' },
    { key: 'MPV',   name: 'Mean Platelet Volume',      unit: 'fL',      ref: '7.5 – 12.5',    placeholder: '7.5–12.5' },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    HIGH:   { color: C.crimson, bg: `${C.crimson}15`, label: 'HIGH ↑' },
    LOW:    { color: '#3A86FF', bg: '#3A86FF15',       label: 'LOW ↓' },
    NORMAL: { color: C.teal,    bg: `${C.teal}10`,     label: 'NORMAL' },
};

export default function ReportAnalyzerPage() {
    const [values, setValues] = useState<Record<string, string>>({});
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const set = (key: string, val: string) => setValues(v => ({ ...v, [key]: val }));

    const filledCount = Object.values(values).filter(v => v !== '').length;

    const analyze = async () => {
        const payload: Record<string, number> = {};
        CBC_PARAMS.forEach(p => {
            if (values[p.key]) payload[p.key] = parseFloat(values[p.key]);
        });
        if (Object.keys(payload).length < 3) {
            toast.error('Enter at least 3 CBC values to run analysis');
            return;
        }
        setLoading(true);
        try {
            const res = await mlApi.analyzeCBC(payload);
            const cbcData = res.data?.data || res.data;
            setResult(cbcData);
            toast.success(`CBC analyzed — ${cbcData?.abnormal_count ?? 0} abnormal values found`);
        } catch {
            toast.error('CBC analyzer error — check ML service connection');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => { setValues({}); setResult(null); };

    return (
        <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${C.crimson}, #A4161A)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🩸</div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>CBC Blood Report Analyzer</h1>
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                            AI-powered Complete Blood Count analysis with clinical interpretation
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: filledCount > 0 ? C.teal : 'rgba(255,255,255,0.3)' }}>{filledCount} / {CBC_PARAMS.length} filled</div>
                        <div>parameters entered</div>
                    </div>
                    {(result || filledCount > 0) && (
                        <button onClick={reset} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── Input Table ── */}
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden', marginBottom: 22 }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Droplets size={16} color={C.rose} />
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Enter CBC Parameters</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>Enter any combination — partial analysis supported</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                {['Parameter', 'Full Name', 'Normal Range', 'Unit', 'Your Value', ''].map(h => (
                                    <th key={h} style={{ padding: '11px 20px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {CBC_PARAMS.map((p, i) => {
                                const val = values[p.key] || '';
                                const filled = val !== '';
                                return (
                                    <tr key={p.key} style={{ borderBottom: i < CBC_PARAMS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                                        onMouseOver={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseOut={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                                    >
                                        <td style={{ padding: '10px 20px', fontWeight: 800, color: C.rose, fontSize: 13, fontFamily: 'monospace' }}>{p.key}</td>
                                        <td style={{ padding: '10px 20px', color: 'rgba(255,255,255,0.7)' }}>{p.name}</td>
                                        <td style={{ padding: '10px 20px', color: 'rgba(255,255,255,0.35)', fontSize: 12.5, fontFamily: 'monospace' }}>{p.ref}</td>
                                        <td style={{ padding: '10px 20px', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{p.unit}</td>
                                        <td style={{ padding: '8px 20px' }}>
                                            <input
                                                type="number" step="any"
                                                value={val}
                                                onChange={e => set(p.key, e.target.value)}
                                                placeholder={p.placeholder}
                                                style={{
                                                    width: 120, padding: '8px 12px',
                                                    background: filled ? `${C.teal}10` : 'rgba(255,255,255,0.04)',
                                                    border: filled ? `1px solid ${C.teal}35` : '1px solid rgba(255,255,255,0.09)',
                                                    borderRadius: 9, color: '#fff', fontSize: 13.5,
                                                    outline: 'none', fontFamily: 'monospace',
                                                }}
                                                onFocus={e => (e.currentTarget.style.border = `1px solid ${C.rose}50`)}
                                                onBlur={e => (e.currentTarget.style.border = filled ? `1px solid ${C.teal}35` : '1px solid rgba(255,255,255,0.09)')}
                                            />
                                        </td>
                                        <td style={{ padding: '10px 20px' }}>
                                            {filled && <span style={{ fontSize: 14 }}>✅</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div style={{ padding: '18px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button onClick={analyze} disabled={loading || filledCount < 3} style={{
                        padding: '12px 32px', borderRadius: 12, border: 'none',
                        background: loading || filledCount < 3 ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${C.crimson}, #A4161A)`,
                        color: loading || filledCount < 3 ? 'rgba(255,255,255,0.3)' : '#fff',
                        fontWeight: 800, fontSize: 14.5, cursor: loading || filledCount < 3 ? 'not-allowed' : 'pointer',
                        boxShadow: !loading && filledCount >= 3 ? `0 6px 28px ${C.crimson}30` : 'none',
                        transition: 'all 0.2s',
                    }}>
                        {loading ? '🔄 Analyzing CBC...' : '🩸 Analyze Blood Report'}
                    </button>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                        {filledCount < 3 ? `Enter ${3 - filledCount} more value${3 - filledCount !== 1 ? 's' : ''} to enable analysis` : `${filledCount} parameters ready for analysis`}
                    </span>
                </div>
            </div>

            {/* ── Results ── */}
            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 22 }}>

                    {/* Results table */}
                    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
                        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle size={16} color={C.teal} /> Analysis Results
                            </div>
                            <div style={{ padding: '5px 16px', borderRadius: 9999, background: `${result.overall_color}18`, border: `1px solid ${result.overall_color}30`, color: result.overall_color, fontSize: 12, fontWeight: 800 }}>
                                {result.overall_status}
                            </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    {['Parameter', 'Name', 'Value', 'Unit', 'Reference', 'Status', 'Deviation'].map(h => (
                                        <th key={h} style={{ padding: '10px 18px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(result?.findings || {}).map(([key, f]: [string, any]) => {
                                    const sc = STATUS_CONFIG[f.status] || STATUS_CONFIG.NORMAL;
                                    return (
                                        <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.035)' }}
                                            onMouseOver={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                                            onMouseOut={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                                        >
                                            <td style={{ padding: '11px 18px', fontWeight: 800, color: C.rose, fontFamily: 'monospace', fontSize: 13 }}>{key}</td>
                                            <td style={{ padding: '11px 18px', color: 'rgba(255,255,255,0.6)' }}>{f.name}</td>
                                            <td style={{ padding: '11px 18px', fontFamily: 'monospace', fontWeight: 700, color: sc.color, fontSize: 14 }}>{f.value}</td>
                                            <td style={{ padding: '11px 18px', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{f.unit}</td>
                                            <td style={{ padding: '11px 18px', color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'monospace' }}>{f.reference}</td>
                                            <td style={{ padding: '11px 18px' }}>
                                                <span style={{ padding: '4px 12px', borderRadius: 9999, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 800 }}>
                                                    {f.flag} {sc.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '11px 18px', color: f.deviation_pct ? sc.color : 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: 'monospace' }}>
                                                {f.deviation_pct ? `+${f.deviation_pct}%` : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Interpretation panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Overall status */}
                        <div style={{ background: `${result.overall_color}10`, border: `1px solid ${result.overall_color}30`, borderRadius: 18, padding: '22px', textAlign: 'center' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Overall CBC Status</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: result.overall_color, marginBottom: 6 }}>{result.overall_status}</div>
                            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10 }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: C.crimson, fontFamily: 'monospace' }}>{result.abnormal_count}</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Abnormal</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: C.teal, fontFamily: 'monospace' }}>{result.parameters_tested - result.abnormal_count}</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Normal</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>{result.parameters_tested}</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Tested</div>
                                </div>
                            </div>
                        </div>

                        {/* AI Interpretations */}
                        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '18px 20px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Info size={12} /> AI Clinical Interpretation
                            </div>
                            {result.interpretations?.map((msg: string, i: number) => (
                                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, marginBottom: 8 }}>
                                    <span style={{ color: C.gold, flexShrink: 0, marginTop: 2 }}>•</span>
                                    <span>{msg}</span>
                                </div>
                            ))}
                        </div>

                        {/* Cardiac note */}
                        {result.cardiac_note && (
                            <div style={{ background: `${C.crimson}10`, border: `1px solid ${C.crimson}25`, borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <AlertTriangle size={15} color={C.crimson} style={{ flexShrink: 0, marginTop: 2 }} />
                                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65 }}>{result.cardiac_note}</div>
                            </div>
                        )}

                        {/* ML Anomaly */}
                        {result.anomaly_detection?.available && (
                            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 18px' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 8 }}>ML Anomaly Detection</div>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: result.anomaly_detection.is_anomaly ? C.crimson : C.teal }}>{result.anomaly_detection.flag}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>Isolation Forest score: {result.anomaly_detection.score}</div>
                            </div>
                        )}

                        {/* Cluster */}
                        {result.cluster?.available && (
                            <div style={{ background: `${C.lavender}08`, border: `1px solid ${C.lavender}20`, borderRadius: 14, padding: '14px 18px' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 6 }}>Patient Cluster</div>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.lavender }}>{result.cluster.cluster_name}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>Based on KMeans CBC pattern clustering</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
