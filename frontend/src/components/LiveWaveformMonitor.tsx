import React, { useState, useEffect, useRef } from 'react';
import { mlApi } from '../api/ml.api';
import { Activity, Zap, Radio, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

// A canvas 2D context cannot resolve CSS custom properties — `var(--risk-low)`
// as a strokeStyle is silently ignored — so the trace colours are literal
// values mirrored from the palette tokens in index.css.
const TRACE_NORMAL = '#3F8A66';   // --risk-low
const TRACE_FLAGGED = '#C8434B';  // --risk-critical
const GRID = 'rgba(35, 83, 71, 0.08)';

interface ScreenResult {
    detector: string;
    abnormal_probability: number | null;
    decision_threshold: number | null;
    is_anomaly: boolean;
    severity: string;
    classified_pattern: string;
    recommendation: string;
    data_source: string;
    model_architecture: string;
    reconstruction_loss_mse: number;
    reconstruction_flag: boolean;
    raw_signal_samples: number[];
    attention_heatmap: number[];
    model_eval_metrics?: {
        precision?: number; recall?: number; roc_auc?: number; specificity?: number;
        detection_by_class?: Record<string, { n: number; flagged: number }>;
    };
}

const SOURCE_LABEL: Record<string, string> = {
    mitbih_demo_sample: 'Held-out MIT-BIH beat (demo sample)',
    provided_signal: 'Uploaded signal',
};

const pct = (v?: number | null) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);

const label: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
};

export default function LiveWaveformMonitor() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [abnormalSample, setAbnormalSample] = useState(false);
    const [result, setResult] = useState<ScreenResult | null>(null);
    const [loading, setLoading] = useState(false);

    const analyse = async (useAbnormal: boolean) => {
        setLoading(true);
        try {
            const res = await mlApi.runDeepAnomalyStream({ sample_rate_hz: 100, trigger_anomaly: useAbnormal });
            setResult(res.data.data);
        } catch {
            toast.error('ECG screening service is unavailable');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { analyse(abnormalSample); }, [abnormalSample]);

    // Loop the returned beat window across the canvas like a monitor trace.
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const raw = result?.raw_signal_samples ?? [];
        const heat = result?.attention_heatmap ?? [];
        const colour = result?.is_anomaly ? TRACE_FLAGGED : TRACE_NORMAL;
        // Fit the trace to the canvas rather than using a fixed gain, so tall
        // R-peaks are not clipped off the top.
        const peak = raw.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
        const gain = (canvas.height * 0.38) / peak;
        let frame = 0;
        let step = 0;

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = GRID;
            ctx.lineWidth = 1;
            for (let x = 0; x < canvas.width; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
            for (let y = 0; y < canvas.height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

            if (raw.length) {
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = colour;
                ctx.beginPath();
                const w = canvas.width / raw.length;
                for (let i = 0; i < raw.length; i++) {
                    const y = canvas.height / 2 - raw[(i + step) % raw.length] * gain;
                    if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * w, y);
                }
                ctx.stroke();

                const bw = canvas.width / (heat.length || 1);
                for (let i = 0; i < heat.length; i++) {
                    const h = heat[(i + step) % heat.length];
                    if (h > 0.15) {
                        ctx.fillStyle = `rgba(200, 67, 75, ${Math.min(0.8, h)})`;
                        ctx.fillRect(i * bw, canvas.height - 8, bw, 8);
                    }
                }
                step = (step + 1) % raw.length;
            }
            frame = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(frame);
    }, [result]);

    const flagged = !!result?.is_anomaly;
    const tone = flagged ? 'var(--risk-critical-text)' : 'var(--risk-low-text)';
    const m = result?.model_eval_metrics;

    return (
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20, padding: 24, marginBottom: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--surface-3)', border: '1px solid var(--surface-border-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Activity size={22} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>ECG Beat Screening</h2>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: 'var(--accent-glow-sm)', color: 'var(--accent-primary)', border: '1px solid var(--surface-border-md)', letterSpacing: '0.04em' }}>
                                SUPERVISED 1D-CNN · MIT-BIH
                            </span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                            A supervised 1D-CNN scores each beat's morphology as normal or abnormal. An autoencoder's reconstruction error is shown alongside as a secondary, unsupervised signal.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={() => setAbnormalSample(v => !v)}
                        style={{
                            padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer',
                            background: abnormalSample ? 'var(--risk-critical)' : 'var(--surface-3)',
                            color: abnormalSample ? '#fff' : 'var(--text-primary)',
                        }}
                    >
                        {abnormalSample ? 'Showing ventricular ectopic beat — switch to normal' : 'Load a ventricular ectopic beat'}
                    </button>
                    <button onClick={() => analyse(abnormalSample)} disabled={loading} className="btn-ghost" style={{ fontSize: 12 }}>
                        <RefreshCw size={14} /> {loading ? 'Screening…' : 'Next beat'}
                    </button>
                </div>
            </div>

            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
                    {/* Primary: the probability the verdict is based on */}
                    <div style={{ background: 'var(--surface-0)', border: `1px solid ${flagged ? 'var(--risk-critical-border)' : 'var(--surface-border-md)'}`, borderRadius: 14, padding: 18 }}>
                        <div style={label}>Abnormal probability</div>
                        <div className="font-mono" style={{ fontSize: 30, fontWeight: 700, color: tone, marginTop: 4 }}>
                            {pct(result.abnormal_probability)}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                            Review flag at <strong className="font-mono">{pct(result.decision_threshold)}</strong> · threshold set by cross-validation across patients
                        </div>
                    </div>

                    <div style={{ background: 'var(--surface-0)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: 18 }}>
                        <div style={label}>Screening result</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>{result.classified_pattern}</div>
                        <span style={{
                            display: 'inline-block', marginTop: 8, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 9999,
                            background: flagged ? 'var(--risk-critical-bg)' : 'var(--risk-low-bg)', color: tone,
                        }}>
                            {flagged ? 'FLAGGED FOR REVIEW' : 'NO FLAG'}
                        </span>
                    </div>

                    <div style={{ background: 'var(--surface-0)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: 18 }}>
                        <div style={label}>Model &amp; input</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', marginTop: 6, lineHeight: 1.5 }}>
                            {result.model_architecture}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                            {SOURCE_LABEL[result.data_source] ?? result.data_source}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                            Autoencoder (secondary): {result.reconstruction_flag ? 'also flags this beat' : 'no flag'}
                        </div>
                    </div>
                </div>
            )}

            {/* Beat trace */}
            <div style={{ background: 'var(--surface-0)', border: `1px solid ${flagged ? 'var(--risk-critical-border)' : 'var(--surface-border-md)'}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Radio size={14} color={flagged ? TRACE_FLAGGED : TRACE_NORMAL} />
                        BEAT WINDOW · autoencoder reconstruction-error overlay
                    </div>
                    {flagged && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--risk-critical-text)', background: 'var(--risk-critical-bg)', padding: '2px 8px', borderRadius: 8, border: '1px solid var(--risk-critical-border)' }}>
                            Abnormal beat flagged for review
                        </span>
                    )}
                </div>
                <canvas ref={canvasRef} width={800} height={160} style={{ width: '100%', height: 160, display: 'block', borderRadius: 8 }} />
            </div>

            {result?.recommendation && (
                <div style={{
                    marginTop: 16, padding: '12px 16px', borderRadius: 10, fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6,
                    background: flagged ? 'var(--risk-critical-bg)' : 'var(--risk-low-bg)',
                    border: `1px solid ${flagged ? 'var(--risk-critical-border)' : 'rgba(63, 138, 102, 0.25)'}`,
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                    <Zap size={16} color={flagged ? TRACE_FLAGGED : TRACE_NORMAL} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{result.recommendation}</span>
                </div>
            )}

            {m?.recall !== undefined && (
                <p style={{ margin: '14px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {m.detection_by_class ? (
                        <>
                            On 22 patients held out from training (MIT-BIH DS2): catches {pct(m.detection_by_class.V?.flagged)} of
                            ventricular beats and {pct(m.detection_by_class.S?.flagged)} of supraventricular ones, while flagging{' '}
                            {pct(m.detection_by_class.N?.flagged)} of normal beats · ROC-AUC {m.roc_auc?.toFixed(3)}.
                            It sees one beat at a time, so it cannot judge beat timing — which is how supraventricular beats differ.
                        </>
                    ) : (
                        <>On patients held out from training: recall {pct(m.recall)}, precision {pct(m.precision)}, ROC-AUC {m.roc_auc?.toFixed(3)}.</>
                    )}
                    {' '}A screening aid that surfaces beats for review — not a diagnostic test, and it does not identify the arrhythmia type.
                </p>
            )}
        </div>
    );
}
