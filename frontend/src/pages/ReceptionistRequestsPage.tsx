import React, { useEffect, useState } from 'react';
import { appointmentApi } from '../api/appointment.api';
import { Calendar, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
    PENDING: { color: 'var(--risk-medium-text)', bg: '#FFD16615', label: '⏳ Pending' },
    APPROVED: { color: 'var(--risk-low-text)', bg: '#00FF8715', label: '✅ Approved' },
    REJECTED: { color: 'var(--risk-critical-text)', bg: '#FF2D5515', label: '❌ Rejected' },
    COUNTER_OFFERED: { color: 'var(--risk-high-text)', bg: '#FF6B3515', label: '↩ Counter Offered' },
    ACCEPTED: { color: 'var(--accent-primary)', bg: '#00E5FF15', label: '✅ Patient Accepted' },
    DECLINED: { color: 'var(--text-muted)', bg: '#aaa15', label: 'Patient Declined' },
    CANCELLED: { color: 'var(--text-muted)', bg: '#aaa15', label: 'Cancelled' },
};

const TIME_SLOT_LABELS: Record<string, string> = {
    MORNING: 'Morning (9AM–12PM)',
    NOON: 'Noon (12PM–3PM)',
    NIGHT: 'Evening (6PM–9PM)',
    LATE_NIGHT: 'Late Night (9PM–12AM)',
};

interface ApproveForm { scheduledDate: string; scheduledTime: string; }
interface RejectForm { rejectReason: string; counterDate: string; counterTime: string; }

export default function ReceptionistRequestsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('PENDING');
    const [approving, setApproving] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [approveForm, setApproveForm] = useState<ApproveForm>({ scheduledDate: '', scheduledTime: '10:00' });
    const [rejectForm, setRejectForm] = useState<RejectForm>({ rejectReason: '', counterDate: '', counterTime: '' });
    const [submitting, setSubmitting] = useState(false);

    const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        try {
            const res = await appointmentApi.list();
            setRequests(res.data.data || []);
        } catch { toast.error('Failed to load requests'); }
        finally { setLoading(false); }
    }

    async function handleApprove() {
        if (!approving) return;
        if (!approveForm.scheduledDate) return toast.error('Select a scheduled date');
        if (!approveForm.scheduledTime) return toast.error('Select a time');
        setSubmitting(true);
        try {
            await appointmentApi.approve(approving, approveForm);
            toast.success('✅ Appointment approved! Patient notified.');
            setApproving(null);
            setApproveForm({ scheduledDate: '', scheduledTime: '10:00' });
            load();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Failed to approve');
        } finally { setSubmitting(false); }
    }

    async function handleReject() {
        if (!rejecting) return;
        setSubmitting(true);
        try {
            await appointmentApi.reject(rejecting, {
                rejectReason: rejectForm.rejectReason || undefined,
                counterDate: rejectForm.counterDate || undefined,
                counterTime: rejectForm.counterTime || undefined,
            });
            toast.success(rejectForm.counterDate ? '↩ Counter-offer sent to patient' : '❌ Request rejected');
            setRejecting(null);
            setRejectForm({ rejectReason: '', counterDate: '', counterTime: '' });
            load();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Failed to reject');
        } finally { setSubmitting(false); }
    }

    const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'COUNTER_OFFERED', 'ACCEPTED'];
    const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter);
    const pendingCount = requests.filter(r => r.status === 'PENDING').length;

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--surface-border-md)',
        background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    };

    return (
        <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto', fontFamily: '"Inter", system-ui, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                <div>
                    <div style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>RECEPTIONIST · APPOINTMENTS</div>
                    <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Appointment Requests</h1>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Review, approve or suggest alternative timings for patients</div>
                </div>
                <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--surface-2)', border: '1px solid var(--surface-border-md)', borderRadius: 10, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Total Requests', val: requests.length, color: 'var(--accent-primary)' },
                    { label: 'Pending Review', val: pendingCount, color: 'var(--risk-medium-text)' },
                    { label: 'Approved', val: requests.filter(r => r.status === 'APPROVED' || r.status === 'ACCEPTED').length, color: 'var(--risk-low-text)' },
                    { label: 'Rejected', val: requests.filter(r => r.status === 'REJECTED' || r.status === 'DECLINED').length, color: 'var(--risk-critical-text)' },
                ].map(s => (
                    <div key={s.label} style={{ background: 'var(--surface-1)', border: `1px solid ${s.color}22`, borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.color, opacity: 0.7 }} />
                        <div style={{ fontSize: 30, fontWeight: 900, color: s.color, fontFamily: 'monospace', marginBottom: 4 }}>{s.val}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                {FILTERS.map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                        padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: filter === f ? 'rgba(13, 92, 126, 0.15)' : 'var(--surface-2)',
                        border: `1px solid ${filter === f ? '#6366f140' : 'var(--surface-border-md)'}`,
                        color: filter === f ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    }}>
                        {f === 'ALL' ? `All (${requests.length})` : f.replace('_', ' ')}
                        {f === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Calendar size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Requests ({filtered.length})</span>
                </div>

                {loading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                    : filtered.length === 0 ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Calendar size={36} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
                        No requests in this category
                    </div>
                        : filtered.map((req: any) => {
                            const sc = STATUS_COLORS[req.status] || { color: 'var(--text-muted)', bg: '#aaa15', label: req.status };
                            return (
                                <div key={req.id} style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <div>
                                            {/* Patient info */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                                                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #6366f133, #8b5cf633)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
                                                        {req.patient?.user?.firstName || req.patient?.firstName} {req.patient?.user?.lastName || req.patient?.lastName}
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{req.patient?.patientCode}</span>
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                        For Dr. {req.doctor?.firstName} {req.doctor?.lastName} · <span style={{ color: 'var(--accent-primary)' }}>{req.doctor?.specialization}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Request details */}
                                            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                                <span><Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />{new Date(req.requestedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                <span><Clock size={11} style={{ display: 'inline', marginRight: 4 }} />{TIME_SLOT_LABELS[req.timeSlot] || req.timeSlot}</span>
                                                <span>Submitted: {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                            </div>
                                            {req.reason && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic', maxWidth: 500 }}>"{req.reason}"</div>}
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, padding: '5px 14px', borderRadius: 20, whiteSpace: 'nowrap', border: `1px solid ${sc.color}30` }}>{sc.label}</span>
                                    </div>

                                    {/* Approved info */}
                                    {req.status === 'APPROVED' && req.scheduledDate && (
                                        <div style={{ padding: '10px 14px', background: 'rgba(24, 155, 130, 0.06)', border: '1px solid rgba(24, 155, 130, 0.15)', borderRadius: 10, fontSize: 13, color: 'var(--risk-low-text)', marginTop: 6 }}>
                                            ✅ Confirmed: {new Date(req.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at {req.scheduledTime}
                                        </div>
                                    )}

                                    {/* Action buttons (only for PENDING) */}
                                    {req.status === 'PENDING' && (
                                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                            <button onClick={() => { setApproving(req.id); setApproveForm({ scheduledDate: req.requestedDate?.split('T')[0] || '', scheduledTime: '10:00' }); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(24, 155, 130, 0.1)', border: '1px solid rgba(24, 155, 130, 0.25)', borderRadius: 8, color: 'var(--risk-low-text)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                                <CheckCircle size={13} /> Approve & Schedule
                                            </button>
                                            <button onClick={() => { setRejecting(req.id); setRejectForm({ rejectReason: '', counterDate: '', counterTime: '' }); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(232, 131, 58, 0.1)', border: '1px solid rgba(232, 131, 58, 0.25)', borderRadius: 8, color: 'var(--risk-high-text)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                                <XCircle size={13} /> Reject / Counter-offer
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
            </div>

            {/* APPROVE MODAL */}
            {approving && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(13, 45, 62, 0.16)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(24, 155, 130, 0.2)', borderRadius: 20, padding: 32, width: 460 }}>
                        <h3 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text-primary)', marginBottom: 6 }}>Approve Appointment</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Set the confirmed date and time for this appointment.</p>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>Scheduled Date</label>
                            <input type="date" style={inputStyle} value={approveForm.scheduledDate} onChange={e => setApproveForm(f => ({ ...f, scheduledDate: e.target.value }))} />
                        </div>
                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>Scheduled Time</label>
                            <select style={{ ...inputStyle, appearance: 'none' }} value={approveForm.scheduledTime} onChange={e => setApproveForm(f => ({ ...f, scheduledTime: e.target.value }))}>
                                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setApproving(null)} style={{ flex: 1, padding: 12, border: '1px solid var(--surface-border-md)', background: 'transparent', color: 'var(--text-primary)', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                            <button onClick={handleApprove} disabled={submitting} style={{ flex: 2, padding: 12, background: 'linear-gradient(135deg, var(--risk-low), #00A858)', border: 'none', borderRadius: 10, color: 'var(--bg-primary)', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
                                {submitting ? '⏳ Approving...' : '✅ Confirm Appointment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REJECT / COUNTER MODAL */}
            {rejecting && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(13, 45, 62, 0.16)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(232, 131, 58, 0.2)', borderRadius: 20, padding: 32, width: 480 }}>
                        <h3 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text-primary)', marginBottom: 6 }}>Reject / Counter-offer</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                            Optionally suggest an alternative date/time. If no alternative is provided, the request is simply rejected.
                        </p>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>Reason (optional)</label>
                            <input type="text" style={inputStyle} value={rejectForm.rejectReason} onChange={e => setRejectForm(f => ({ ...f, rejectReason: e.target.value }))} placeholder="Doctor unavailable at requested time..." />
                        </div>
                        <div style={{ padding: '14px 16px', background: 'rgba(232, 131, 58, 0.07)', border: '1px solid rgba(232, 131, 58, 0.15)', borderRadius: 12, marginBottom: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--risk-high-text)', marginBottom: 10 }}>↩ Suggest Alternative (optional)</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Alternative Date</label>
                                    <input type="date" style={inputStyle} value={rejectForm.counterDate} onChange={e => setRejectForm(f => ({ ...f, counterDate: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Alternative Time</label>
                                    <select style={{ ...inputStyle, appearance: 'none' }} value={rejectForm.counterTime} onChange={e => setRejectForm(f => ({ ...f, counterTime: e.target.value }))}>
                                        <option value="">-- Select --</option>
                                        {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setRejecting(null)} style={{ flex: 1, padding: 12, border: '1px solid var(--surface-border-md)', background: 'transparent', color: 'var(--text-primary)', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                            <button onClick={handleReject} disabled={submitting} style={{ flex: 2, padding: 12, background: 'linear-gradient(135deg, var(--risk-high), var(--risk-critical))', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
                                {submitting ? '⏳ Sending...' : rejectForm.counterDate ? '↩ Send Counter-offer' : '❌ Reject Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
