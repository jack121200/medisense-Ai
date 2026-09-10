import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Calendar, Clock, Plus, X, CheckCircle, XCircle, RefreshCw,
    MessageSquare, Search, Filter, User, Stethoscope, Phone,
    Bell, CheckCircle2
} from 'lucide-react';
import { appointmentApi, doctorsPublicApi } from '../api/appointment.api';
import { patientApi } from '../api/patient.api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

// ─── Shared config ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
    PENDING: { color: 'var(--risk-medium)', bg: '#FFD16615', label: '⏳ Pending' },
    APPROVED: { color: 'var(--risk-low)', bg: '#00FF8715', label: '✅ Approved' },
    REJECTED: { color: 'var(--risk-critical)', bg: '#FF2D5515', label: '❌ Rejected' },
    COUNTER_OFFERED: { color: 'var(--risk-high)', bg: '#FF6B3515', label: '↩ Counter Offered' },
    ACCEPTED: { color: 'var(--accent-primary)', bg: '#00E5FF15', label: '✅ Patient Accepted' },
    DECLINED: { color: 'var(--text-muted)', bg: '#aaa15', label: 'Patient Declined' },
    CANCELLED: { color: 'var(--text-muted)', bg: '#aaa15', label: 'Cancelled' },
};

const TIME_SLOT_LABELS: Record<string, string> = {
    MORNING: 'Morning (9AM–12PM)',
    NOON: 'Noon (12PM–3PM)',
    EVENING: 'Evening (3PM–6PM)',
    NIGHT: 'Evening (6PM–9PM)',
    LATE_NIGHT: 'Late Night (9PM–12AM)',
};

const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '18:00', '19:00', '20:00'];

// The backend's AppointmentRequest.timeSlot is one of 4 broad buckets, not
// a specific clock time — this maps the picker's specific time onto the
// bucket it falls in (MORNING/NOON/NIGHT/LATE_NIGHT), so the actual
// requested time is still recorded in `reason`/notes for the doctor to see.
function timeToSlot(time: string): 'MORNING' | 'NOON' | 'NIGHT' | 'LATE_NIGHT' {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 12) return 'MORNING';
    if (hour < 18) return 'NOON';
    if (hour < 21) return 'NIGHT';
    return 'LATE_NIGHT';
}
const DEPARTMENTS = ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'General Medicine', 'Emergency', 'Radiology', 'Oncology', 'Pulmonology', 'Nephrology'];
const REASONS = ['Routine Check-up', 'Follow-up', 'Consultation', 'Lab Results Review', 'Emergency', 'Surgery Pre-Op', 'Post-Surgery Follow-up', 'Physiotherapy', 'Vaccination', 'Other'];

// ─── Approve / Reject modals ─────────────────────────────────────────────────

function ApproveModal({ reqId, defaultDate, onClose, onDone }: { reqId: string; defaultDate: string; onClose: () => void; onDone: () => void }) {
    const [date, setDate] = useState(defaultDate || '');
    const [time, setTime] = useState('10:00');
    const [saving, setSaving] = useState(false);

    const handle = async () => {
        if (!date) return toast.error('Select a date');
        setSaving(true);
        try {
            await appointmentApi.approve(reqId, { scheduledDate: date, scheduledTime: time });
            toast.success('✅ Appointment approved! Patient notified.');
            onDone();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Failed to approve');
        } finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13, 45, 62, 0.16)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(24, 155, 130, 0.25)', borderRadius: 20, padding: 32, width: 440 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Approve Appointment</h3>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 22 }}>Set the confirmed date and time for this appointment.</p>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Date</label>
                <input type="date" className="form-input" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} style={{ marginBottom: 14 }} />
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Time</label>
                <select className="form-input" value={time} onChange={e => setTime(e.target.value)} style={{ marginBottom: 24 }}>
                    {TIMES.map(t => <option key={t}>{t}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
                    <button onClick={handle} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                        {saving ? '⏳ Approving...' : '✅ Confirm Appointment'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function RejectModal({ reqId, onClose, onDone }: { reqId: string; onClose: () => void; onDone: () => void }) {
    const [reason, setReason] = useState('');
    const [counterDate, setCounterDate] = useState('');
    const [counterTime, setCounterTime] = useState('');
    const [saving, setSaving] = useState(false);

    const handle = async () => {
        setSaving(true);
        try {
            await appointmentApi.reject(reqId, { rejectReason: reason || undefined, counterDate: counterDate || undefined, counterTime: counterTime || undefined });
            toast.success(counterDate ? '↩ Counter-offer sent to patient' : '❌ Request rejected');
            onDone();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Failed');
        } finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13, 45, 62, 0.16)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(232, 131, 58, 0.25)', borderRadius: 20, padding: 32, width: 460 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Reject / Counter-offer</h3>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18 }}>Optionally suggest an alternative date/time. If none, request is rejected.</p>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Reason (optional)</label>
                <input type="text" className="form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Doctor unavailable..." style={{ marginBottom: 16 }} />
                <div style={{ padding: '14px 16px', background: 'rgba(232, 131, 58, 0.06)', border: '1px solid rgba(232, 131, 58, 0.15)', borderRadius: 12, marginBottom: 20 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--risk-high)', marginBottom: 10 }}>↩ Suggest Alternative (optional)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 5 }}>Date</label>
                            <input type="date" className="form-input" value={counterDate} onChange={e => setCounterDate(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 5 }}>Time</label>
                            <select className="form-input" value={counterTime} onChange={e => setCounterTime(e.target.value)}>
                                <option value="">-- Select --</option>
                                {TIMES.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
                    <button onClick={handle} disabled={saving} style={{ flex: 2, padding: '10px 0', background: 'linear-gradient(135deg, var(--risk-high), var(--risk-critical))', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
                        {saving ? '⏳ Sending...' : counterDate ? '↩ Send Counter-offer' : '❌ Reject Request'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Tab 1: Appointment Requests ──────────────────────────────────────────────

function RequestsTab() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('PENDING');
    const [approving, setApproving] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [approvingReq, setApprovingReq] = useState<any>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await appointmentApi.list();
            setRequests(res.data.data || []);
        } catch { toast.error('Failed to load requests'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'COUNTER_OFFERED', 'ACCEPTED'];
    const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter);
    const pendingCount = requests.filter(r => r.status === 'PENDING').length;

    const stats = [
        { label: 'Total', val: requests.length, color: 'var(--accent-primary)' },
        { label: 'Pending', val: pendingCount, color: 'var(--risk-medium)' },
        { label: 'Approved', val: requests.filter(r => r.status === 'APPROVED' || r.status === 'ACCEPTED').length, color: 'var(--risk-low)' },
        { label: 'Rejected', val: requests.filter(r => r.status === 'REJECTED' || r.status === 'DECLINED').length, color: 'var(--risk-critical)' },
    ];

    return (
        <div>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                {stats.map(s => (
                    <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 14, padding: '14px 18px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.color, opacity: 0.7 }} />
                        <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: 'var(--font-mono)', marginBottom: 3 }}>{s.val}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                {FILTERS.map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                        background: filter === f ? 'rgba(13, 92, 126, 0.12)' : 'var(--surface-2)',
                        border: `1px solid ${filter === f ? '#6366f140' : 'var(--surface-border)'}`,
                        color: filter === f ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}>
                        {f === 'ALL' ? `All (${requests.length})` : f.replace('_', ' ')}
                        {f === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                    </button>
                ))}
                <button onClick={load} className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 11.5, padding: '6px 14px' }}>
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>

            {/* List */}
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Calendar size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.15 }} />
                        No requests in this category
                    </div>
                ) : filtered.map((req: any) => {
                    const sc = STATUS_COLORS[req.status] || { color: 'var(--text-muted)', bg: '#aaa15', label: req.status };
                    const patName = `${req.patient?.user?.firstName || req.patient?.firstName || ''} ${req.patient?.user?.lastName || req.patient?.lastName || ''}`.trim();
                    const docName = `Dr. ${req.doctor?.firstName || ''} ${req.doctor?.lastName || ''}`.trim();
                    return (
                        <div key={req.id} style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(13, 92, 126, 0.12)', border: '1px solid rgba(13, 92, 126, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                                            {patName || 'Unknown Patient'}
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{req.patient?.patientCode}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                            {docName} · <span style={{ color: 'var(--accent-primary)' }}>{req.doctor?.specialization}</span>
                                        </div>
                                    </div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, padding: '4px 12px', borderRadius: 20, border: `1px solid ${sc.color}30`, whiteSpace: 'nowrap' }}>{sc.label}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap', marginBottom: req.status === 'PENDING' ? 12 : 0 }}>
                                <span><Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />{new Date(req.requestedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span><Clock size={11} style={{ display: 'inline', marginRight: 4 }} />{TIME_SLOT_LABELS[req.timeSlot] || req.timeSlot}</span>
                                {req.reason && <span style={{ fontStyle: 'italic' }}>"{req.reason?.slice(0, 60)}"</span>}
                            </div>
                            {req.status === 'APPROVED' && req.scheduledDate && (
                                <div style={{ padding: '8px 12px', background: 'rgba(24, 155, 130, 0.06)', border: '1px solid rgba(24, 155, 130, 0.15)', borderRadius: 8, fontSize: 12.5, color: 'var(--risk-low)', marginTop: 8 }}>
                                    ✅ Confirmed: {new Date(req.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at {req.scheduledTime}
                                </div>
                            )}
                            {req.status === 'PENDING' && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => { setApproving(req.id); setApprovingReq(req); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'rgba(24, 155, 130, 0.08)', border: '1px solid rgba(24, 155, 130, 0.2)', borderRadius: 8, color: 'var(--risk-low)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                        <CheckCircle size={12} /> Approve & Schedule
                                    </button>
                                    <button onClick={() => setRejecting(req.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'rgba(232, 131, 58, 0.08)', border: '1px solid rgba(232, 131, 58, 0.2)', borderRadius: 8, color: 'var(--risk-high)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                        <XCircle size={12} /> Reject / Counter
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {approving && approvingReq && (
                <ApproveModal
                    reqId={approving}
                    defaultDate={approvingReq.requestedDate?.slice(0, 10) || ''}
                    onClose={() => setApproving(null)}
                    onDone={() => { setApproving(null); load(); }}
                />
            )}
            {rejecting && (
                <RejectModal
                    reqId={rejecting}
                    onClose={() => setRejecting(null)}
                    onDone={() => { setRejecting(null); load(); }}
                />
            )}
        </div>
    );
}

// ─── Tab 2: Book New Appointment ──────────────────────────────────────────────

function BookTab() {
    const [searchParams] = useSearchParams();
    const { user } = useAuthStore();
    const [patients, setPatients] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [booked, setBooked] = useState<any[]>([]);

    const [form, setForm] = useState({
        patientId: searchParams.get('patientId') || '',
        patientName: '', patientPhone: '',
        doctorId: '', doctorName: '', doctorDept: DEPARTMENTS[0],
        date: new Date().toISOString().slice(0, 10),
        time: '10:00', reason: REASONS[0], notes: '',
    });

    useEffect(() => {
        // doctorsPublicApi.list() is the correct, authenticated-instance call
        // for this — the previous bare fetch('/api/v1/users') sent no auth
        // header at all and would 401 in any environment that actually
        // enforces auth on that route.
        Promise.all([
            patientApi.list({ limit: 100 }),
            doctorsPublicApi.list(),
        ]).then(([pRes, dRes]) => {
            setPatients(pRes.data.data || []);
            setDoctors(dRes.data.data || []);
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (form.patientId && patients.length > 0) {
            const p = patients.find((x: any) => x.id === form.patientId);
            if (p) setForm(f => ({ ...f, patientName: `${p.firstName} ${p.lastName}`, patientPhone: p.contactInfo?.phone || p.phone || '' }));
        }
    }, [form.patientId, patients]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.patientId || !form.doctorId) return toast.error('Select patient and doctor');
        setSaving(true);
        try {
            const reasonWithTime = `${form.reason} — requested ${form.time}${form.notes ? ` (${form.notes})` : ''}`;
            const res = await appointmentApi.bookForPatient({
                patientId: form.patientId,
                doctorId: form.doctorId,
                requestedDate: form.date,
                timeSlot: timeToSlot(form.time),
                reason: reasonWithTime,
            });
            const saved = res.data?.data;
            setBooked(prev => [{ ...form, id: saved?.id, status: 'BOOKED', createdAt: new Date().toISOString() }, ...prev]);
            setForm(f => ({ ...f, patientId: '', patientName: '', patientPhone: '', notes: '' }));
            toast.success('Appointment booked and confirmed.');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to book appointment');
        } finally { setSaving(false); }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'flex-start' }}>
            {/* Form */}
            <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(13, 92, 126, 0.18)', borderRadius: 18, padding: '24px 26px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent-primary)', opacity: 0.5, borderRadius: '18px 18px 0 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Calendar size={18} color="var(--accent-primary)" />
                    <h3 style={{ fontSize: 15, fontWeight: 800 }}>Book New Appointment</h3>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Patient */}
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Patient <span style={{ color: 'var(--risk-critical)' }}>*</span>
                            </label>
                            <select className="form-input" value={form.patientId} onChange={e => {
                                const p = patients.find((x: any) => x.id === e.target.value);
                                setForm(f => ({ ...f, patientId: e.target.value, patientName: p ? `${p.firstName} ${p.lastName}` : '', patientPhone: p ? (p.contactInfo?.phone || p.phone || '') : '' }));
                            }} required>
                                <option value="">— Select Patient —</option>
                                {patients.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.patientCode})</option>)}
                            </select>
                            {form.patientPhone && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>📞 {form.patientPhone}</div>}
                        </div>
                        {/* Doctor */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Doctor <span style={{ color: 'var(--risk-critical)' }}>*</span>
                                </label>
                                {doctors.length > 0 ? (
                                    <select className="form-input" value={form.doctorId} onChange={e => {
                                        const d = doctors.find((x: any) => x.id === e.target.value);
                                        setForm(f => ({ ...f, doctorId: e.target.value, doctorName: d ? `${d.firstName} ${d.lastName}` : '' }));
                                    }}>
                                        <option value="">— Select Doctor —</option>
                                        {doctors.map((d: any) => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}
                                    </select>
                                ) : (
                                    <input className="form-input" value={form.doctorName} onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))} placeholder="Dr. Mehta" required />
                                )}
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Department</label>
                                <select className="form-input" value={form.doctorDept} onChange={e => setForm(f => ({ ...f, doctorDept: e.target.value }))}>
                                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>
                        {/* Date + Time */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date <span style={{ color: 'var(--risk-critical)' }}>*</span></label>
                                <input type="date" className="form-input" value={form.date} min={new Date().toISOString().slice(0, 10)} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Time <span style={{ color: 'var(--risk-critical)' }}>*</span></label>
                                <select className="form-input" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}>
                                    {TIMES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        {/* Reason */}
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reason</label>
                            <select className="form-input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                                {REASONS.map(r => <option key={r}>{r}</option>)}
                            </select>
                        </div>
                        {/* Notes */}
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notes (optional)</label>
                            <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Special instructions..." style={{ resize: 'none' }} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'rgba(24, 155, 130, 0.04)', border: '1px solid rgba(24, 155, 130, 0.12)', borderRadius: 9, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <MessageSquare size={13} color="var(--accent-green)" />
                            Patient will get an in-app notification if they have a portal account.
                        </div>
                        <button type="submit" disabled={saving} className="btn-primary" style={{ justifyContent: 'center' }}>
                            {saving ? 'Booking...' : <><Calendar size={14} /> Confirm Booking</>}
                        </button>
                    </div>
                </form>
            </div>

            {/* Booked list */}
            <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>
                    📋 Recently Booked ({booked.length})
                </h4>
                {booked.length === 0 ? (
                    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Calendar size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.15 }} />
                        <div style={{ fontSize: 13 }}>Booked appointments appear here</div>
                    </div>
                ) : booked.map(b => (
                    <div key={b.id} style={{ background: 'var(--surface-1)', border: '1px solid rgba(13, 92, 126, 0.14)', borderRadius: 14, padding: '14px 18px', marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{b.patientName}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Dr. {b.doctorName} · {b.doctorDept}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>📅 {b.date} · ⏰ {b.time} · {b.reason}</div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: 'var(--risk-low)', background: 'rgba(24, 155, 130, 0.1)', border: '1px solid rgba(24, 155, 130, 0.2)' }}>BOOKED</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
    const [searchParams] = useSearchParams();
    const defaultTab = searchParams.get('tab') === 'book' ? 'book' : 'requests';
    const [activeTab, setActiveTab] = useState<'requests' | 'book'>(defaultTab as any);

    const tabs = [
        { id: 'requests', label: '📋 Appointment Requests', sub: 'View & manage patient-submitted requests' },
        { id: 'book', label: '➕ Book Appointment', sub: 'Receptionist books directly for a patient' },
    ];

    return (
        <div className="page-enter">
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Calendar size={22} color="var(--accent-primary)" />
                    <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                        Appointments
                    </h1>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    Manage appointment requests and book new appointments for patients
                </p>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{
                        flex: 1, textAlign: 'left', padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
                        border: `1px solid ${activeTab === t.id ? 'rgba(13, 92, 126, 0.3)' : 'var(--surface-border)'}`,
                        background: activeTab === t.id ? 'rgba(13, 92, 126, 0.06)' : 'var(--surface-1)',
                        transition: 'all 0.15s',
                    }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{t.label}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{t.sub}</div>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'requests' && <RequestsTab />}
            {activeTab === 'book' && <BookTab />}
        </div>
    );
}
