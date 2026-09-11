import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { consultationApi, labApi } from '../api/hospitalApi';
import { patientApi } from '../api/patient.api';
import { appointmentApi, doctorsPublicApi, notificationsApi } from '../api/appointment.api';
import { Calendar, Pill, FlaskConical, Receipt, MessageCircle, Send, Bell, Plus, CheckCircle, XCircle, Clock, ExternalLink, Heart } from 'lucide-react';
import { usePatientSync } from '../hooks/usePatientSync';
import toast from 'react-hot-toast';

const CHATBOT_RULES: Array<{ keywords: string[]; reply: string }> = [
    { keywords: ['fever', 'temperature', 'hot'], reply: 'You may have a viral fever. Take rest, drink plenty of fluids, and take Paracetamol 500mg if temperature is above 38°C. If it persists for more than 3 days, consult your doctor.\n\n⚠️ Seek immediate care if temperature exceeds 40°C.' },
    { keywords: ['cough', 'cold', 'throat'], reply: 'For cough and cold: drink warm water with honey and ginger. Avoid cold drinks. You can take antihistamines for relief. If cough is productive with blood, consult your doctor immediately.' },
    { keywords: ['chest', 'heart', 'pain', 'pressure'], reply: '⚠️ Chest pain can be serious. If you have sudden chest pressure, pain radiating to arm/jaw, or severe shortness of breath — call emergency services immediately. Do not wait.' },
    { keywords: ['headache', 'migraine', 'head'], reply: 'For headaches: rest in a quiet dark room, stay hydrated, and take Paracetamol 500mg. Migraine triggers include stress, bright lights, and certain foods. Track your triggers.' },
    { keywords: ['stomach', 'vomit', 'nausea', 'diarrhea', 'diarrhoea'], reply: 'For stomach issues: stay hydrated with ORS solution. Avoid solid food for a few hours. Eat light foods like rice and bananas once better. See a doctor if vomiting blood or diarrhea lasts >2 days.' },
    { keywords: ['diabetes', 'sugar', 'glucose'], reply: 'For diabetes management: monitor your blood sugar daily. Eat at regular intervals, avoid sugary drinks, and take your prescribed medication consistently. Exercise 30 minutes daily.' },
    { keywords: ['bp', 'blood pressure', 'hypertension'], reply: 'For high blood pressure: reduce salt intake, avoid stress, exercise regularly, and take prescribed medication. Monitor BP daily. Target: below 130/80 mmHg.' },
    { keywords: ['appointment', 'book', 'schedule'], reply: 'You can book appointments directly from the "Book Appointment" tab in your patient portal! Select a doctor, your preferred date, and a time slot.' },
];

function getBotReply(message: string): string {
    const lower = message.toLowerCase();
    for (const rule of CHATBOT_RULES) {
        if (rule.keywords.some(k => lower.includes(k))) return rule.reply;
    }
    return 'I understand you have a health concern. For accurate diagnosis, please consult your doctor.\n\nFor emergencies call 112.\n\nI can help with information about: fever, cough, chest pain, headache, stomach issues, diabetes, or blood pressure.';
}

const TIME_SLOTS = [
    { value: 'MORNING', label: 'Morning', time: '9AM – 12PM', icon: '🌅' },
    { value: 'NOON', label: 'Noon', time: '12PM – 3PM', icon: '☀️' },
    { value: 'NIGHT', label: 'Evening', time: '6PM – 9PM', icon: '🌆' },
    { value: 'LATE_NIGHT', label: 'Late Night', time: '9PM – 12AM', icon: '🌙' },
];

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
    PENDING: { color: 'var(--risk-medium-text)', bg: '#FFD16615', label: 'Pending Review' },
    APPROVED: { color: 'var(--risk-low-text)', bg: '#00FF8715', label: 'Approved ✓' },
    REJECTED: { color: 'var(--risk-critical-text)', bg: '#FF2D5515', label: 'Rejected' },
    COUNTER_OFFERED: { color: 'var(--risk-high-text)', bg: '#FF6B3515', label: 'Alternative Offered' },
    ACCEPTED: { color: 'var(--accent-primary)', bg: '#00E5FF15', label: 'Accepted by Patient' },
    DECLINED: { color: 'var(--text-muted)', bg: '#aaa15', label: 'Declined' },
    CANCELLED: { color: 'var(--text-muted)', bg: '#aaa15', label: 'Cancelled' },
};

export default function PatientPortalPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    // S2: Realtime sync — polls every 10s
    const syncState = usePatientSync(user?.id);
    const [tab, setTab] = useState<'appointments' | 'book' | 'prescriptions' | 'reports' | 'bills' | 'notifications' | 'chatbot'>('appointments');
    const [consultations, setConsultations] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [labTests, setLabTests] = useState<any[]>([]);
    const [appointmentRequests, setAppointmentRequests] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    // Booking form
    const [bookForm, setBookForm] = useState({ doctorId: '', requestedDate: '', timeSlot: '', reason: '' });
    const [booking, setBooking] = useState(false);

    // Chat
    const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'bot'; text: string }>>([
        { role: 'bot', text: 'Hello! I\'m your MediSense AI Health Assistant. How are you feeling today? Describe your symptoms and I\'ll help you understand them.\n\nYou can also ask me about booking appointments! 🏥' }
    ]);
    const [chatInput, setChatInput] = useState('');

    useEffect(() => { loadAll(); }, []);
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    async function loadAll() {
        if (!user) return;
        try {
            setLoading(true);
            // user.id identifies the User, not the Patient record — consultations
            // are keyed by patient id, so resolve it first rather than sending a
            // user id that will never match.
            const profile = await patientApi.getMyProfile().catch(() => null);
            const patientId = profile?.data?.data?.id;

            const [consRes, invRes, labRes, apptRes, notifRes, countRes, docRes] = await Promise.all([
                patientId
                    ? consultationApi.getByPatient(patientId).catch(() => ({ data: { data: [] } }))
                    : Promise.resolve({ data: { data: [] } }),
                // /patients/my-bills resolves the caller from the JWT; the staff
                // billing list this used to call 403s for a patient.
                patientApi.getMyBills().catch(() => ({ data: { data: [] } })),
                labApi.getMyTests().catch(() => ({ data: { data: [] } })),
                appointmentApi.list().catch(() => ({ data: { data: [] } })),
                notificationsApi.list().catch(() => ({ data: { data: [] } })),
                notificationsApi.unreadCount().catch(() => ({ data: { data: { count: 0 } } })),
                doctorsPublicApi.list().catch(() => ({ data: { data: [] } })),
            ]);
            setConsultations(consRes.data.data || []);
            setInvoices(invRes.data.data || []);
            setLabTests(labRes.data.data || []);
            setAppointmentRequests(apptRes.data.data || []);
            setNotifications(notifRes.data.data || []);
            setUnreadCount(countRes.data.data?.count || 0);
            setDoctors(docRes.data.data || []);
        } catch { } finally { setLoading(false); }
    }


    async function submitBooking() {
        if (!bookForm.doctorId) return toast.error('Please select a doctor');
        if (!bookForm.requestedDate) return toast.error('Please select a date');
        if (!bookForm.timeSlot) return toast.error('Please select a time slot');
        setBooking(true);
        try {
            await appointmentApi.create({
                doctorId: bookForm.doctorId,
                requestedDate: bookForm.requestedDate,
                timeSlot: bookForm.timeSlot as any,
                reason: bookForm.reason || undefined,
            });
            toast.success('Appointment request sent! Receptionist will review and confirm.');
            setBookForm({ doctorId: '', requestedDate: '', timeSlot: '', reason: '' });
            setTab('appointments');
            loadAll();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Booking failed');
        } finally { setBooking(false); }
    }

    async function respondToCounter(id: string, accept: boolean) {
        try {
            await appointmentApi.respond(id, accept);
            toast.success(accept ? 'Appointment confirmed!' : 'Counter-offer declined');
            loadAll();
        } catch { toast.error('Failed to respond'); }
    }

    async function markNotifRead(id: string) {
        try {
            await notificationsApi.markRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { }
    }

    async function markAllRead() {
        try {
            await notificationsApi.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch { }
    }

    function sendChat() {
        if (!chatInput.trim()) return;
        const userMsg = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setTimeout(() => {
            const reply = getBotReply(userMsg);
            setChatMessages(prev => [...prev, { role: 'bot', text: reply }]);
        }, 600);
    }

    const navTabs = [
        { key: 'appointments', label: 'My Appointments', icon: <Calendar size={14} /> },
        { key: 'book', label: 'Book Appointment', icon: <Plus size={14} /> },
        { key: 'prescriptions', label: 'Prescriptions', icon: <Pill size={14} /> },
        { key: 'reports', label: 'Lab Reports', icon: <FlaskConical size={14} /> },
        { key: 'bills', label: 'Bills', icon: <Receipt size={14} /> },
        { key: 'notifications', label: 'Notifications', icon: <Bell size={14} />, badge: unreadCount > 0 ? unreadCount : null },
        { key: 'chatbot', label: 'Health AI', icon: <MessageCircle size={14} /> },
    ] as const;

    const s: React.CSSProperties = { fontFamily: '"Inter", system-ui, sans-serif' };

    return (
        <div style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto', ...s }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                        <div style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Heart size={11} /> PATIENT PORTAL
                        </div>
                        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Welcome, {user?.firstName}!</h1>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Your health records, consultations and reports in one place</div>
                    </div>
                    {/* S2: Live sync indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: syncState.isLive ? 'rgba(63, 138, 102, 0.08)' : 'var(--surface-2)', border: `1px solid ${syncState.isLive ? 'rgba(63, 138, 102, 0.2)' : 'var(--surface-border)'}`, borderRadius: 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: syncState.isLive ? 'var(--risk-low)' : 'var(--surface-3)', animation: syncState.isLive ? 'pulse 2s infinite' : 'none' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: syncState.isLive ? 'var(--risk-low)' : 'var(--text-muted)' }}>
                            {syncState.isLive ? 'Live Updates Active' : 'Syncing...'}
                        </span>
                        {syncState.lastUpdated && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· {syncState.lastUpdated.toLocaleTimeString()}</span>}
                    </div>
                </div>
            </div>

            {/* ── AI Doctor Voice Assistant Banner ── */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(35, 83, 71, 0.18), rgba(22, 56, 50, 0.12))',
                border: '1px solid rgba(35, 83, 71, 0.3)',
                borderRadius: 18, padding: '20px 24px', marginBottom: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', boxShadow: '0 4px 20px rgba(35, 83, 71, 0.35)' }}>
                        🎙️
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            AI Doctor Voice Assistant
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 9999, background: '#6366F125', color: 'var(--accent-primary-hover)', border: '1px solid #6366F140' }}>
                                VOICE AI ACTIVE
                            </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                            Speak directly with your AI Doctor for instant voice triage, symptom consultation, and medical advice.
                        </div>
                    </div>
                </div>
                <button onClick={() => navigate('/ai-doctor')} style={{
                    padding: '11px 22px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))',
                    color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(35, 83, 71, 0.35)', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    Start Voice Consultation ➔
                </button>
            </div>

            {/* Tab nav */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface-1)', padding: 6, borderRadius: 14, border: '1px solid var(--surface-border)', flexWrap: 'wrap' }}>
                {navTabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as any)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px',
                        borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, position: 'relative',
                        background: tab === t.key ? (t.key === 'book' ? 'rgba(63, 138, 102, 0.15)' : 'rgba(35, 83, 71, 0.12)') : 'transparent',
                        color: tab === t.key ? (t.key === 'book' ? 'var(--risk-low)' : 'var(--accent-primary)') : 'var(--text-secondary)',
                        transition: 'all 0.15s',
                    }}>
                        {t.icon} {t.label}
                        {(t as any).badge && (
                            <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: 'var(--risk-critical)', fontSize: 9, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {(t as any).badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ==================== BOOK APPOINTMENT ==================== */}
            {tab === 'book' && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20, padding: 28 }}>
                    <div style={{ marginBottom: 24 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Book an Appointment</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Select a doctor and preferred time. Receptionist will confirm availability.</p>
                    </div>

                    {/* Doctor selection */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Doctor</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                            {doctors.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading doctors...</div>}
                            {doctors.map((doc: any) => (
                                <div key={doc.id}
                                    onClick={() => setBookForm(f => ({ ...f, doctorId: doc.id }))}
                                    style={{
                                        padding: '16px 18px', borderRadius: 14, border: `2px solid ${bookForm.doctorId === doc.id ? 'var(--risk-low)' : 'var(--surface-border)'}`,
                                        background: bookForm.doctorId === doc.id ? 'rgba(63, 138, 102, 0.1)' : 'var(--surface-2)',
                                        cursor: 'pointer', transition: 'all 0.15s',
                                    }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, var(--risk-low), var(--accent-green-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🩺</div>
                                        <div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>Dr. {doc.firstName} {doc.lastName}</div>
                                            <div style={{ fontSize: 12, color: 'var(--risk-low-text)', marginTop: 2 }}>{doc.specialization}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Consultation Fee: ₹{doc.consultationFee?.toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preferred Date</label>
                            <input
                                type="date"
                                value={bookForm.requestedDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setBookForm(f => ({ ...f, requestedDate: e.target.value }))}
                                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--surface-border-md)', background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Slot</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {TIME_SLOTS.map(slot => (
                                    <button key={slot.value}
                                        onClick={() => setBookForm(f => ({ ...f, timeSlot: slot.value }))}
                                        type="button"
                                        style={{
                                            padding: '10px 8px', borderRadius: 10, border: `2px solid ${bookForm.timeSlot === slot.value ? 'var(--risk-low)' : 'var(--surface-border)'}`,
                                            background: bookForm.timeSlot === slot.value ? 'rgba(63, 138, 102, 0.1)' : 'var(--surface-2)',
                                            cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                                        }}>
                                        <div style={{ fontSize: 16 }}>{slot.icon}</div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: bookForm.timeSlot === slot.value ? 'var(--risk-low)' : 'var(--text-secondary)', marginTop: 2 }}>{slot.label}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{slot.time}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Reason */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason for Visit <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                        <textarea
                            value={bookForm.reason}
                            onChange={e => setBookForm(f => ({ ...f, reason: e.target.value }))}
                            placeholder="Briefly describe your symptoms or reason for consultation..."
                            rows={3}
                            style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--surface-border-md)', background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                        />
                    </div>

                    <button
                        onClick={submitBooking}
                        disabled={booking}
                        style={{ padding: '14px 32px', background: booking ? 'rgba(63, 138, 102, 0.4)' : 'linear-gradient(135deg, var(--risk-low), var(--accent-green-dim))', border: 'none', borderRadius: 12, color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, cursor: booking ? 'not-allowed' : 'pointer', opacity: booking ? 0.7 : 1 }}>
                        {booking ? '⏳ Sending request...' : '📅 Send Appointment Request'}
                    </button>
                </div>
            )}

            {/* ==================== MY APPOINTMENTS ==================== */}
            {tab === 'appointments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Consultation history */}
                    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Appointment Requests
                            <button onClick={() => setTab('book')} style={{ fontSize: 12, padding: '6px 14px', background: 'rgba(63, 138, 102, 0.1)', border: '1px solid rgba(63, 138, 102, 0.25)', borderRadius: 8, color: 'var(--risk-low-text)', fontWeight: 700, cursor: 'pointer' }}>
                                + New Request
                            </button>
                        </div>
                        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                            : appointmentRequests.length === 0
                                ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <Calendar size={36} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
                                    No appointment requests yet
                                </div>
                                : appointmentRequests.map((req: any) => {
                                    const sc = STATUS_COLORS[req.status] || { color: 'var(--text-muted)', bg: '#aaa15', label: req.status };
                                    return (
                                        <div key={req.id} style={{ padding: '18px 24px', borderBottom: '1px solid var(--surface-border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>
                                                        Dr. {req.doctor?.firstName} {req.doctor?.lastName}
                                                        <span style={{ fontSize: 12, color: 'var(--risk-low-text)', marginLeft: 8 }}>{req.doctor?.specialization}</span>
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                        Requested: {new Date(req.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {TIME_SLOTS.find(t => t.value === req.timeSlot)?.label}
                                                    </div>
                                                    {req.reason && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>"{req.reason}"</div>}
                                                </div>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>{sc.label}</span>
                                            </div>
                                            {req.status === 'APPROVED' && req.scheduledDate && (
                                                <div style={{ padding: '10px 14px', background: 'rgba(63, 138, 102, 0.08)', border: '1px solid rgba(63, 138, 102, 0.2)', borderRadius: 10, fontSize: 13, color: 'var(--risk-low-text)' }}>
                                                    ✅ Confirmed for {new Date(req.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at {req.scheduledTime}
                                                </div>
                                            )}
                                            {req.status === 'COUNTER_OFFERED' && (
                                                <div style={{ padding: '12px 14px', background: 'rgba(217, 122, 58, 0.08)', border: '1px solid rgba(217, 122, 58, 0.2)', borderRadius: 10 }}>
                                                    <div style={{ fontSize: 13, color: 'var(--risk-high-text)', marginBottom: 10 }}>
                                                        ⏰ Alternative suggested: {req.counterDate ? new Date(req.counterDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : ''} {req.counterTime}
                                                        {req.rejectReason && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Reason: {req.rejectReason}</div>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button onClick={() => respondToCounter(req.id, true)} style={{ padding: '8px 16px', background: 'rgba(63, 138, 102, 0.15)', border: '1px solid rgba(63, 138, 102, 0.3)', borderRadius: 8, color: 'var(--risk-low-text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <CheckCircle size={12} /> Accept New Time
                                                        </button>
                                                        <button onClick={() => respondToCounter(req.id, false)} style={{ padding: '8px 16px', background: 'rgba(200, 67, 75, 0.1)', border: '1px solid rgba(200, 67, 75, 0.25)', borderRadius: 8, color: 'var(--risk-critical-text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <XCircle size={12} /> Decline
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                    </div>

                    {/* Past consultations */}
                    {consultations.length > 0 && (
                        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' }}>
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', fontWeight: 800, color: 'var(--text-primary)' }}>Past Consultations</div>
                            {consultations.map((c: any) => (
                                <div key={c.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>{c.diagnosis || 'General Consultation'}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: c.status === 'COMPLETED' ? 'var(--risk-low)' : 'var(--risk-medium)', background: c.status === 'COMPLETED' ? '#00FF8715' : '#FFD16615', padding: '4px 12px', borderRadius: 20 }}>{c.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ==================== NOTIFICATIONS ==================== */}
            {tab === 'notifications' && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Notifications {unreadCount > 0 && <span style={{ fontSize: 11, padding: '3px 10px', background: 'rgba(200, 67, 75, 0.2)', color: 'var(--risk-critical-text)', borderRadius: 12, fontWeight: 700 }}>{unreadCount} unread</span>}
                        {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 12, padding: '6px 14px', background: 'transparent', border: '1px solid var(--surface-border-md)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer' }}>Mark all read</button>}
                    </div>
                    {notifications.length === 0
                        ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Bell size={36} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />No notifications yet
                        </div>
                        : notifications.map((n: any) => (
                            <div key={n.id} onClick={() => !n.isRead && markNotifRead(n.id)}
                                style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', cursor: !n.isRead ? 'pointer' : 'default', background: !n.isRead ? 'rgba(35, 83, 71, 0.03)' : 'transparent' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', marginTop: 5, flexShrink: 0 }} />}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: !n.isRead ? 700 : 500, color: !n.isRead ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, marginBottom: 3 }}>{n.title}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>{n.message}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><Clock size={10} style={{ display: 'inline', marginRight: 4 }} />{new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                    {n.link && <a href={n.link} style={{ color: 'var(--accent-primary)' }}><ExternalLink size={14} /></a>}
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {/* ==================== PRESCRIPTIONS ==================== */}
            {tab === 'prescriptions' && (
                <div>
                    {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        : consultations.filter((c: any) => c.prescription).length === 0
                            ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-1)', borderRadius: 18, border: '1px solid var(--surface-border)' }}><Pill size={36} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />No prescriptions yet</div>
                            : consultations.filter((c: any) => c.prescription).map((c: any) => (
                                <div key={c.id} style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <div>
                                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 15 }}>Prescription</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(c.prescription.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                        </div>
                                        {c.diagnosis && <div style={{ fontSize: 12, color: 'var(--accent-primary)' }}>Dx: {c.diagnosis}</div>}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                        {c.prescription.items?.map((item: any) => (
                                            <div key={item.id} style={{ background: 'rgba(35, 83, 71, 0.05)', border: '1px solid rgba(35, 83, 71, 0.15)', borderRadius: 12, padding: '12px 14px' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{item.medicineName}</div>
                                                <div style={{ fontSize: 11, color: 'var(--accent-primary)', marginTop: 3 }}>{item.dosage}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.frequency}{item.duration ? ` — ${item.duration}` : ''}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                </div>
            )}

            {/* ==================== LAB REPORTS ==================== */}
            {tab === 'reports' && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', fontWeight: 800, color: 'var(--text-primary)' }}>Your Lab Reports</div>
                    {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        : labTests.length === 0
                            ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}><FlaskConical size={36} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />No lab tests yet</div>
                            : labTests.map((t: any) => (
                                <div key={t.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{t.testType?.replace(/_/g, ' ')}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.testId} · {new Date(t.createdAt).toLocaleDateString()}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: t.status === 'COMPLETED' ? 'var(--risk-low)' : 'var(--risk-medium)', background: t.status === 'COMPLETED' ? '#00FF8715' : '#FFD16615', padding: '4px 12px', borderRadius: 20 }}>{t.status}</span>
                                            {t.reportPdfUrl && <a href={t.reportPdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}><ExternalLink size={13} /> PDF Report</a>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                </div>
            )}

            {/* ==================== BILLS ==================== */}
            {tab === 'bills' && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', fontWeight: 800, color: 'var(--text-primary)' }}>Billing History</div>
                    {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        : invoices.length === 0
                            ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}><Receipt size={36} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />No bills yet</div>
                            : invoices.map((inv: any) => (
                                <div key={inv.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>{inv.invoiceNumber}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(inv.createdAt).toLocaleDateString()} · {inv.items?.length} items</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>₹{inv.totalAmount?.toLocaleString()}</div>
                                        <span style={{ fontSize: 11, color: inv.isPaid ? 'var(--risk-low)' : 'var(--risk-medium)' }}>{inv.isPaid ? `✓ Paid via ${inv.paymentMethod}` : '⏳ Payment Pending'}</span>
                                    </div>
                                </div>
                            ))}
                </div>
            )}

            {/* ==================== CHATBOT ==================== */}
            {tab === 'chatbot' && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, display: 'flex', flexDirection: 'column', height: 540 }}>
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #10b98122, #6366f122)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
                        <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14 }}>MediSense Health Assistant</div>
                            <div style={{ fontSize: 11, color: 'var(--risk-low-text)' }}>● AI Online</div>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {chatMessages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '75%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                    background: msg.role === 'user' ? 'linear-gradient(135deg, var(--risk-low), var(--accent-green-dim))' : 'var(--surface-2)',
                                    border: msg.role === 'user' ? 'none' : '1px solid var(--surface-border)',
                                    color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line',
                                }}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={chatBottomRef} />
                    </div>
                    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--surface-border)', display: 'flex', gap: 10 }}>
                        <input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendChat()}
                            placeholder="Describe your symptoms..."
                            style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid var(--surface-border-md)', background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
                        />
                        <button onClick={sendChat} disabled={!chatInput.trim()} style={{ padding: '11px 18px', background: 'linear-gradient(135deg, var(--risk-low), var(--accent-green-dim))', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', opacity: chatInput.trim() ? 1 : 0.4 }}>
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

