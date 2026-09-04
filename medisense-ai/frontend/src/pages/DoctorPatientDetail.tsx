import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { patientApi } from '../api/patient.api';
import api from '../api/axiosInstance';
import { consultationApi } from '../api/hospitalApi';
import { appointmentApi } from '../api/appointment.api';
import {
    ArrowLeft, Brain, RefreshCw, Stethoscope, Calendar, FileText,
    Phone, Mail, Clock, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

function InfoRow({ label, value, highlight }: { label: string; value?: string | number | null; highlight?: boolean }) {
    if (!value && value !== 0) return null;
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginRight: 16 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: highlight ? '#FF6B35' : '#fff', textAlign: 'right' }}>{value}</span>
        </div>
    );
}

function Tag({ label, color = '#FF6B35' }: { label: string; color?: string }) {
    return (
        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: `${color}18`, color, border: `1px solid ${color}30`, fontWeight: 600 }}>
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
                fasting_blood_sugar: patient.hasDiabetes ? 'Greater than 120 mg/dl' : 'Lower than 120 mg/dl',
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
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(0,229,255,0.15)', borderTopColor: '#00E5FF', animation: 'spin 0.8s linear infinite' }} />
        </div>
    );
    if (!patient) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.4)' }}>Patient not found</div>;

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
    const RISK_COLORS: Record<string, string> = { CRITICAL: '#FF2D55', HIGH: '#FF6B35', MEDIUM: '#FFD166', LOW: '#00FF87' };

    return (
        <div style={{ padding: '28px 40px', maxWidth: 1100, margin: '0 auto' }}>
            {/* Back + Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <button onClick={() => navigate('/my-patients')} style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer',
                }}>
                    <ArrowLeft size={15} /> My Patients
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                    {/* Only Doctors/Admins see Run ML + Start Consultation */}
                    {!isReceptionist && (
                        <>
                            <button onClick={openAITools} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
                                borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            }}>
                                <Brain size={14} /> AI Clinical Tools
                            </button>
                            <button onClick={startConsultation} disabled={starting} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                                background: 'linear-gradient(135deg, #E63946, #C1121F)', border: 'none',
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
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, padding: '24px 28px', marginBottom: 24,
                display: 'flex', gap: 20, alignItems: 'center',
            }}>
                <div style={{
                    width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #00E5FF33, #6366f133)',
                    border: '2px solid rgba(0,229,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 800, color: '#00E5FF',
                }}>
                    {patient.firstName[0]}{patient.lastName[0]}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>
                            {patient.firstName} {patient.lastName}
                        </h1>
                        {patient.currentRiskLevel && (
                            <span style={{
                                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                color: RISK_COLORS[patient.currentRiskLevel] || '#aaa',
                                background: `${RISK_COLORS[patient.currentRiskLevel] || '#aaa'}15`,
                                border: `1px solid ${RISK_COLORS[patient.currentRiskLevel] || '#aaa'}30`,
                            }}>{patient.currentRiskLevel} RISK</span>
                        )}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                        <span style={{ fontFamily: 'monospace' }}>{patient.patientCode}</span>
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
                            fontFamily: 'monospace', fontSize: 42, fontWeight: 700,
                            color: patient.riskScore > 70 ? '#FF2D55' : patient.riskScore > 50 ? '#FF6B35' : '#00FF87',
                        }}>{patient.riskScore.toFixed(1)}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            🤖 AI Risk Score
                        </div>
                    </div>
                )}
            </div>

            {/* Content grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

                {/* Patient Profile Info */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
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
                    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#FF6B35', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                            🏥 Medical History
                        </div>
                        {comorbidities.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                {comorbidities.map(c => <Tag key={c} label={c} />)}
                            </div>
                        ) : (
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>No comorbidities on record</div>
                        )}

                        {patient.medicalHistory && (
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Medical History</div>
                                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>{patient.medicalHistory}</div>
                            </div>
                        )}
                        {patient.allergies && (
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, color: '#FFD166', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Allergies ⚠️</div>
                                <div style={{ fontSize: 12.5, color: '#FFD166', lineHeight: 1.6 }}>{patient.allergies}</div>
                            </div>
                        )}
                        {patient.currentMedications && (
                            <div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Current Medications</div>
                                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>{patient.currentMedications}</div>
                            </div>
                        )}
                    </div>

                    {/* Appointment History */}
                    {appointments.length > 0 && (
                        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 20 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                                📅 Appointment History
                            </div>
                            {appointments.slice(0, 4).map((a: any) => (
                                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                                        {new Date(a.requestedDate || a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        {a.timeSlot && ` · ${a.timeSlot}`}
                                        {a.reason && <span style={{ marginLeft: 8, fontStyle: 'italic', color: 'rgba(255,255,255,0.3)' }}>{a.reason}</span>}
                                    </div>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                        color: a.status === 'APPROVED' || a.status === 'PATIENT_ACCEPTED' ? '#00FF87' : 'rgba(255,255,255,0.3)',
                                        background: a.status === 'APPROVED' || a.status === 'PATIENT_ACCEPTED' ? 'rgba(0,255,135,0.1)' : 'rgba(255,255,255,0.05)',
                                    }}>{a.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ML Prediction Panel — DOCTOR only, not shown to RECEPTIONIST */}
            {!isReceptionist && (
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 18, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                            🧠 ML Risk Prediction
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                            AI-powered clinical risk assessment based on patient health profile
                        </div>
                    </div>
                    <button onClick={runPrediction} disabled={predicting} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
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
                                    <div key={m.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</div>
                                        {m.isRisk ? (
                                            <span style={{
                                                fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                                                color: RISK_COLORS[m.value || ''] || '#aaa',
                                                background: `${RISK_COLORS[m.value || ''] || '#aaa'}15`,
                                                border: `1px solid ${RISK_COLORS[m.value || ''] || '#aaa'}30`,
                                            }}>{m.value}</span>
                                        ) : (
                                            <div style={{ fontSize: 16, fontWeight: 700, color: (m as any).danger ? '#FF2D55' : '#fff' }}>{m.value}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Risk Probability Breakdown</div>
                            {Object.entries({
                                'CRITICAL': pred.riskProbabilityCritical || 0,
                                'HIGH': pred.riskProbabilityHigh || 0,
                                'MEDIUM': pred.riskProbabilityMedium || 0,
                                'LOW': pred.riskProbabilityLow || 0,
                            }).map(([level, prob]: [string, any]) => (
                                <div key={level} style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                        <span style={{ color: RISK_COLORS[level] || 'rgba(255,255,255,0.5)' }}>{level}</span>
                                        <span style={{ color: '#fff', fontFamily: 'monospace' }}>{(prob * 100).toFixed(1)}%</span>
                                    </div>
                                    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                                        <div style={{
                                            height: '100%', borderRadius: 4, width: `${prob * 100}%`,
                                            background: RISK_COLORS[level] || '#aaa',
                                            transition: 'width 0.5s ease',
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.3)' }}>
                        <Brain size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                        <div style={{ fontSize: 13 }}>No prediction yet. Click "Run Now" to analyze this patient's risk profile.</div>
                    </div>
                )}
            </div>
            )}

            {/* Receptionist view: simple risk badge only */}
            {isReceptionist && patient.currentRiskLevel && (
                <div style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${RISK_COLORS[patient.currentRiskLevel] || '#aaa'}25`, borderRadius: 18, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🏷️ Scheduling Priority</div>
                    <span style={{
                        fontSize: 14, fontWeight: 800, padding: '6px 18px', borderRadius: 20,
                        color: RISK_COLORS[patient.currentRiskLevel] || '#aaa',
                        background: `${RISK_COLORS[patient.currentRiskLevel] || '#aaa'}15`,
                        border: `1px solid ${RISK_COLORS[patient.currentRiskLevel] || '#aaa'}30`,
                    }}>{patient.currentRiskLevel} RISK</span>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Use this to prioritize appointment scheduling</div>
                </div>
            )}

            {/* Past Consultations / Prescriptions */}
            {patient.prescriptions?.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 20, marginTop: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 12 }}>
                        💊 Previous Prescriptions
                    </div>
                    {patient.prescriptions.slice(0, 5).map((rx: any) => (
                        <div key={rx.id} style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {new Date(rx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' — '}
                            {rx.items?.length || 0} medicine{rx.items?.length !== 1 ? 's' : ''}
                            {rx.notes && <span style={{ marginLeft: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>{rx.notes}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
