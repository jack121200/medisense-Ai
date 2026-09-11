import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { patientApi } from '../api/patient.api';
import api from '../api/axiosInstance';
import { consultationApi } from '../api/hospitalApi';
import { appointmentApi } from '../api/appointment.api';
import { aiDoctorApi, AiDoctorCallSummary } from '../api/aiDoctorApi';
import {
    ArrowLeft, Brain, RefreshCw, Stethoscope, Calendar, FileText,
    Phone, Mail, Clock, AlertTriangle, Bot, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { reportApi } from '../api/index';
import { downloadBlob } from '../utils/downloadBlob';

import { tint } from '../utils/tint';
function InfoRow({ label, value, highlight }: { label: string; value?: string | number | null; highlight?: boolean }) {
    if (!value && value !== 0) return null;
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, marginRight: 16 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: highlight ? 'var(--risk-high)' : 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
        </div>
    );
}

function Tag({ label, color = 'var(--risk-high)' }: { label: string; color?: string }) {
    return (
        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: `${tint(color, '18')}`, color, border: `1px solid ${tint(color, '30')}`, fontWeight: 600 }}>
            {label}
        </span>
    );
}

export default function DoctorPatientDetail() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const isReceptionist = user?.role === 'RECEPTIONIST';
    const [patient, setPatient] = useState<any>(null);
    const [prediction, setPrediction] = useState<any>(null);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [predicting, setPredicting] = useState(false);
    const [aiDoctorCalls, setAiDoctorCalls] = useState<AiDoctorCallSummary[]>([]);
    const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const [pRes, aRes] = await Promise.all([
                    patientApi.getById(id),
                    appointmentApi.list(),
                ]);
                const p = pRes.data.data;
                setPatient(p);
                if (p?.mlPredictions?.[0]) setPrediction(p.mlPredictions[0]);
                const patientAppts = (aRes.data.data || []).filter((a: any) => a.patient?.id === id);
                setAppointments(patientAppts);
            } catch { toast.error('Failed to load patient'); }
            finally { setLoading(false); }
        })();
        aiDoctorApi.getCallsForPatient(id, 1, 5)
            .then(res => setAiDoctorCalls(res.data.data))
            .catch(() => { /* non-critical section, fail silently */ });
    }, [id]);

    function openAITools() {
        navigate('/ai-tools');
    }

    async function runPrediction() {
        if (!id || !patient) return;
        setPredicting(true);
        try {
            const patientAge = patient.dateOfBirth
                ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600000))
                : 45;
            const payload = {
                patientId: id,
                age: patientAge,
                sex: patient.gender === 'MALE' ? 'Male' : 'Female',
                chest_pain_type: 'Asymptomatic',
                resting_blood_pressure: 120,
                cholestoral: 200,
                fasting_blood_sugar: patient.hasDiabetes ? 'Greater than 120 mg/ml' : 'Lower than 120 mg/ml',
                rest_ecg: 'Normal',
                Max_heart_rate: 150,
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
    }

    async function startConsultation() {
        if (!id) return;
        setStarting(true);
        try {
            const res = await consultationApi.create({ patientId: id, doctorId: user!.id });
            const cid = res.data.data?.id;
            navigate(`/consultation/${cid}`);
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Failed to start consultation');
        } finally { setStarting(false); }
    }

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(35, 83, 71, 0.15)', borderTopColor: 'var(--accent-primary)', animation: 'spin 0.8s linear infinite' }} />
        </div>
    );
    if (!patient) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Patient not found</div>;

    const age = patient.dateOfBirth
        ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600000))
        : null;

    const comorbidities = [
        patient.hasDiabetes && 'Diabetes', patient.hasHypertension && 'Hypertension',
        patient.hasHeartDisease && 'Heart Disease', patient.hasCKD && 'CKD',
        patient.hasAsthma && 'Asthma', patient.hasCOPD && 'COPD',
        patient.hasObesity && 'Obesity', patient.hasCancer && 'Cancer',
    ].filter(Boolean) as string[];

    const pred = prediction || patient.mlPredictions?.[0];
    const RISK_COLORS: Record<string, string> = { CRITICAL: 'var(--risk-critical)', HIGH: 'var(--risk-high)', MEDIUM: 'var(--risk-medium)', LOW: 'var(--risk-low)' };

    return (
        <div style={{ padding: '28px 40px', maxWidth: 1100, margin: '0 auto' }}>
            {/* Back + Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <button onClick={() => navigate('/my-patients')} style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                    color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
                }}>
                    <ArrowLeft size={15} /> My Patients
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                    {/* Only Doctors/Admins see Run ML + Start Consultation */}
                    {!isReceptionist && (
                        <>
                            <button onClick={openAITools} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-magenta))', border: 'none',
                                borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            }}>
                                <Brain size={14} /> AI Clinical Tools
                            </button>
                            <button onClick={startConsultation} disabled={starting} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))', border: 'none',
                                borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                                opacity: starting ? 0.6 : 1,
                            }}>
                                <Stethoscope size={14} /> {starting ? 'Starting...' : 'Start Consultation'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Patient Header */}
            <div style={{
                background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                borderRadius: 20, padding: '24px 28px', marginBottom: 24,
                display: 'flex', gap: 20, alignItems: 'center',
            }}>
                <div style={{
                    width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--surface-3)',
                    border: '2px solid rgba(35, 83, 71, 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 800, color: 'var(--accent-primary)',
                }}>
                    {patient.firstName[0]}{patient.lastName[0]}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            {patient.firstName} {patient.lastName}
                        </h1>
                        {patient.currentRiskLevel && (
                            <span style={{
                                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                color: RISK_COLORS[patient.currentRiskLevel] || 'var(--text-muted)',
                                background: `${tint(RISK_COLORS[patient.currentRiskLevel] || 'var(--surface-2)', '15')}`,
                                border: `1px solid ${tint(RISK_COLORS[patient.currentRiskLevel] || 'var(--surface-border)', '30')}`,
                            }}>{patient.currentRiskLevel} RISK</span>
                        )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{patient.patientCode}</span>
                        {age && ` · ${age} yrs`}
                        {patient.gender && ` · ${patient.gender}`}
                        {patient.bloodGroup && ` · 🩸 ${patient.bloodGroup.replace('_', '')}`}
                        {patient.bmi && ` · BMI ${patient.bmi}`}
                    </div>
                    {comorbidities.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {comorbidities.map(c => <Tag key={c} label={c} />)}
                        </div>
                    )}
                </div>
                {patient.riskScore != null && (
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{
                            fontFamily: 'var(--font-mono)', fontSize: 42, fontWeight: 700,
                            color: patient.riskScore > 70 ? 'var(--risk-critical)' : patient.riskScore > 50 ? 'var(--risk-high)' : 'var(--risk-low)',
                        }}>{patient.riskScore.toFixed(1)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            🤖 AI Risk Score
                        </div>
                    </div>
                )}
            </div>

            {/* Content grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

                {/* Patient Profile Info */}
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                        📋 Patient Registration Info
                    </div>
                    <InfoRow label="Full Name" value={`${patient.firstName} ${patient.lastName}`} />
                    <InfoRow label="Age" value={age ? `${age} years` : undefined} />
                    <InfoRow label="Gender" value={patient.gender} />
                    <InfoRow label="Blood Group" value={patient.bloodGroup?.replace('_', '')} />
                    <InfoRow label="BMI" value={patient.bmi} />
                    <InfoRow label="Phone" value={patient.phone || patient.contactInfo?.phone} />
                    <InfoRow label="Email" value={patient.email || patient.contactInfo?.email} />
                    <InfoRow label="Date of Birth" value={patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined} />
                    <InfoRow label="Address" value={patient.address || patient.contactInfo?.address} />
                    {patient.emergencyContact?.name && (
                        <InfoRow label="Emergency Contact" value={`${patient.emergencyContact.name} (${patient.emergencyContact.phone})`} />
                    )}
                </div>

                {/* Medical History */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--risk-high-text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                            🏥 Medical History
                        </div>
                        {comorbidities.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                {comorbidities.map(c => <Tag key={c} label={c} />)}
                            </div>
                        ) : (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>No comorbidities on record</div>
                        )}

                        {patient.medicalHistory && (
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Medical History</div>
                                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{patient.medicalHistory}</div>
                            </div>
                        )}
                        {patient.allergies && (
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, color: 'var(--risk-medium-text)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Allergies ⚠️</div>
                                <div style={{ fontSize: 12.5, color: 'var(--risk-medium-text)', lineHeight: 1.6 }}>{patient.allergies}</div>
                            </div>
                        )}
                        {patient.currentMedications && (
                            <div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Current Medications</div>
                                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{patient.currentMedications}</div>
                            </div>
                        )}
                    </div>

                    {/* Appointment History */}
                    {appointments.length > 0 && (
                        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: 20 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                                📅 Appointment History
                            </div>
                            {appointments.slice(0, 4).map((a: any) => (
                                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--surface-border)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        {new Date(a.requestedDate || a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        {a.timeSlot && ` · ${a.timeSlot}`}
                                        {a.reason && <span style={{ marginLeft: 8, fontStyle: 'italic', color: 'var(--text-muted)' }}>{a.reason}</span>}
                                    </div>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                        color: a.status === 'APPROVED' || a.status === 'PATIENT_ACCEPTED' ? 'var(--risk-low)' : 'var(--text-muted)',
                                        background: a.status === 'APPROVED' || a.status === 'PATIENT_ACCEPTED' ? 'rgba(63, 138, 102, 0.1)' : 'var(--surface-2)',
                                    }}>{a.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ML Prediction Panel — DOCTOR only, not shown to RECEPTIONIST */}
            {!isReceptionist && (
            <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(35, 83, 71, 0.2)', borderRadius: 18, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-magenta)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                            🧠 ML Risk Prediction
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            AI-powered clinical risk assessment based on patient health profile
                        </div>
                    </div>
                    <button onClick={runPrediction} disabled={predicting} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-magenta))', border: 'none',
                        borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        opacity: predicting ? 0.6 : 1, flexShrink: 0,
                    }}>
                        {predicting
                            ? <><RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Running...</>
                            : <><Brain size={14} /> Run Now</>
                        }
                    </button>
                </div>

                {pred ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                                {[
                                    { label: 'Risk Level', value: pred.predictedRiskLevel, isRisk: true },
                                    { label: 'Confidence', value: `${((pred.riskConfidence || 0) * 100).toFixed(1)}%` },
                                    { label: 'Readmission Risk', value: pred.readmissionProbability ? `${(pred.readmissionProbability * 100).toFixed(1)}%` : '—', danger: pred.readmissionRisk },
                                    { label: 'Predicted LOS', value: pred.predictedLengthOfStay ? `${pred.predictedLengthOfStay.toFixed(1)} days` : '—' },
                                ].map(m => (
                                    <div key={m.label} style={{ background: 'var(--surface-1)', borderRadius: 12, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</div>
                                        {m.isRisk ? (
                                            <span style={{
                                                fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                                                color: RISK_COLORS[m.value || ''] || 'var(--text-muted)',
                                                background: `${tint(RISK_COLORS[m.value || ''] || 'var(--surface-2)', '15')}`,
                                                border: `1px solid ${tint(RISK_COLORS[m.value || ''] || 'var(--surface-border)', '30')}`,
                                            }}>{m.value}</span>
                                        ) : (
                                            <div style={{ fontSize: 16, fontWeight: 700, color: (m as any).danger ? 'var(--risk-critical)' : 'var(--text-primary)' }}>{m.value}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Risk Probability Breakdown</div>
                            {Object.entries({
                                'CRITICAL': pred.riskProbabilityCritical || 0,
                                'HIGH': pred.riskProbabilityHigh || 0,
                                'MEDIUM': pred.riskProbabilityMedium || 0,
                                'LOW': pred.riskProbabilityLow || 0,
                            }).map(([level, prob]: [string, any]) => (
                                <div key={level} style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                        <span style={{ color: RISK_COLORS[level] || 'var(--text-secondary)' }}>{level}</span>
                                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{(prob * 100).toFixed(1)}%</span>
                                    </div>
                                    <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 4 }}>
                                        <div style={{
                                            height: '100%', borderRadius: 4, width: `${prob * 100}%`,
                                            background: RISK_COLORS[level] || 'var(--surface-2)',
                                            transition: 'width 0.5s ease',
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                        <Brain size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                        <div style={{ fontSize: 13 }}>No prediction yet. Click "Run Now" to analyze this patient's risk profile.</div>
                    </div>
                )}
            </div>
            )}

            {/* Receptionist view: simple risk badge only */}
            {isReceptionist && patient.currentRiskLevel && (
                <div style={{ background: 'var(--surface-1)', border: `1px solid ${tint(RISK_COLORS[patient.currentRiskLevel] || 'var(--surface-border)', '25')}`, borderRadius: 18, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🏷️ Scheduling Priority</div>
                    <span style={{
                        fontSize: 14, fontWeight: 800, padding: '6px 18px', borderRadius: 20,
                        color: RISK_COLORS[patient.currentRiskLevel] || 'var(--text-muted)',
                        background: `${tint(RISK_COLORS[patient.currentRiskLevel] || 'var(--surface-2)', '15')}`,
                        border: `1px solid ${tint(RISK_COLORS[patient.currentRiskLevel] || 'var(--surface-border)', '30')}`,
                    }}>{patient.currentRiskLevel} RISK</span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Use this to prioritize appointment scheduling</div>
                </div>
            )}

            {/* Past Consultations / Prescriptions */}
            {patient.prescriptions?.length > 0 && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: 20, marginTop: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                        💊 Previous Prescriptions
                    </div>
                    {patient.prescriptions.slice(0, 5).map((rx: any) => (
                        <div key={rx.id} style={{ fontSize: 12.5, color: 'var(--text-secondary)', padding: '7px 0', borderBottom: '1px solid var(--surface-border)' }}>
                            {new Date(rx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' — '}
                            {rx.items?.length || 0} medicine{rx.items?.length !== 1 ? 's' : ''}
                            {rx.notes && <span style={{ marginLeft: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>{rx.notes}</span>}
                        </div>
                    ))}
                </div>
            )}

            {/* AI Doctor Call History — previously fully siloed to the patient's own portal */}
            {aiDoctorCalls.length > 0 && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(35, 83, 71, 0.2)', borderRadius: 18, padding: 20, marginTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <Bot size={15} color="var(--accent-primary)" />
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            AI Doctor Consultations (Voice Assistant)
                        </div>
                    </div>
                    {aiDoctorCalls.map(call => {
                        const suggestions = call.doctorSuggestions;
                        const isExpanded = expandedCallId === call.id;
                        return (
                            <div key={call.id} style={{ borderBottom: '1px solid var(--surface-border)', padding: '10px 0' }}>
                                <div
                                    onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                >
                                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                                        {new Date(call.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {call.durationSecs ? ` · ${Math.round(call.durationSecs / 60)} min` : ''}
                                    </div>
                                    {suggestions?.urgency && (
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                                            color: suggestions.urgency === 'URGENT' ? 'var(--risk-critical)' : suggestions.urgency === 'SOON' ? 'var(--risk-medium)' : 'var(--risk-low)',
                                            background: suggestions.urgency === 'URGENT' ? 'rgba(200, 67, 75, 0.1)' : suggestions.urgency === 'SOON' ? 'rgba(201, 154, 42, 0.1)' : 'rgba(63, 138, 102, 0.1)',
                                        }}>{suggestions.urgency}</span>
                                    )}
                                </div>
                                {isExpanded && suggestions && (
                                    <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                        <div style={{ marginBottom: 8 }}>{suggestions.summary}</div>
                                        {suggestions.possible_conditions?.length > 0 && (
                                            <div style={{ marginBottom: 6 }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>Possible conditions: </strong>
                                                {suggestions.possible_conditions.join(', ')}
                                            </div>
                                        )}
                                        {suggestions.red_flags?.length > 0 && (
                                            <div style={{ marginBottom: 6, color: 'var(--accent-primary-hover)' }}>
                                                <strong>Red flags: </strong>
                                                {suggestions.red_flags.join(' | ')}
                                            </div>
                                        )}
                                        {suggestions.follow_up && (
                                            <div style={{ color: 'var(--text-secondary)' }}>
                                                <strong style={{ color: 'var(--text-secondary)' }}>Follow-up: </strong>
                                                {suggestions.follow_up}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
