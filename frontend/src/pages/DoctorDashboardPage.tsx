import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { consultationApi } from '../api/hospitalApi';
import { appointmentApi } from '../api/appointment.api';
import {
    Calendar, Clock, User, AlertTriangle, Plus, ChevronRight,
    Activity, Stethoscope, CheckCircle, Brain, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import SymptomChecker from '../components/SymptomChecker';

const RISK_COLORS: Record<string, string> = {
    CRITICAL: '#FF2D55', HIGH: '#FF6B35', MEDIUM: '#FFD166', LOW: '#00FF87',
};
const SLOT_LABELS: Record<string, string> = {
    MORNING: '9:00 AM – 12:00 PM',
    NOON: '12:00 PM – 3:00 PM',
    NIGHT: '6:00 PM – 9:00 PM',
    LATE_NIGHT: '9:00 PM – 12:00 AM',
};

function TokenBadge({ n }: { n: number }) {
    return (
        <div style={{
            width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #00E5FF22, #00E5FF11)',
            border: '1px solid #00E5FF33', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 16, color: '#00E5FF', flexShrink: 0,
        }}>{n}</div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        APPROVED: '#00FF87', PATIENT_ACCEPTED: '#00E5FF',
        IN_PROGRESS: '#FFD166', COMPLETED: '#00FF87',
    };
    const c = colors[status] || '#aaa';
    return (
        <span style={{
            fontSize: 10, fontWeight: 700, color: c, background: `${c}15`,
            padding: '3px 10px', borderRadius: 20, border: `1px solid ${c}30`,
        }}>
            {status.replace(/_/g, ' ')}
        </span>
    );
}

export default function DoctorDashboardPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [consultations, setConsultations] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'queue' | 'ai'>('queue');

    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const todayStr = new Date().toISOString().split('T')[0];

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [cRes, aRes] = await Promise.all([
                consultationApi.getByDoctor(user!.id),
                appointmentApi.list(),
            ]);
            const allConsultations = cRes.data.data || [];
            const allAppointments = aRes.data.data || [];

            // Today's consultations only
            const todayConsultations = allConsultations.filter((c: any) => {
                const d = new Date(c.createdAt).toISOString().split('T')[0];
                return d === todayStr;
            });
            setConsultations(todayConsultations);

            // Approved/PATIENT_ACCEPTED appointments (doctor's queue)
            const approvedAppts = allAppointments.filter((a: any) =>
                (a.status === 'APPROVED' || a.status === 'PATIENT_ACCEPTED') &&
                !allConsultations.find((c: any) => c.patientId === a.patient?.id && c.status !== 'COMPLETED')
            );
            setAppointments(approvedAppts);
        } catch { toast.error('Failed to load dashboard data'); }
        finally { setLoading(false); }
    }

    async function startConsultationFromAppointment(patientId: string) {
        try {
            setStarting(patientId);
            const res = await consultationApi.create({ patientId, doctorId: user!.id });
            const cid = res.data.data?.id;
            navigate(`/consultation/${cid}`);
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Failed to start consultation');
        } finally { setStarting(null); }
    }

    const completedToday = consultations.filter(c => c.status === 'COMPLETED').length;
    const inProgressToday = consultations.filter(c => c.status === 'IN_PROGRESS').length;
    const queueCount = appointments.length + consultations.filter(c => c.status === 'IN_PROGRESS').length;

    return (
        <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                    <div style={{ fontSize: 11, color: '#00E5FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                        <Stethoscope size={12} style={{ display: 'inline', marginRight: 6 }} />DOCTOR DASHBOARD
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginBottom: 4 }}>
                        Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, Dr. {user?.firstName}
                    </h1>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{today}</div>
                </div>
                <button onClick={() => navigate('/my-patients')} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px',
                    background: 'linear-gradient(135deg, #00E5FF, #0096AA)', border: 'none',
                    borderRadius: 12, color: '#050709', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                }}>
                    <User size={18} /> My Patients
                </button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
                {[
                    { label: "Today's Queue", val: queueCount, color: '#00E5FF', icon: <Calendar size={18} /> },
                    { label: 'In Progress', val: inProgressToday, color: '#FFD166', icon: <Activity size={18} /> },
                    { label: 'Completed Today', val: completedToday, color: '#00FF87', icon: <CheckCircle size={18} /> },
                    { label: 'Pending Appts', val: appointments.length, color: '#8b5cf6', icon: <FileText size={18} /> },
                ].map(s => (
                    <div key={s.label} style={{
                        background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}22`,
                        borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.color, opacity: 0.6 }} />
                        <div style={{ color: s.color, marginBottom: 10 }}>{s.icon}</div>
                        <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>{s.val}</div>
                        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {([['queue', "Today's Queue", <Calendar size={14} />], ['ai', 'AI Symptom Checker', <Brain size={14} />]] as any[]).map(([id, label, icon]) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
                            background: activeTab === id ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                            color: activeTab === id ? '#fff' : 'rgba(255,255,255,0.45)',
                        }}>
                        {icon}{label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'ai' ? (
                <SymptomChecker />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Upcoming Approved Appointments (To-Start) */}
                    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Calendar size={16} style={{ color: '#00E5FF' }} />
                            <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Approved Appointments — Start Consultation</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{appointments.length} pending</span>
                        </div>

                        {loading ? (
                            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading...</div>
                        ) : appointments.length === 0 ? (
                            <div style={{ padding: 60, textAlign: 'center' }}>
                                <Calendar size={36} style={{ color: 'rgba(255,255,255,0.12)', margin: '0 auto 12px', display: 'block' }} />
                                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No approved appointments waiting</div>
                                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 6 }}>Patients who book an appointment and get receptionist approval will appear here</div>
                            </div>
                        ) : (
                            appointments.map((appt, idx) => {
                                const p = appt.patient;
                                const isStarting = starting === p?.id;
                                const apptDate = appt.requestedDate || appt.scheduledDate;
                                return (
                                    <div key={appt.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    }}>
                                        <TokenBadge n={idx + 1} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
                                                    {p?.firstName} {p?.lastName}
                                                </span>
                                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{p?.patientCode}</span>
                                                <StatusBadge status={appt.status} />
                                            </div>
                                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                                                <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                                                {apptDate ? new Date(apptDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Date TBD'}
                                                {' · '}
                                                {SLOT_LABELS[appt.timeSlot] || appt.timeSlot}
                                                {appt.reason && <span style={{ marginLeft: 12, fontStyle: 'italic' }}>"{appt.reason}"</span>}
                                            </div>
                                            {p && (
                                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                                                    {p.dateOfBirth && `${Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600000))} yrs`}
                                                    {p.gender && ` · ${p.gender}`}
                                                    {p.bloodGroup && ` · ${p.bloodGroup.replace('_', '')}`}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => startConsultationFromAppointment(p?.id)}
                                            disabled={isStarting}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '9px 18px', background: 'linear-gradient(135deg, #00E5FF, #0096AA)',
                                                border: 'none', borderRadius: 10, color: '#050709',
                                                fontWeight: 800, fontSize: 13, cursor: 'pointer', flexShrink: 0,
                                                opacity: isStarting ? 0.6 : 1,
                                            }}>
                                            {isStarting ? 'Starting...' : <><Stethoscope size={14} /> Start</>}
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Today's Active / Completed Consultations */}
                    {consultations.length > 0 && (
                        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Stethoscope size={16} style={{ color: '#00FF87' }} />
                                <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Today's Consultations</span>
                                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{consultations.length} total</span>
                            </div>
                            {consultations.map((c, idx) => {
                                const riskColor = RISK_COLORS[c.patient?.currentRiskLevel] || '#aaa';
                                const statusColor = c.status === 'COMPLETED' ? '#00FF87' : c.status === 'IN_PROGRESS' ? '#FFD166' : '#aaa';
                                return (
                                    <div key={c.id}
                                        onClick={() => navigate(`/consultation/${c.id}`)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                                        onMouseOver={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'}
                                        onMouseOut={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    >
                                        <TokenBadge n={idx + 1} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
                                                    {c.patient?.firstName} {c.patient?.lastName}
                                                </span>
                                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{c.patient?.patientCode}</span>
                                                {c.patient?.currentRiskLevel && (
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: riskColor, background: `${riskColor}15`, padding: '2px 8px', borderRadius: 6, border: `1px solid ${riskColor}30` }}>
                                                        {c.patient?.currentRiskLevel}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                                                <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                                                {new Date(c.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                {c.diagnosis && <span style={{ marginLeft: 12 }}>Dx: {c.diagnosis}</span>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: `${statusColor}15`, padding: '4px 10px', borderRadius: 20, border: `1px solid ${statusColor}30` }}>
                                                {c.status.replace('_', ' ')}
                                            </span>
                                            <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.2)' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
