import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Activity, Heart, Zap, AlertTriangle, ChevronRight } from 'lucide-react';
import { patientApi } from '../api/patient.api';
import { vitalsApi, alertApi } from '../api/index';
import { useVitalsStore } from '../store/vitalsStore';
import { format } from 'date-fns';

const VITALS_CONFIG = [
    { key: 'HR', label: 'Heart Rate', unit: 'bpm', color: 'var(--risk-critical)', criticalLow: 40, criticalHigh: 130, icon: '❤️' },
    { key: 'SpO2', label: 'SpO₂', unit: '%', color: 'var(--accent-primary)', criticalLow: 88, criticalHigh: 101, icon: '🫁' },
    { key: 'SBP', label: 'Systolic BP', unit: 'mmHg', color: 'var(--vitals-bp)', criticalLow: 70, criticalHigh: 180, icon: '🩸' },
    { key: 'Temp', label: 'Temperature', unit: '°C', color: 'var(--vitals-temp)', criticalLow: 35, criticalHigh: 39.5, icon: '🌡️' },
];

export default function VitalsMonitorPage() {
    const [patients, setPatients] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { latestVitals, vitals } = useVitalsStore();

    useEffect(() => {
        const load = async () => {
            try {
                const [patRes, alertRes] = await Promise.all([
                    patientApi.getHighRisk(),
                    alertApi.list({ type: 'VITALS_ANOMALY', resolved: 'false', limit: '20' }),
                ]);
                const pts = patRes.data.data?.slice(0, 12) || [];
                setPatients(pts);
                setAlerts(alertRes.data.data || []);
                if (pts.length > 0) {
                    setSelectedId(pts[0].id);
                    const vRes = await vitalsApi.getForPatient(pts[0].id, { range: '6h' });
                    const history = vRes.data.data || [];
                    useVitalsStore.getState().setVitalsHistory(pts[0].id, history.map((v: any) => ({
                        patientId: pts[0].id,
                        heartRate: v.heartRate, oxygenSaturation: v.oxygenSaturation,
                        systolicBP: v.systolicBP, diastolicBP: v.diastolicBP, temperature: v.temperature,
                        timestamp: new Date(v.recordedAt),
                    })));
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    const selectedVitals = selectedId ? vitals[selectedId] || [] : [];
    const latestForSelected = selectedId ? latestVitals[selectedId] : null;
    const selectedPatient = patients.find(p => p.id === selectedId);

    const chartData = selectedVitals.slice(-60).map(v => ({
        time: format(new Date(v.timestamp), 'HH:mm'),
        HR: v.heartRate, SpO2: v.oxygenSaturation, SBP: v.systolicBP,
        Temp: v.temperature ? parseFloat(v.temperature.toFixed(1)) : null,
    }));

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
                <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    border: '3px solid rgba(13, 92, 126, 0.15)',
                    borderTopColor: 'var(--accent-primary)',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <div style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                    Connecting to vitals stream...
                </div>
            </div>
        );
    }

    return (
        <div className="page-enter">
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Activity size={22} color="var(--accent-primary)" />
                    <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                        Live Vitals Monitor
                    </h1>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                        background: 'rgba(24, 155, 130, 0.08)', borderRadius: 9999,
                        border: '1px solid rgba(24, 155, 130, 0.20)',
                        fontSize: 11, fontWeight: 700, color: 'var(--accent-green)', marginLeft: 4,
                    }}>
                        <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)' }} />
                        STREAMING
                    </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                    Real-time vitals monitoring for high-risk patients
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
                {/* Patient list */}
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{
                        padding: '12px 16px', borderBottom: '1px solid var(--surface-border)',
                        fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        background: 'var(--surface-1)',
                    }}>
                        High-Risk Patients
                    </div>
                    {patients.map(p => {
                        const latest = latestVitals[p.id];
                        const isSelected = selectedId === p.id;
                        const isAnomaly = latest?.isAnomaly;
                        return (
                            <div
                                key={p.id}
                                onClick={() => setSelectedId(p.id)}
                                style={{
                                    padding: '12px 14px', cursor: 'pointer',
                                    borderBottom: '1px solid var(--surface-border)',
                                    background: isSelected ? 'rgba(13, 92, 126, 0.06)' : 'transparent',
                                    borderLeft: `3px solid ${isSelected ? 'var(--accent-primary)' : 'transparent'}`,
                                    transition: 'all 0.15s',
                                    position: 'relative',
                                }}
                            >
                                {/* Anomaly indicator */}
                                {isAnomaly && (
                                    <div style={{
                                        position: 'absolute', top: 8, right: 10,
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: 'var(--risk-critical)',
                                    }} className="pulse-critical" />
                                )}
                                <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)', marginBottom: 2 }}>
                                    {p.firstName} {p.lastName}
                                </div>
                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 5, fontFamily: 'var(--font-mono)' }}>
                                    {p.patientCode}
                                </div>
                                <span className={`risk-badge ${p.currentRiskLevel?.toLowerCase()}`} style={{ fontSize: 9.5 }}>
                                    {p.currentRiskLevel}
                                </span>
                                {latest && (
                                    <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                                        ❤️ {latest.heartRate?.toFixed(0)} bpm<br />
                                        🫁 {latest.oxygenSaturation?.toFixed(1)}%
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {patients.length === 0 && (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                            No high-risk patients
                        </div>
                    )}
                </div>

                {/* Charts panel */}
                <div>
                    {/* Selected patient header */}
                    {selectedPatient && (
                        <div style={{
                            background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                            borderRadius: 14, padding: '14px 18px', marginBottom: 14,
                            display: 'flex', alignItems: 'center', gap: 14,
                        }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 12,
                                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: 14, color: 'var(--bg-primary)', flexShrink: 0,
                            }}>
                                {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {selectedPatient.firstName} {selectedPatient.lastName}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                    {selectedPatient.patientCode}
                                </div>
                            </div>
                            <span className={`risk-badge ${selectedPatient.currentRiskLevel?.toLowerCase()}`} style={{ marginLeft: 'auto' }}>
                                {selectedPatient.currentRiskLevel}
                            </span>
                            {latestForSelected?.isAnomaly && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                                    background: 'rgba(209, 63, 74, 0.10)', borderRadius: 9999,
                                    border: '1px solid rgba(209, 63, 74, 0.25)', fontSize: 11, fontWeight: 700, color: 'var(--risk-critical)',
                                }} className="pulse-critical">
                                    <AlertTriangle size={12} /> ANOMALY DETECTED
                                </div>
                            )}
                        </div>
                    )}

                    {/* Vitals value cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                        {VITALS_CONFIG.map(vc => {
                            const val = latestForSelected
                                ? vc.key === 'HR' ? latestForSelected.heartRate
                                    : vc.key === 'SpO2' ? latestForSelected.oxygenSaturation
                                        : vc.key === 'SBP' ? latestForSelected.systolicBP
                                            : latestForSelected.temperature
                                : null;
                            const isCritical = val !== null && val !== undefined && (val <= vc.criticalLow || val >= vc.criticalHigh);
                            return (
                                <div key={vc.key} className={`vitals-card ${isCritical ? 'critical' : ''}`} style={{
                                    borderColor: isCritical ? vc.color : 'var(--surface-border)',
                                    boxShadow: isCritical ? `0 0 20px ${vc.color}30` : undefined,
                                }}>
                                    <div style={{ fontSize: 20, marginBottom: 8 }}>{vc.icon}</div>
                                    <div className="font-mono" style={{
                                        fontSize: 28, fontWeight: 700, lineHeight: 1,
                                        color: isCritical ? vc.color : 'var(--text-primary)',
                                        letterSpacing: '-0.02em',
                                    }}>
                                        {val !== null && val !== undefined ? parseFloat(val.toFixed(1)) : '—'}
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3, fontWeight: 400 }}>
                                            {vc.unit}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{vc.label}</div>
                                    {isCritical && (
                                        <div style={{
                                            fontSize: 9.5, color: vc.color, fontWeight: 800, marginTop: 4,
                                            letterSpacing: '0.06em',
                                        }}>⚠ CRITICAL</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Time-series charts */}
                    {VITALS_CONFIG.map(vc => (
                        <div key={vc.key} style={{
                            background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                            borderRadius: 14, padding: '14px 18px', marginBottom: 10,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span>{vc.icon}</span>
                                    <span>{vc.label}</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                    {chartData.length} readings
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={75}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--text-muted)" vertical={false} />
                                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 4)} />
                                    <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={26} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border-md)', borderRadius: 10, fontSize: 11 }}
                                    />
                                    <Line type="monotone" dataKey={vc.key} stroke={vc.color} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ))}
                </div>
            </div>

            {/* Alerts section */}
            {alerts.length > 0 && (
                <div style={{
                    background: 'var(--surface-1)', border: '1px solid rgba(209, 63, 74, 0.20)',
                    borderRadius: 18, padding: '22px 24px', marginTop: 24,
                }}>
                    <div style={{ position: 'relative', top: 0, left: 0, right: 0, height: 2, background: 'var(--risk-critical)', borderRadius: '18px 18px 0 0', opacity: 0.6 }} />
                    <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--risk-critical)' }}>
                        <AlertTriangle size={16} /> Recent Vitals Anomaly Alerts
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {alerts.slice(0, 8).map((a: any) => (
                            <div key={a.id} style={{
                                display: 'flex', gap: 14, alignItems: 'center',
                                padding: '10px 14px', borderRadius: 10,
                                background: 'var(--surface-1)',
                                border: '1px solid var(--surface-border)',
                            }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                    background: a.severity === 'CRITICAL' ? 'var(--risk-critical)' : 'var(--risk-medium)',
                                    ...(a.severity === 'CRITICAL' ? { boxShadow: '0 0 8px rgba(209, 63, 74, 0.6)' } : {}),
                                }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: a.severity === 'CRITICAL' ? 'var(--risk-critical)' : 'var(--risk-medium)' }}>
                                    [{a.severity}]
                                </span>
                                <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 600 }}>
                                    {a.patient?.firstName} {a.patient?.lastName}:
                                </span>
                                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1 }}>{a.message}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                                    {format(new Date(a.createdAt), 'HH:mm')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
