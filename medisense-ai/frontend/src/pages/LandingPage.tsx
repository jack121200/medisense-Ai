import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── Animated counter ───────────────────────────────────────────── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
    const [val, setVal] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => {
            if (!e.isIntersecting) return;
            obs.disconnect();
            let start = 0;
            const step = to / 60;
            const id = setInterval(() => {
                start += step;
                if (start >= to) { setVal(to); clearInterval(id); }
                else setVal(Math.floor(start));
            }, 16);
        });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [to]);
    return <div ref={ref}>{val.toLocaleString()}{suffix}</div>;
}

/* ── Heartbeat SVG ──────────────────────────────────────────────── */
function HeartbeatLine() {
    return (
        <svg width="280" height="60" viewBox="0 0 280 60" fill="none" style={{ opacity: 0.6 }}>
            <polyline
                points="0,30 40,30 55,8 70,52 85,8 100,52 115,30 160,30 175,15 190,45 205,30 280,30"
                stroke="#E63946" strokeWidth="2.5" fill="none"
                strokeLinecap="round" strokeLinejoin="round"
            />
        </svg>
    );
}

/* ── Feature card ───────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, color, delay }: {
    icon: string; title: string; desc: string; color: string; delay: number
}) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: `1px solid ${color}25`,
            borderRadius: 20, padding: '28px 24px',
            position: 'relative', overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
            animation: `fadeUp 0.5s ease-out ${delay}ms both`,
            cursor: 'default',
        }}
            onMouseOver={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-5px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 24px 60px ${color}20`;
                (e.currentTarget as HTMLDivElement).style.border = `1px solid ${color}45`;
            }}
            onMouseOut={e => {
                (e.currentTarget as HTMLDivElement).style.transform = '';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                (e.currentTarget as HTMLDivElement).style.border = `1px solid ${color}25`;
            }}
        >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
            <div style={{ fontSize: 38, marginBottom: 16 }}>{icon}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75 }}>{desc}</div>
        </div>
    );
}

/* ── Tech pill ──────────────────────────────────────────────────── */
function Pill({ name, color }: { name: string; color: string }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 13px', borderRadius: 9999,
            background: `${color}12`, border: `1px solid ${color}30`,
            fontSize: 12, fontWeight: 700, color,
        }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
            {name}
        </span>
    );
}

/* ── ML Model card ──────────────────────────────────────────────── */
function MLCard({ name, accuracy, desc, color, icon }: {
    name: string; accuracy: number; desc: string; color: string; icon: string
}) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: `1px solid ${color}25`, borderRadius: 18, padding: '24px 22px',
            transition: 'transform 0.2s',
        }}
            onMouseOver={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'}
            onMouseOut={e => (e.currentTarget as HTMLDivElement).style.transform = ''}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 3 }}>{name}</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)' }}>{desc}</div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {accuracy}%
                </div>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                <div style={{ height: '100%', borderRadius: 4, width: `${accuracy}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, transition: 'width 1.5s ease' }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>Model accuracy on validation set</div>
        </div>
    );
}

/* ── Role card ──────────────────────────────────────────────────── */
function RoleCard({ icon, role, desc, color }: { icon: string; role: string; desc: string; color: string }) {
    return (
        <div style={{
            background: `${color}08`, border: `1px solid ${color}20`,
            borderRadius: 16, padding: '22px 18px', textAlign: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
        }}
            onMouseOver={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 16px 40px ${color}15`;
            }}
            onMouseOut={e => {
                (e.currentTarget as HTMLDivElement).style.transform = '';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '';
            }}
        >
            <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
            <div style={{ fontWeight: 800, color, fontSize: 14, marginBottom: 6 }}>{role}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{desc}</div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 60);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const CRIMSON  = '#E63946';
    const ROSE     = '#FF6B6B';
    const GOLD     = '#FFD166';
    const TEAL     = '#06D6A0';
    const LAVENDER = '#C77DFF';
    const BG       = '#0A0A0F';

    const features = [
        { icon: '❤️', title: 'Heart Disease Risk AI', color: CRIMSON, delay: 0, desc: 'AI analyses 14 clinical cardiac parameters — BP, cholesterol, ECG, angina, ST depression, thalassemia — and predicts LOW / MEDIUM / HIGH disease risk with 89%+ accuracy.' },
        { icon: '🩸', title: 'CBC Blood Analyzer', color: ROSE, delay: 80, desc: 'Upload or enter 15 CBC parameters. AI flags abnormal values with HIGH/LOW status, deviation%, and clinical cardiac interpretations — platelets, hemoglobin and more.' },
        { icon: '🧠', title: 'AI Symptom Checker', color: LAVENDER, delay: 160, desc: 'Describe cardiac and general symptoms. The AI Symptom Checker predicts the most likely condition from 134 symptom combinations with confidence percentages.' },
        { icon: '📅', title: 'Appointment Management', color: GOLD, delay: 240, desc: 'Book, reschedule and track cardiology appointments. Priority scheduling for HIGH risk patients. Receptionists manage the full workflow for multiple cardiac specialists.' },
        { icon: '🚨', title: 'Smart Cardiac Alerts', color: CRIMSON, delay: 320, desc: 'Real-time alerts for high-risk cardiac patients pushed to doctors instantly. Color-coded severity (CRITICAL/HIGH/MEDIUM) with automatic notification drawer.' },
        { icon: '📈', title: 'Clinical Analytics', color: TEAL, delay: 400, desc: 'Track cardiac population risk distribution, appointment trends, CBC anomaly rates, and heart disease prevalence across your patient cohort in real-time charts.' },
        { icon: '👤', title: 'Patient Management', color: GOLD, delay: 480, desc: 'Full cardiac patient profiles with medical history, comorbidities (Diabetes, HTN, CKD), medications, emergency contacts, previous ECG reports and risk scores.' },
        { icon: '🔬', title: 'Lab Report Workflow', color: TEAL, delay: 560, desc: 'Lab technicians upload CBC and other blood reports. System auto-analyzes values, flags critical findings, and notifies cardiologists immediately for urgent review.' },
    ];

    const mlModels = [
        { name: 'Heart Disease Risk AI', accuracy: 89.4, desc: 'Best of RF / XGBoost / LR — HeartDiseaseTrain.csv', color: CRIMSON, icon: '❤️' },
        { name: 'CBC Anomaly Detector',  accuracy: 95.0, desc: 'Isolation Forest — 500 CBC patient records', color: ROSE,    icon: '🩸' },
        { name: 'AI Symptom Checker',    accuracy: 96.2, desc: 'Random Forest — 134 symptom combinations', color: LAVENDER, icon: '🧠' },
    ];

    const roles = [
        { icon: '👤', role: 'Patient',      color: TEAL,     desc: 'View your heart risk badge, CBC report summary, appointments and health timeline.' },
        { icon: '🫀', role: 'Cardiologist', color: CRIMSON,  desc: 'Full clinical dashboard, risk analysis tools, consultation notes and patient AI insights.' },
        { icon: '📋', role: 'Receptionist', color: GOLD,     desc: 'Register patients, book appointments, view risk priority queue for scheduling.' },
        { icon: '🔬', role: 'Lab Tech',     color: LAVENDER, desc: 'Upload blood reports, run CBC analysis, forward flagged results to the assigned doctor.' },
    ];

    const stats = [
        { val: 1025, suffix: '', label: 'Heart Patients Trained On', color: CRIMSON },
        { val: 3,    suffix: '', label: 'AI Models Active',           color: ROSE },
        { val: 14,   suffix: '', label: 'Cardiac Features Analyzed',  color: GOLD },
        { val: 15,   suffix: '+', label: 'CBC Parameters Checked',   color: TEAL },
    ];

    const techLayers = [
        { label: 'Frontend',  items: [{ name: 'React 18', color: '#61DAFB' }, { name: 'TypeScript', color: '#3178C6' }, { name: 'Vite', color: '#646CFF' }, { name: 'Zustand', color: ROSE }] },
        { label: 'Backend',   items: [{ name: 'Node.js', color: '#68A063' }, { name: 'Prisma ORM', color: '#2D3748' }, { name: 'PostgreSQL', color: '#336791' }, { name: 'JWT Auth', color: CRIMSON }] },
        { label: 'AI / ML',   items: [{ name: 'Python FastAPI', color: '#009688' }, { name: 'Scikit-learn', color: '#F7931E' }, { name: 'XGBoost', color: '#22C55E' }, { name: 'Isolation Forest', color: LAVENDER }] },
        { label: 'Infra',     items: [{ name: 'Docker', color: '#2496ED' }, { name: 'Redis', color: '#DC382D' }, { name: 'Socket.IO', color: '#aaa' }, { name: 'Nginx', color: '#009900' }] },
    ];

    const btnPrimary: React.CSSProperties = {
        padding: '14px 36px', borderRadius: 14, border: 'none',
        background: `linear-gradient(135deg, ${CRIMSON}, #C1121F)`,
        color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer',
        boxShadow: `0 8px 40px ${CRIMSON}35`, transition: 'all 0.2s',
    };
    const btnSecondary: React.CSSProperties = {
        padding: '14px 36px', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(255,255,255,0.04)',
        color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
        transition: 'all 0.2s',
    };

    return (
        <div style={{ background: BG, color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden' }}>

            {/* ── NAVBAR ── */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
                padding: '0 48px', height: 66,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: scrolled ? 'rgba(10,10,15,0.94)' : 'transparent',
                backdropFilter: scrolled ? 'blur(24px)' : 'none',
                borderBottom: scrolled ? '1px solid rgba(230,57,70,0.15)' : 'none',
                transition: 'all 0.3s ease',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${CRIMSON}, #A4161A)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🫀</div>
                    <span style={{ fontWeight: 900, fontSize: 19, letterSpacing: '-0.02em', background: `linear-gradient(90deg, ${CRIMSON}, ${ROSE})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CardioSense AI</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => navigate('/login')} style={{ padding: '8px 22px', borderRadius: 10, border: `1px solid ${CRIMSON}35`, background: `${CRIMSON}0A`, color: CRIMSON, fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = `${CRIMSON}20`}
                        onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = `${CRIMSON}0A`}
                    >Sign In</button>
                    <button onClick={() => navigate('/register')} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${CRIMSON}, #C1121F)`, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                        Register →
                    </button>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '130px 40px 80px', position: 'relative', overflow: 'hidden' }}>
                {/* Glow orbs */}
                <div style={{ position: 'absolute', top: '15%', left: '10%', width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle, ${CRIMSON}08 0%, transparent 65%)`, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '10%', right: '8%', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${ROSE}06 0%, transparent 65%)`, pointerEvents: 'none' }} />

                {/* Badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 18px', borderRadius: 9999, background: `${CRIMSON}10`, border: `1px solid ${CRIMSON}25`, fontSize: 12, fontWeight: 700, color: CRIMSON, marginBottom: 36, animation: 'fadeUp 0.4s ease-out both' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: CRIMSON, boxShadow: `0 0 10px ${CRIMSON}`, animation: 'pulse 1.5s infinite' }} />
                    DEDICATED CARDIOLOGY HOSPITAL — AI POWERED
                </div>

                <h1 style={{ fontSize: 'clamp(44px, 7.5vw, 90px)', fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.03em', marginBottom: 26, animation: 'fadeUp 0.5s ease-out 80ms both' }}>
                    <span style={{ background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.75) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Advanced Cardiac Care,</span>
                    <br />
                    <span style={{ background: `linear-gradient(135deg, ${CRIMSON}, ${ROSE})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Powered by AI</span>
                </h1>

                {/* Heartbeat line */}
                <div style={{ marginBottom: 24, animation: 'fadeUp 0.5s ease-out 120ms both' }}>
                    <HeartbeatLine />
                </div>

                <p style={{ maxWidth: 620, fontSize: 17.5, color: 'rgba(255,255,255,0.52)', lineHeight: 1.8, marginBottom: 44, animation: 'fadeUp 0.5s ease-out 160ms both' }}>
                    CardioSense AI is a full-stack cardiac hospital management platform combining <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Heart Disease Risk AI</strong>, <strong style={{ color: 'rgba(255,255,255,0.8)' }}>CBC Blood Analyzer</strong>, and <strong style={{ color: 'rgba(255,255,255,0.8)' }}>AI Symptom Checker</strong> — built exclusively for heart patients.
                </p>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeUp 0.5s ease-out 240ms both' }}>
                    <button onClick={() => navigate('/register')}
                        style={btnPrimary}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 14px 50px ${CRIMSON}50`; }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 40px ${CRIMSON}35`; }}
                    >
                        🫀 Register — Get Started
                    </button>
                    <button onClick={() => navigate('/login')} style={btnSecondary}
                        onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'}
                        onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'}
                    >
                        Sign In ↗
                    </button>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 52, marginTop: 76, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeUp 0.5s ease-out 320ms both' }}>
                    {stats.map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 42, fontWeight: 900, color: s.color, fontFamily: 'monospace', lineHeight: 1 }}>
                                <Counter to={s.val} suffix={s.suffix} />
                            </div>
                            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.38)', marginTop: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── WHAT WE DO ── */}
            <section style={{ padding: '80px 40px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: CRIMSON, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>THE PLATFORM</div>
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-0.02em' }}>Built For Heart Patients</h2>
                    <p style={{ color: 'rgba(255,255,255,0.42)', marginTop: 16, fontSize: 15, maxWidth: 560, margin: '16px auto 0', lineHeight: 1.75 }}>
                        Every feature is purpose-built for cardiac care — from AI-driven risk scores to CBC blood analysis for your cardiologist.
                    </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 22 }}>
                    {[
                        { icon: '🫀', color: CRIMSON, title: 'Cardiac Risk Intelligence', desc: 'Our Heart Disease Risk AI analyses 14 clinical parameters — chest pain type, ST depression, thalassemia, ECG readings — and assigns every patient a precise risk probability.' },
                        { icon: '🩸', color: ROSE,    title: 'Smart CBC Interpretation', desc: 'Lab technicians upload blood reports. Every CBC value is instantly checked against clinical reference ranges, anomalies flagged, and cardiac implications highlighted for the doctor.' },
                        { icon: '🔔', color: GOLD,    title: 'Doctor-First Workflow', desc: 'Cardiologists see their high-risk patients first. Real-time alerts, AI-generated consultation summaries, and one-click access to complete cardiac history for every appointment.' },
                    ].map(item => (
                        <div key={item.title} style={{ background: `${item.color}05`, border: `1px solid ${item.color}15`, borderRadius: 20, padding: '32px 28px' }}>
                            <div style={{ fontSize: 34, marginBottom: 16 }}>{item.icon}</div>
                            <h3 style={{ fontWeight: 800, fontSize: 17, color: item.color, marginBottom: 12 }}>{item.title}</h3>
                            <p style={{ color: 'rgba(255,255,255,0.48)', fontSize: 13.5, lineHeight: 1.78 }}>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section style={{ padding: '80px 40px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: ROSE, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>CORE FEATURES</div>
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-0.02em' }}>Everything a Cardiac Hospital Needs</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
                    {features.map(f => <FeatureCard key={f.title} {...f} />)}
                </div>
            </section>

            {/* ── ML MODELS ── */}
            <section style={{ padding: '80px 40px', background: `${CRIMSON}04`, borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: CRIMSON, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>MACHINE LEARNING</div>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-0.02em' }}>AI at the Core of Cardiology</h2>
                        <p style={{ color: 'rgba(255,255,255,0.38)', marginTop: 14, fontSize: 15, maxWidth: 520, margin: '14px auto 0' }}>
                            3 specialized models trained on real cardiac datasets. Each built for a different clinical prediction task.
                        </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22 }}>
                        {mlModels.map(m => <MLCard key={m.name} {...m} />)}
                    </div>
                </div>
            </section>

            {/* ── WHO IS THIS FOR ── */}
            <section style={{ padding: '80px 40px', maxWidth: 1100, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 52 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>USER ROLES</div>
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-0.02em' }}>Built for Every Role</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
                    {roles.map(r => <RoleCard key={r.role} {...r} />)}
                </div>
            </section>

            {/* ── TECH STACK ── */}
            <section style={{ padding: '80px 40px', background: `${TEAL}03`, borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 50 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>TECHNOLOGY STACK</div>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 900, letterSpacing: '-0.02em' }}>Built With the Best</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
                        {techLayers.map(layer => (
                            <div key={layer.label} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '22px 18px' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>{layer.label}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {layer.items.map(i => <Pill key={i.name} name={i.name} color={i.color} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section style={{ padding: '110px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 900, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${CRIMSON}07 0%, transparent 65%)`, pointerEvents: 'none' }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20 }}>● SYSTEM ONLINE</div>
                <h2 style={{ fontSize: 'clamp(32px, 5vw, 62px)', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 22 }}>
                    Ready to Protect<br />
                    <span style={{ background: `linear-gradient(135deg, ${CRIMSON}, ${ROSE})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Every Heart?</span>
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 16, marginBottom: 44 }}>
                    Join CardioSense AI — register as a patient, cardiologist, receptionist, or lab technician.
                </p>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => navigate('/register')}
                        style={{ ...btnPrimary, padding: '16px 48px', fontSize: 16 }}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
                    >
                        🫀 Register Now
                    </button>
                    <button onClick={() => navigate('/login')} style={{ ...btnSecondary, padding: '16px 48px', fontSize: 16 }}>
                        Sign In →
                    </button>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '28px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${CRIMSON}, #A4161A)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🫀</div>
                    <span style={{ fontWeight: 800, fontSize: 14.5, color: 'rgba(255,255,255,0.6)' }}>CardioSense AI</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)' }}>
                    React · Node.js · Python FastAPI · Scikit-learn · XGBoost · Docker
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)' }}>
                    Dedicated Cardiology Hospital Platform
                </div>
            </footer>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:none; } }
                @keyframes pulse { 0%,100% { opacity:1; box-shadow:0 0 10px ${CRIMSON}; } 50% { opacity:0.4; box-shadow:0 0 3px ${CRIMSON}; } }
                html { scroll-behavior: smooth; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
            `}</style>
        </div>
    );
}
