import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import {
    ArrowLeft, Brain, Download, Bell, RefreshCw, Calendar,
    Upload, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, X, Clock
} from 'lucide-react';
import { patientApi } from '../api/patient.api';
import { vitalsApi, reportApi } from '../api/index';
import api from '../api/axiosInstance';
import { useVitalsStore } from '../store/vitalsStore';
import { useSocket } from '../hooks/useSocket';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// ─── Lab reference ranges ────────────────────────────────────────────────────
const LAB_REFS: Record<string, { min: number; max: number; unit: string; name: string }> = {
    hemoglobin: { min: 12.0, max: 17.5, unit: 'g/dL', name: 'Hemoglobin' },
    hb: { min: 12.0, max: 17.5, unit: 'g/dL', name: 'Hemoglobin' },
    wbc: { min: 4.0, max: 11.0, unit: 'K/µL', name: 'WBC' },
    platelet: { min: 150, max: 400, unit: 'K/µL', name: 'Platelets' },
    glucose: { min: 70, max: 100, unit: 'mg/dL', name: 'Glucose' },
    creatinine: { min: 0.6, max: 1.2, unit: 'mg/dL', name: 'Creatinine' },
    sodium: { min: 136, max: 145, unit: 'mEq/L', name: 'Sodium' },
    potassium: { min: 3.5, max: 5.0, unit: 'mEq/L', name: 'Potassium' },
    alt: { min: 7, max: 40, unit: 'U/L', name: 'ALT' },
    ast: { min: 10, max: 40, unit: 'U/L', name: 'AST' },
    cholesterol: { min: 0, max: 200, unit: 'mg/dL', name: 'Cholesterol' },
    tsh: { min: 0.4, max: 4.0, unit: 'mIU/L', name: 'TSH' },
    hba1c: { min: 0, max: 5.7, unit: '%', name: 'HbA1c' },
    triglycerides: { min: 0, max: 150, unit: 'mg/dL', name: 'Triglycerides' },
    bilirubin: { min: 0.2, max: 1.2, unit: 'mg/dL', name: 'Bilirubin' },
    urea: { min: 7, max: 25, unit: 'mg/dL', name: 'Blood Urea' },
    hdl: { min: 40, max: 999, unit: 'mg/dL', name: 'HDL' },
    ldl: { min: 0, max: 130, unit: 'mg/dL', name: 'LDL' },
};

interface LabFinding {
    name: string; value: number; unit: string;
    min: number; max: number; status: 'LOW' | 'HIGH' | 'NORMAL'; deviation: number;
}

function parseLabText(text: string): LabFinding[] {
    const findings: LabFinding[] = [];
    for (const line of text.toLowerCase().split('\n')) {
        for (const [key, ref] of Object.entries(LAB_REFS)) {
            if (!line.includes(key)) continue;
            const nums = line.match(/[\d]+\.?[\d]*/g);
            if (!nums) continue;
            const val = parseFloat(nums[0]);
            if (isNaN(val) || val === 0) continue;
            let status: 'LOW' | 'HIGH' | 'NORMAL' = 'NORMAL', deviation = 0;
            if (val < ref.min) { status = 'LOW'; deviation = ((ref.min - val) / ref.min) * 100; }
            else if (val > ref.max && ref.max < 9000) { status = 'HIGH'; deviation = ((val - ref.max) / ref.max) * 100; }
            if (!findings.find(f => f.name === ref.name))
                findings.push({ name: ref.name, value: val, unit: ref.unit, min: ref.min, max: ref.max, status, deviation });
        }
    }
    return findings;
}

const SAMPLE_LAB = `Hemoglobin: 8.2 g/dL\nWBC: 14.5 K/µL\nGlucose: 240 mg/dL\nCreatinine: 2.1 mg/dL\nSodium: 128 mEq/L\nHbA1c: 9.5 %\nCholesterol: 270 mg/dL`;

interface SavedReport { id: string; date: string; text: string; findings: LabFinding[]; }

import { useAuthStore } from '../store/authStore';

import { tint } from '../utils/tint';
// ... (inside PatientDetailPage)
export default function PatientDetailPage() {
    const { user } = useAuthStore();
    const isReceptionist = user?.role === 'RECEPTIONIST';
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [patient, setPatient] = useState<any>(null);
    const [prediction, setPrediction] = useState<any>(null);
    const [predicting, setPredicting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'ml' | 'vitals' | 'reports'>('overview');

    // Reports tab state
    const [reportText, setReportText] = useState('');
    const [reportFindings, setReportFindings] = useState<LabFinding[]>([]);
    const [reportAnalyzed, setReportAnalyzed] = useState(false);
    const [reportAnalyzing, setReportAnalyzing] = useState(false);
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [showNormal, setShowNormal] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const { vitals, latestVitals } = useVitalsStore();
    const { joinPatientRoom, leavePatientRoom } = useSocket();

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                const [patientRes, vitalsRes] = await Promise.all([
                    patientApi.getById(id),
                    vitalsApi.getForPatient(id, { range: '6h' }),
                ]);
                setPatient(patientRes.data.data);
                const vitalsData = vitalsRes.data.data || [];
                useVitalsStore.getState().setVitalsHistory(id, vitalsData.map((v: any) => ({
                    patientId: id, heartRate: v.heartRate, oxygenSaturation: v.oxygenSaturation,
                    systolicBP: v.systolicBP, diastolicBP: v.diastolicBP,
                    temperature: v.temperature, timestamp: new Date(v.recordedAt),
                })));
            } catch { toast.error('Failed to load patient'); }
            finally { setLoading(false); }
        };
        load();
        joinPatientRoom(id);
        return () => { leavePatientRoom(id); };
    }, [id]);

    const openAITools = () => navigate('/ai-tools');

    const runPrediction = async () => {
        if (!id || !patient) return;
        setPredicting(true);
        try {
            const patientAge = Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600000));
            const latestV = latestVitals[id];
            const payload = {
                patientId: id,
                age: patientAge,
                sex: patient.gender === 'MALE' ? 'Male' : 'Female',
                chest_pain_type: 'Asymptomatic',
                resting_blood_pressure: latestV?.systolicBP || 120,
                cholestoral: 200,
                fasting_blood_sugar: patient.hasDiabetes ? 'Greater than 120 mg/ml' : 'Lower than 120 mg/ml',
                rest_ecg: 'Normal',
                Max_heart_rate: latestV?.heartRate || 150,
                exercise_induced_angina: patient.hasHeartDisease ? 'Yes' : 'No',
                oldpeak: 0,
                slope: 'Flat',
                vessels_colored_by_flourosopy: 'Zero',
                thalassemia: 'Normal',
            };
            await api.post('/ml/predict-risk', payload);
            const savedRes = await api.get(`/ml/predictions/${id}`);
            setPrediction(savedRes.data.data?.[0] || null);
            toast.success('AI prediction complete');
        } catch {
            toast.error('Failed to run prediction');
        } finally {
            setPredicting(false);
        }
    };

    const downloadReport = async () => {
        if (!id || !patient) return;
        try {
            const res = await reportApi.generatePatientPDF(id);
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url; a.download = `${patient.patientCode}-report.pdf`; a.click();
            URL.revokeObjectURL(url);
        } catch { toast.error('Failed to generate report'); }
    };

    const analyzeReport = () => {
        if (!reportText.trim()) { toast.error('Paste a lab report first'); return; }
        setReportAnalyzing(true);
        setTimeout(() => {
            const findings = parseLabText(reportText);
            setReportFindings(findings);
            setReportAnalyzed(true);
            setReportAnalyzing(false);
            if (findings.length === 0) { toast.error('No recognizable lab values found'); return; }
            setSavedReports(prev => [{ id: Date.now().toString(), date: new Date().toISOString(), text: reportText, findings }, ...prev]);
            toast.success(`AI analyzed ${findings.length} parameters`);
        }, 1000);
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--surface-border)', borderTopColor: 'var(--accent-primary)', animation: 'spin 0.8s linear infinite' }} />
        </div>
    );
    if (!patient) return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Patient not found</div>;

    const latest = latestVitals[id!];
    const vitalsHistory = vitals[id!] || [];
    const chartData = vitalsHistory.slice(-40).map(v => ({
        time: format(new Date(v.timestamp), 'HH:mm'),
        HR: v.heartRate, SpO2: v.oxygenSaturation, SBP: v.systolicBP,
        Temp: v.temperature ? parseFloat(v.temperature.toFixed(1)) : null,
    }));

    const age = Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600000));
    const pred = prediction || patient.mlPredictions?.[0];
    const latestRec = patient.careRecommendations?.[0];
    const comorbidities = [
        patient.hasDiabetes && 'Diabetes', patient.hasHypertension && 'Hypertension',
        patient.hasHeartDisease && 'Heart Disease', patient.hasCKD && 'CKD',
        patient.hasAsthma && 'Asthma', patient.hasCOPD && 'COPD',
        patient.hasObesity && 'Obesity', patient.hasCancer && 'Cancer',
    ].filter(Boolean);

    // Reports computed
    const abnormal = reportFindings.filter(f => f.status !== 'NORMAL');
    const normalFindings = reportFindings.filter(f => f.status === 'NORMAL');
    const criticalCount = abnormal.filter(f => f.deviation > 40).length;
    const riskColor = criticalCount > 0 ? 'var(--risk-critical)' : abnormal.length > 1 ? 'var(--risk-high)' : abnormal.length > 0 ? 'var(--risk-medium)' : 'var(--risk-low)';
    const riskLabel = criticalCount > 0 ? 'CRITICAL' : abnormal.length > 1 ? 'HIGH RISK' : abnormal.length > 0 ? 'MONITOR' : 'NORMAL';

    return (
        <div>
            {/* Back + Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Link to="/patients" className="btn-ghost" style={{ textDecoration: 'none' }}>
                    <ArrowLeft size={16} /> Patients
                </Link>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={() => navigate(`/appointments?new=1&patientId=${id}`)}
                        className="btn-ghost"
                        style={{ color: 'var(--accent-primary)', borderColor: 'rgba(35, 83, 71, 0.2)', background: 'rgba(35, 83, 71, 0.04)' }}
                    >
                        <Calendar size={15} /> Book Appointment
                    </button>
                    {!isReceptionist && (
                        <button onClick={runPrediction} disabled={predicting} className="btn-primary">
                            {predicting ? <><RefreshCw size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Running...</> : <><Brain size={15} /> Run ML Prediction</>}
                        </button>
                    )}
                    <button onClick={downloadReport} className="btn-ghost"><Download size={15} /> Report</button>
                </div>
            </div>

            {/* Patient Header Card */}
            <div style={{
                background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                borderRadius: 16, padding: '24px 28px', marginBottom: 20,
                display: 'flex', gap: 20, alignItems: 'center',
            }}>
                <div style={{
                    width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg, ${patient.currentRiskLevel === 'CRITICAL' ? 'var(--risk-critical)' : patient.currentRiskLevel === 'HIGH' ? 'var(--risk-high)' : 'var(--accent-primary)'}, var(--accent-secondary))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 700, color: 'white',
                }}>
                    {patient.firstName[0]}{patient.lastName[0]}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                            {patient.firstName} {patient.lastName}
                        </h1>
                        <span className={`risk-badge ${patient.currentRiskLevel?.toLowerCase()}`}>
                            {patient.currentRiskLevel}
                        </span>
                        {patient.alerts?.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--risk-critical-text)', fontSize: 12, fontWeight: 600 }}>
                                <Bell size={13} /> {patient.alerts.length} Alert{patient.alerts.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                        <span className="font-mono">{patient.patientCode}</span>
                        {' · '}{age} years · {patient.gender}
                        {patient.bloodGroup && <> · {patient.bloodGroup.replace('_', '')}</>}
                        {patient.bmi && <> · BMI {patient.bmi}</>}
                        {patient.contactInfo?.phone && <> · 📞 {patient.contactInfo.phone}</>}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {comorbidities.map((c: any) => (
                            <span key={c} style={{
                                fontSize: 11, padding: '2px 10px', borderRadius: 9999,
                                background: 'var(--surface-2)', color: 'var(--text-secondary)',
                                border: '1px solid var(--surface-border)',
                            }}>{c}</span>
                        ))}
                        {comorbidities.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No comorbidities on record</span>}
                    </div>
                </div>
                {!isReceptionist && (
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div className="font-mono" style={{
                            fontSize: 40, fontWeight: 700,
                            color: patient.riskScore > 70 ? 'var(--risk-critical)' : patient.riskScore > 50 ? 'var(--risk-high)' : 'var(--risk-low)',
                        }}>
                            {patient.riskScore?.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            🤖 AI Risk Score
                        </div>
                    </div>
                )}
            </div>

            {/* Tab bar */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 20,
                background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                borderRadius: 12, padding: 4,
            }}>
                {(
                    isReceptionist
                        ? [
                            ['overview', '📊 Overview'],
                            ['vitals', '⚡ Vitals Chart'],
                            ['reports', '🧪 Lab Reports'],
                        ]
                        : [
                            ['overview', '📊 Overview'],
                            ['ml', '🤖 ML Models'],
                            ['vitals', '⚡ Vitals Chart'],
                            ['reports', '🧪 Lab Reports'],
                        ]
                ).map(([tab, label]) => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} style={{
                        flex: 1, padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                        background: activeTab === tab ? 'rgba(35, 83, 71, 0.10)' : 'transparent',
                        color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
                        boxShadow: activeTab === tab ? 'inset 0 0 0 1px rgba(35, 83, 71, 0.20)' : 'none',
                    }}>
                        {label}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* Live vitals */}
                        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: '20px 24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600 }}>⚡ Live Vitals</h3>
                                {latest && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Updated {format(new Date(latest.timestamp), 'HH:mm:ss')}</span>}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                {[
                                    { label: 'Heart Rate', value: latest?.heartRate?.toFixed(0), unit: 'bpm', color: 'var(--vitals-heart)', icon: '❤️' },
                                    { label: 'SpO₂', value: latest?.oxygenSaturation?.toFixed(1), unit: '%', color: 'var(--vitals-oxygen)', icon: '🫁' },
                                    { label: 'Blood Pressure', value: latest ? `${latest.systolicBP?.toFixed(0)}/${latest.diastolicBP?.toFixed(0)}` : '—', unit: 'mmHg', color: 'var(--vitals-bp)', icon: '🔴' },
                                    { label: 'Temperature', value: latest?.temperature?.toFixed(1), unit: '°C', color: 'var(--vitals-temp)', icon: '🌡️' },
                                ].map(v => (
                                    <div key={v.label} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 16 }}>{v.icon}</div>
                                        <div className="font-mono" style={{ fontSize: 19, fontWeight: 700, color: v.color, marginTop: 4 }}>
                                            {v.value || '—'} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.unit}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{v.label}</div>
                                    </div>
                                ))}
                            </div>
                            {chartData.length > 0 && (
                                <ResponsiveContainer width="100%" height={110}>
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                                        <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 4)} />
                                        <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={28} />
                                        <Tooltip contentStyle={{ background: 'var(--surface-2)', border: 'none', borderRadius: 8, color: 'var(--text-primary)', fontSize: 11 }} />
                                        <Line type="monotone" dataKey="HR" stroke="var(--vitals-heart)" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="SpO2" stroke="var(--vitals-oxygen)" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* 3 ML Model Panels */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Risk Classification */}
                            <div style={{ background: 'var(--surface-1)', border: pred ? '1px solid rgba(35, 83, 71, 0.18)' : '1px solid var(--surface-border)', borderRadius: 16, padding: '18px 22px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: pred ? 14 : 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(35, 83, 71, 0.1)', border: '1px solid rgba(35, 83, 71, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Brain size={16} color="var(--accent-primary)" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Risk Classification</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>RandomForest · Predicts risk level</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {pred && (
                                            <div style={{ textAlign: 'right' }}>
                                                <span className={`risk-badge ${(pred.predictedRiskLevel || '').toLowerCase()}`}>{pred.predictedRiskLevel}</span>
                                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>Confidence: {((pred.riskConfidence || 0) * 100).toFixed(1)}%</div>
                                            </div>
                                        )}
                                        <button onClick={runPrediction} disabled={predicting} className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px', color: 'var(--accent-primary)', borderColor: 'rgba(35, 83, 71, 0.2)' }}>
                                            {predicting ? <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Brain size={13} />}
                                            {predicting ? 'Running...' : pred ? 'Re-run' : 'Run Now'}
                                        </button>
                                    </div>
                                </div>
                                {pred && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                                        {[['CRITICAL', pred.riskProbabilityCritical || 0], ['HIGH', pred.riskProbabilityHigh || 0], ['MEDIUM', pred.riskProbabilityMedium || 0], ['LOW', pred.riskProbabilityLow || 0]].map(([level, prob]: any) => {
                                            const colors: Record<string, string> = { CRITICAL: 'var(--risk-critical)', HIGH: 'var(--risk-high)', MEDIUM: 'var(--risk-medium)', LOW: 'var(--risk-low)' };
                                            const c = colors[level];
                                            return (
                                                <div key={level} style={{ background: `${tint(c, '08')}`, border: `1px solid ${tint(c, '20')}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 5 }}>{level}</div>
                                                    <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, marginBottom: 6 }}>
                                                        <div style={{ height: '100%', borderRadius: 2, width: `${prob * 100}%`, background: c, transition: 'width 0.5s ease' }} />
                                                    </div>
                                                    <div className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: c }}>{(prob * 100).toFixed(1)}%</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {!pred && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>No prediction yet — click Run Now to classify risk</div>}
                            </div>

                            {/* LOS Predictor */}
                            <div style={{ background: 'var(--surface-1)', border: pred ? '1px solid rgba(142, 182, 155, 0.18)' : '1px solid var(--surface-border)', borderRadius: 16, padding: '18px 22px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(142, 182, 155, 0.1)', border: '1px solid rgba(142, 182, 155, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Clock size={16} color="var(--accent-magenta)" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>LOS Predictor</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>GradientBoosting · Predicts length of stay</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {pred?.predictedLengthOfStay != null && (
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-magenta)' }}>
                                                    {pred.predictedLengthOfStay.toFixed(1)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
                                                </div>
                                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Predicted hospital stay</div>
                                            </div>
                                        )}
                                        <button onClick={runPrediction} disabled={predicting} className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px', color: 'var(--accent-magenta)', borderColor: 'rgba(142, 182, 155, 0.2)' }}>
                                            {predicting ? <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Brain size={13} />}
                                            {predicting ? 'Running...' : pred ? 'Re-run' : 'Run Now'}
                                        </button>
                                    </div>
                                </div>
                                {pred?.predictedLengthOfStay != null && (
                                    <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        {[['Risk Level', pred.predictedRiskLevel || '—', 'var(--text-muted)'], ['BMI Factor', patient.bmi ? `${patient.bmi}` : '—', 'var(--accent-primary)'], ['Comorbidities', comorbidities.length.toString(), 'var(--risk-high)'], ['Age Factor', `${age} yrs`, 'var(--risk-medium)']].map(([label, val, color]: any) => (
                                            <div key={label} style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '8px 14px', flex: 1 }}>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{val}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {!pred && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Run prediction to estimate hospital stay duration</div>}
                            </div>

                            {/* Readmission Model */}
                            <div style={{ background: 'var(--surface-1)', border: pred ? '1px solid rgba(63, 138, 102, 0.18)' : '1px solid var(--surface-border)', borderRadius: 16, padding: '18px 22px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(63, 138, 102, 0.1)', border: '1px solid rgba(63, 138, 102, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <RefreshCw size={16} color="var(--accent-green-text)" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Readmission Risk</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>LogisticRegression · 30-day readmission probability</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {pred?.readmissionProbability != null && (
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: pred.readmissionRisk ? 'var(--risk-critical)' : 'var(--accent-green)' }}>
                                                    {((pred.readmissionProbability) * 100).toFixed(1)}%
                                                </div>
                                                <div style={{ fontSize: 10.5, color: pred.readmissionRisk ? 'var(--risk-critical)' : 'var(--text-muted)', fontWeight: pred.readmissionRisk ? 700 : 400 }}>
                                                    {pred.readmissionRisk ? '⚠️ High readmission risk' : '✅ Low readmission risk'}
                                                </div>
                                            </div>
                                        )}
                                        <button onClick={runPrediction} disabled={predicting} className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px', color: 'var(--accent-green-text)', borderColor: 'rgba(63, 138, 102, 0.2)' }}>
                                            {predicting ? <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Brain size={13} />}
                                            {predicting ? 'Running...' : pred ? 'Re-run' : 'Run Now'}
                                        </button>
                                    </div>
                                </div>
                                {pred?.readmissionProbability != null && (
                                    <div style={{ marginTop: 14 }}>
                                        <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 4, width: `${(pred.readmissionProbability) * 100}%`, background: `linear-gradient(90deg, var(--accent-green), ${pred.readmissionRisk ? 'var(--risk-critical)' : 'var(--accent-green)'})`, transition: 'width 0.8s ease' }} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                                            <span>0% (No Risk)</span><span>50%</span><span>100% (Certain)</span>
                                        </div>
                                    </div>
                                )}
                                {!pred && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Run prediction to assess 30-day readmission probability</div>}
                            </div>
                        </div>

                    </div>

                    {/* Care Recommendations */}
                    {latestRec?.items?.length > 0 && (
                        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: '20px 24px' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>💡 AI Care Recommendations</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                {latestRec.items.slice(0, 4).map((rec: any) => {
                                    const clr: Record<string, string> = { URGENT: 'var(--risk-critical)', HIGH: 'var(--risk-high)', MEDIUM: 'var(--risk-medium)', LOW: 'var(--risk-low)' };
                                    const color = clr[rec.priority] || 'var(--text-secondary)';
                                    return (
                                        <div key={rec.id} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${color}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{rec.title}</div>
                                                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, fontWeight: 700, background: `${tint(color, '18')}`, color, marginLeft: 8, flexShrink: 0 }}>{rec.priority}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{rec.description}</div>
                                            {rec.specialistType && <div style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600 }}>👨‍⚕️ {rec.specialistType}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Active Alerts */}
                    {patient.alerts?.length > 0 && (
                        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(200, 67, 75, 0.3)', borderRadius: 16, padding: '20px 24px' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--risk-critical-text)', marginBottom: 12 }}>🚨 Active Alerts</h3>
                            {patient.alerts.map((a: any) => (
                                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(200, 67, 75, 0.05)', borderRadius: 8, marginBottom: 8 }}>
                                    <div>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--risk-critical-text)' }}>[{a.severity}] {a.type}</span>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{a.message}</div>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 12 }}>
                                        {format(new Date(a.createdAt), 'HH:mm')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── ML MODELS TAB ─────────────────────────────────────────────── */}
            {activeTab === 'ml' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>🤖 ML Prediction Models</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>3 independent AI models — each analyzes this patient's clinical data</p>
                        </div>
                        <button onClick={runPrediction} disabled={predicting} className="btn-primary">
                            {predicting ? <><RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Running all models...</> : <><Brain size={14} /> Run All 3 Models</>}
                        </button>
                    </div>

                    {/* Risk Classification */}
                    <div style={{ background: 'var(--surface-1)', border: pred ? '1px solid rgba(35, 83, 71, 0.25)' : '1px solid var(--surface-border)', borderRadius: 18, padding: '22px 26px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: pred ? 20 : 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(35, 83, 71, 0.1)', border: '1px solid rgba(35, 83, 71, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Brain size={20} color="var(--accent-primary)" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Risk Classification</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Model: RandomForestClassifier · Classifies patient into CRITICAL / HIGH / MEDIUM / LOW risk</div>
                                </div>
                            </div>
                            {pred && <span className={`risk-badge ${(pred.predictedRiskLevel || '').toLowerCase()}`} style={{ fontSize: 13 }}>{pred.predictedRiskLevel}</span>}
                        </div>
                        {pred && (
                            <>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Confidence: <strong style={{ color: 'var(--accent-primary)' }}>{((pred.riskConfidence || 0) * 100).toFixed(1)}%</strong> · Based on: age, BMI, comorbidities, blood sugar, blood pressure, creatinine, smoking status</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                                    {[['CRITICAL', pred.riskProbabilityCritical || 0, 'var(--risk-critical)'], ['HIGH', pred.riskProbabilityHigh || 0, 'var(--risk-high)'], ['MEDIUM', pred.riskProbabilityMedium || 0, 'var(--risk-medium)'], ['LOW', pred.riskProbabilityLow || 0, 'var(--risk-low)']].map(([level, prob, c]: any) => (
                                        <div key={level} style={{ background: `${tint(c, '08')}`, border: `1px solid ${tint(c, '20')}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>{level}</div>
                                            <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 3, marginBottom: 10 }}>
                                                <div style={{ height: '100%', borderRadius: 3, width: `${prob * 100}%`, background: c, transition: 'width 0.6s ease' }} />
                                            </div>
                                            <div className="font-mono" style={{ fontSize: 18, fontWeight: 800, color: c }}>{(prob * 100).toFixed(1)}%</div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        {!pred && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, padding: '20px 0', textAlign: 'center' }}>No prediction yet — click "Run All 3 Models" above</div>}
                    </div>

                    {/* LOS Predictor */}
                    <div style={{ background: 'var(--surface-1)', border: pred ? '1px solid rgba(142, 182, 155, 0.25)' : '1px solid var(--surface-border)', borderRadius: 18, padding: '22px 26px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(142, 182, 155, 0.1)', border: '1px solid rgba(142, 182, 155, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Clock size={20} color="var(--accent-magenta)" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>LOS Predictor</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Model: GradientBoostingRegressor · Predicts hospital length of stay in days</div>
                                </div>
                            </div>
                            {pred?.predictedLengthOfStay != null && (
                                <div style={{ textAlign: 'right' }}>
                                    <div className="font-mono" style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-magenta)' }}>{pred.predictedLengthOfStay.toFixed(1)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>days</span></div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Predicted hospital stay</div>
                                </div>
                            )}
                        </div>
                        {pred?.predictedLengthOfStay != null && (
                            <div style={{ marginTop: 18 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Key factors influencing LOS estimate:</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                                    {[['Risk Level', pred.predictedRiskLevel || '—', 'var(--text-muted)'], ['BMI', patient.bmi ? `${patient.bmi}` : '—', 'var(--accent-primary)'], ['Comorbidities', comorbidities.length.toString(), 'var(--risk-high)'], ['Age', `${age} yrs`, 'var(--risk-medium)']].map(([label, val, color]: any) => (
                                        <div key={label} style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '10px 14px' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{val}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!pred && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, padding: '20px 0', textAlign: 'center' }}>Run predictions to see estimated hospital length of stay</div>}
                    </div>

                    {/* Readmission Model */}
                    <div style={{ background: 'var(--surface-1)', border: pred ? '1px solid rgba(63, 138, 102, 0.25)' : '1px solid var(--surface-border)', borderRadius: 18, padding: '22px 26px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(63, 138, 102, 0.1)', border: '1px solid rgba(63, 138, 102, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <RefreshCw size={20} color="var(--accent-green-text)" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Readmission Risk</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Model: LogisticRegression · Probability of re-hospitalization within 30 days of discharge</div>
                                </div>
                            </div>
                            {pred?.readmissionProbability != null && (
                                <div style={{ textAlign: 'right' }}>
                                    <div className="font-mono" style={{ fontSize: 28, fontWeight: 800, color: pred.readmissionRisk ? 'var(--risk-critical)' : 'var(--accent-green)' }}>
                                        {((pred.readmissionProbability) * 100).toFixed(1)}%
                                    </div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: pred.readmissionRisk ? 'var(--risk-critical)' : 'var(--accent-green)' }}>
                                        {pred.readmissionRisk ? '⚠️ High readmission risk' : '✅ Low readmission risk'}
                                    </div>
                                </div>
                            )}
                        </div>
                        {pred?.readmissionProbability != null && (
                            <div style={{ marginTop: 18 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>30-day readmission probability gauge:</div>
                                <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                                    <div style={{ height: '100%', borderRadius: 6, width: `${(pred.readmissionProbability) * 100}%`, background: `linear-gradient(90deg, var(--risk-low), ${pred.readmissionRisk ? 'var(--risk-critical)' : 'var(--risk-low)'})`, transition: 'width 0.8s ease' }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)' }}>
                                    <span>0% — No Risk</span><span>50%</span><span>100% — Certain Readmission</span>
                                </div>
                            </div>
                        )}
                        {!pred && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, padding: '20px 0', textAlign: 'center' }}>Run predictions to assess 30-day readmission risk</div>}
                    </div>
                </div>
            )}

            {/* ── VITALS CHART TAB ─────────────────────────────────────────── */}
            {activeTab === 'vitals' && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: '24px' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>📈 Vitals Trend — Last 6 Hours</h3>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={35} />
                                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: 'none', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                                <Line type="monotone" dataKey="HR" name="Heart Rate" stroke="var(--risk-critical)" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="SpO2" name="SpO₂" stroke="var(--accent-primary)" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="SBP" name="Systolic BP" stroke="var(--risk-high)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                                <Line type="monotone" dataKey="Temp" name="Temperature" stroke="var(--risk-medium)" strokeWidth={1.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No vitals data for the last 6 hours</div>
                    )}
                </div>
            )}

            {/* ── LAB REPORTS TAB ──────────────────────────────────────────── */}
            {activeTab === 'reports' && (
                <div style={{ display: 'grid', gridTemplateColumns: reportAnalyzed && reportFindings.length > 0 ? '1fr 1.1fr' : '1fr', gap: 20 }}>
                    {/* Input panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent-magenta)', opacity: 0.5 }} />
                            <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-magenta)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    🧪 Lab Report Text
                                </span>
                                <div style={{ display: 'flex', gap: 7 }}>
                                    <button onClick={() => setReportText(SAMPLE_LAB)} className="btn-ghost" style={{ fontSize: 11, padding: '3px 9px' }}>Sample</button>
                                    <button onClick={() => fileRef.current?.click()} className="btn-ghost" style={{ fontSize: 11, padding: '3px 9px' }}>
                                        <Upload size={11} /> .txt
                                    </button>
                                    <input ref={fileRef} type="file" accept=".txt" style={{ display: 'none' }} onChange={e => {
                                        const f = e.target.files?.[0]; if (!f) return;
                                        const rd = new FileReader();
                                        rd.onload = ev => setReportText(ev.target?.result as string);
                                        rd.readAsText(f);
                                    }} />
                                </div>
                            </div>
                            <textarea
                                value={reportText}
                                onChange={e => { setReportText(e.target.value); if (reportAnalyzed) { setReportAnalyzed(false); setReportFindings([]); } }}
                                placeholder={`Paste lab report here...\n\nExample:\nHemoglobin: 8.2 g/dL\nGlucose: 240 mg/dL\n...`}
                                style={{ width: '100%', minHeight: 240, padding: '12px 16px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }}
                            />
                            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--surface-border)', display: 'flex', gap: 8 }}>
                                {reportText && (
                                    <button onClick={() => { setReportText(''); setReportFindings([]); setReportAnalyzed(false); }} className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
                                        <X size={12} /> Clear
                                    </button>
                                )}
                                <button onClick={analyzeReport} disabled={reportAnalyzing || !reportText.trim()} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                                    {reportAnalyzing ? 'Analyzing...' : <><Brain size={14} /> Analyze with AI</>}
                                </button>
                            </div>
                        </div>

                        {/* Saved reports */}
                        {savedReports.length > 0 && (
                            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: '14px 16px' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Previous Reports</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    {savedReports.map(r => (
                                        <div key={r.id} onClick={() => { setReportText(r.text); setReportFindings(r.findings); setReportAnalyzed(true); }}
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10, cursor: 'pointer' }}>
                                            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                                                Report — {format(new Date(r.date), 'dd MMM yyyy HH:mm')}
                                            </span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: r.findings.filter(f => f.status !== 'NORMAL').length > 0 ? 'var(--risk-high)' : 'var(--accent-green)' }}>
                                                {r.findings.filter(f => f.status !== 'NORMAL').length} abnormal
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results panel */}
                    {reportAnalyzed && reportFindings.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Risk card */}
                            <div style={{ background: `${tint(riskColor, '10')}`, border: `1px solid ${tint(riskColor, '25')}`, borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: riskColor }} />
                                <div style={{ fontSize: 11, fontWeight: 700, color: riskColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>🤖 AI Risk Assessment</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: riskColor }}>{riskLabel}</div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="font-mono" style={{ fontSize: 28, fontWeight: 800, color: riskColor }}>{abnormal.length}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>abnormal parameters</div>
                                    </div>
                                </div>
                            </div>

                            {/* Abnormal values */}
                            {abnormal.length > 0 && (
                                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: '14px 16px' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--risk-high-text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <AlertTriangle size={13} /> Abnormal Values ({abnormal.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {abnormal.map(f => {
                                            const c = f.status === 'HIGH'
                                                ? { color: 'var(--risk-high-text)', bg: 'rgba(217, 122, 58, 0.10)', label: '↑ HIGH' }
                                                : { color: 'var(--accent-primary)', bg: 'rgba(35, 83, 71, 0.08)', label: '↓ LOW' };
                                            return (
                                                <div key={f.name} style={{ background: c.bg, border: `1px solid ${tint(c.color, '30')}`, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{f.name}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Normal: {f.min}–{f.max} {f.unit}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div className="font-mono" style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{f.value} <span style={{ fontSize: 10 }}>{f.unit}</span></div>
                                                        <div style={{ fontSize: 10, color: c.color, fontWeight: 700 }}>{c.label} ({f.deviation.toFixed(0)}% off)</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Normal values (collapsible) */}
                            {normalFindings.length > 0 && (
                                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: '12px 16px' }}>
                                    <button onClick={() => setShowNormal(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', padding: 0 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <CheckCircle2 size={13} color="var(--accent-green-text)" /> Normal Values ({normalFindings.length})
                                        </span>
                                        {showNormal ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                    {showNormal && (
                                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {normalFindings.map(f => (
                                                <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', background: 'rgba(63, 138, 102, 0.04)', borderRadius: 8 }}>
                                                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{f.name}</span>
                                                    <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green-text)' }}>{f.value} {f.unit}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
