import React, { useState, useEffect, useRef } from 'react';
import { mlApi } from '../api/ml.api';
import { Activity, AlertTriangle, CheckCircle2, Zap, Radio, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LiveWaveformMonitor() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isAnomalyTriggered, setIsAnomalyTriggered] = useState<boolean>(false);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const runAutoencoder = async (triggerAnomaly = isAnomalyTriggered) => {
        setLoading(true);
        try {
            const res = await mlApi.runDeepAnomalyStream({
                sample_rate_hz: 100,
                trigger_anomaly: triggerAnomaly,
            });
            setResult(res.data.data);
        } catch {
            toast.error('Failed to run Deep Autoencoder Waveform Analysis');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        runAutoencoder();
    }, [isAnomalyTriggered]);

    // Canvas animation loop for ECG signal
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        let step = 0;

        const raw = result?.raw_signal_samples || [];
        const heat = result?.attention_heatmap || [];

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw Grid Lines
            ctx.strokeStyle = 'rgba(13, 92, 126, 0.05)';
            ctx.lineWidth = 1;
            for (let x = 0; x < canvas.width; x += 20) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += 20) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }

            if (raw.length === 0) {
                animId = requestAnimationFrame(render);
                return;
            }

            // Draw ECG Waveform
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = result?.is_anomaly ? 'var(--risk-critical)' : 'var(--risk-low)';
            ctx.shadowBlur = 8;
            ctx.shadowColor = result?.is_anomaly ? 'rgba(209, 63, 74, 0.6)' : 'rgba(24, 155, 130, 0.6)';

            ctx.beginPath();
            const sliceWidth = canvas.width / raw.length;
            let x = 0;

            for (let i = 0; i < raw.length; i++) {
                const val = raw[(i + step) % raw.length];
                const y = (canvas.height / 2) - (val * 45);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Draw Attention Heatmap Bars at bottom
            if (heat.length > 0) {
                const barW = canvas.width / heat.length;
                for (let i = 0; i < heat.length; i++) {
                    const hVal = heat[(i + step) % heat.length];
                    if (hVal > 0.15) {
                        ctx.fillStyle = `rgba(255, 45, 85, ${Math.min(0.8, hVal)})`;
                        ctx.fillRect(i * barW, canvas.height - 8, barW, 8);
                    }
                }
            }

            step = (step + 1) % raw.length;
            animId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animId);
    }, [result]);

    return (
        <div style={{
            background: 'var(--surface-1)',
            border: '1px solid rgba(209, 63, 74, 0.25)',
            borderRadius: 20,
            padding: 24,
            marginBottom: 24,
            fontFamily: 'var(--font-body)',
        }}>
            {/* Title Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(209, 63, 74, 0.2), rgba(18, 121, 163, 0.05))',
                        border: '1px solid rgba(209, 63, 74, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Activity size={22} color="var(--risk-critical)" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                Deep LSTM Autoencoder & Waveform Stream Monitor
                            </h2>
                            <span style={{
                                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 12,
                                background: 'rgba(209, 63, 74, 0.15)', color: 'var(--risk-critical)', border: '1px solid rgba(209, 63, 74, 0.3)'
                            }}>
                                UNIT IV & VI — DEEP AUTOENCODER
                            </span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                            1D-CNN + Deep LSTM Autoencoder tracking real-time reconstruction error ||X - X̂||² & temporal attention heatmaps.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={() => {
                            const next = !isAnomalyTriggered;
                            setIsAnomalyTriggered(next);
                            runAutoencoder(next);
                        }}
                        style={{
                            padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 800,
                            border: 'none', cursor: 'pointer',
                            background: isAnomalyTriggered ? 'var(--risk-critical)' : 'var(--surface-2)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        {isAnomalyTriggered ? '🚨 Stop Arrhythmia Simulation' : '⚡ Simulate Arrhythmia Burst'}
                    </button>

                    <button onClick={() => runAutoencoder()} disabled={loading} className="btn-ghost" style={{ fontSize: 12 }}>
                        <RefreshCw size={14} /> {loading ? 'Analyzing...' : 'Refresh Stream'}
                    </button>
                </div>
            </div>

            {/* Results Header */}
            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                    {/* Reconstruction Loss */}
                    <div style={{
                        background: 'var(--surface-1)', border: `1px solid ${result.is_anomaly ? 'var(--risk-critical)' : 'var(--risk-low)'}40`,
                        borderRadius: 14, padding: 18
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Reconstruction Loss MSE (||X - X̂||²)
                        </div>
                        <div className="font-mono" style={{ fontSize: 30, fontWeight: 900, color: result.is_anomaly ? 'var(--risk-critical)' : 'var(--risk-low)', marginTop: 4 }}>
                            {result.reconstruction_loss_mse}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                            Anomaly Threshold ($\tau$): <strong>{result.threshold_tau}</strong>
                        </div>
                    </div>

                    {/* Classified Rhythm */}
                    <div style={{
                        background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                        borderRadius: 14, padding: 18
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            1D-CNN Classified Rhythm
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                            {result.classified_rhythm}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: result.is_anomaly ? 'var(--risk-critical)' : 'var(--risk-low)', marginTop: 4 }}>
                            Status: {result.severity}
                        </div>
                    </div>

                    {/* Architecture Model */}
                    <div style={{
                        background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                        borderRadius: 14, padding: 18
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Deep Network Architecture
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', marginTop: 6 }}>
                            {result.model_architecture}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                            Signal Samples: <strong>{result.signal_length} points</strong>
                        </div>
                    </div>
                </div>
            )}

            {/* Live HTML5 Canvas Waveform Monitor */}
            <div style={{
                background: 'rgba(13, 45, 62, 0.16)', border: `1px solid ${result?.is_anomaly ? 'rgba(209, 63, 74, 0.5)' : 'rgba(24, 155, 130, 0.3)'}`,
                borderRadius: 14, padding: 16, position: 'relative', overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Radio size={14} color={result?.is_anomaly ? 'var(--risk-critical)' : 'var(--risk-low)'} style={{ animation: 'pulse 1s infinite' }} />
                        REAL-TIME ECG WAVEFORM & TEMPORAL ATTENTION HEATMAP OVERLAY
                    </div>
                    {result?.is_anomaly && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--risk-critical)', background: 'rgba(209, 63, 74, 0.15)', padding: '2px 8px', borderRadius: 8, border: '1px solid rgba(209, 63, 74, 0.3)' }}>
                            🚨 ANOMALOUS SEGMENT HIGHLIGHTED IN RED
                        </span>
                    )}
                </div>

                <canvas ref={canvasRef} width={800} height={160} style={{ width: '100%', height: 160, display: 'block', borderRadius: 8 }} />
            </div>

            {/* Recommendation */}
            {result?.recommendation && (
                <div style={{
                    marginTop: 16, padding: '12px 16px', borderRadius: 10,
                    background: result.is_anomaly ? 'rgba(209, 63, 74, 0.1)' : 'rgba(24, 155, 130, 0.06)',
                    border: `1px solid ${result.is_anomaly ? 'rgba(209, 63, 74, 0.25)' : 'rgba(24, 155, 130, 0.2)'}`,
                    fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10
                }}>
                    <Zap size={16} color={result.is_anomaly ? 'var(--risk-critical)' : 'var(--risk-low)'} />
                    <span><strong>Clinical Recommendation:</strong> {result.recommendation}</span>
                </div>
            )}
        </div>
    );
}
