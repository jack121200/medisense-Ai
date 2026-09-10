import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { appointmentApi } from '../api/appointment.api';
import { User, Calendar, Phone, Heart, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const SLOT_LABELS: Record<string, string> = {
    MORNING: '9–12 AM', NOON: '12–3 PM', NIGHT: '6–9 PM', LATE_NIGHT: '9–12 PM',
};

function getAge(dob: string) {
    if (!dob) return '—';
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600000));
}

function ComorbidityTag({ label }: { label: string }) {
    return (
        <span style={{
            fontSize: 11, padding: '2px 9px', borderRadius: 20,
            background: 'rgba(204, 107, 61, 0.1)', color: 'var(--risk-high)',
            border: '1px solid rgba(204, 107, 61, 0.25)', fontWeight: 600,
        }}>{label}</span>
    );
}

export default function DoctorPatientsPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [patients, setPatients] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await appointmentApi.list();
                const appts = res.data.data || [];
                setAppointments(appts);

                // Deduplicate patients from all approved appointments
                const seen = new Set<string>();
                const uniquePatients: any[] = [];
                for (const a of appts) {
                    if (a.patient && !seen.has(a.patient.id)) {
                        seen.add(a.patient.id);
                        uniquePatients.push({
                            ...a.patient,
                            latestAppointment: a,
                        });
                    }
                }
                setPatients(uniquePatients);
            } catch { toast.error('Failed to load patients'); }
            finally { setLoading(false); }
        })();
    }, []);

    const filtered = patients.filter(p => {
        const q = search.toLowerCase();
        return !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
            (p.patientCode || '').toLowerCase().includes(q) ||
            (p.phone || '').includes(q);
    });

    const getPatientAppointments = (patientId: string) =>
        appointments.filter(a => a.patient?.id === patientId);

    return (
        <div style={{ padding: '28px 40px', maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <button onClick={() => navigate('/doctor-dashboard')} style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                    color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', marginBottom: 16,
                }}>
                    <ArrowLeft size={15} /> Back to Dashboard
                </button>
                <div style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                    MY PATIENTS
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Your Appointment Patients
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Patients who have booked an appointment with you — {patients.length} total
                </p>
            </div>

            {/* Search */}
            <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Search by name, patient code, phone..."
                style={{
                    width: '100%', padding: '12px 18px', borderRadius: 12, marginBottom: 24,
                    border: '1px solid var(--surface-border-md)', background: 'var(--surface-1)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
            />

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading patients...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <User size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', display: 'block' }} />
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                        {search ? 'No patients match your search' : 'No patients have booked appointments with you yet'}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                    {filtered.map(p => {
                        const appts = getPatientAppointments(p.id);
                        const comorbidities = [
                            p.hasDiabetes && 'Diabetes',
                            p.hasHypertension && 'Hypertension',
                            p.hasHeartDisease && 'Heart Disease',
                            p.hasCKD && 'CKD',
                            p.hasAsthma && 'Asthma',
                            p.hasCOPD && 'COPD',
                            p.hasObesity && 'Obesity',
                        ].filter(Boolean) as string[];

                        return (
                            <div
                                key={p.id}
                                onClick={() => navigate(`/my-patients/${p.id}`)}
                                style={{
                                    background: 'var(--surface-1)',
                                    border: '1px solid var(--surface-border)',
                                    borderRadius: 18, padding: 20, cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(194, 91, 60, 0.2)';
                                    (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-1)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLDivElement).style.border = '1px solid var(--surface-border)';
                                    (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-1)';
                                }}
                            >
                                {/* Avatar + Name */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                                    <div style={{
                                        width: 50, height: 50, borderRadius: 14, flexShrink: 0,
                                        background: 'linear-gradient(135deg, #00E5FF22, #6366f122)',
                                        border: '1px solid rgba(194, 91, 60, 0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 18, fontWeight: 800, color: 'var(--accent-primary)',
                                    }}>
                                        {(p.firstName || '?')[0]}{(p.lastName || '?')[0]}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                                            {p.firstName} {p.lastName}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                            {p.patientCode}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)', background: 'rgba(194, 91, 60, 0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(194, 91, 60, 0.2)', flexShrink: 0 }}>
                                        {appts.length} appt{appts.length !== 1 ? 's' : ''}
                                    </div>
                                </div>

                                {/* Info row */}
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    {p.dateOfBirth && <span>👤 {getAge(p.dateOfBirth)} yrs</span>}
                                    {p.gender && <span>{p.gender}</span>}
                                    {p.bloodGroup && <span>🩸 {p.bloodGroup.replace('_', '')}</span>}
                                    {p.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} /> {p.phone}</span>}
                                </div>

                                {/* Comorbidities */}
                                {comorbidities.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                                        {comorbidities.slice(0, 3).map(c => <ComorbidityTag key={c} label={c} />)}
                                        {comorbidities.length > 3 && (
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 9px' }}>+{comorbidities.length - 3} more</span>
                                        )}
                                    </div>
                                )}

                                {/* Latest appointment */}
                                {p.latestAppointment && (
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--surface-border)', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Calendar size={10} />
                                        {new Date(p.latestAppointment.requestedDate || p.latestAppointment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {' · '}
                                        {SLOT_LABELS[p.latestAppointment.timeSlot] || p.latestAppointment.timeSlot}
                                        <span style={{ marginLeft: 'auto', color: p.latestAppointment.status === 'APPROVED' ? 'var(--risk-low)' : 'var(--text-muted)' }}>
                                            {p.latestAppointment.status}
                                        </span>
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
