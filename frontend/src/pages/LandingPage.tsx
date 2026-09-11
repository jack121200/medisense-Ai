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

/* ── Waveform SVG — a voice trace, since the AI Doctor is the headline ── */
function VoiceWave() {
    const bars = [10, 20, 34, 46, 30, 52, 38, 22, 44, 58, 40, 26, 16, 30, 20, 12];
    return (
        <svg width="300" height="64" viewBox="0 0 300 64" fill="none" aria-hidden="true" style={{ opacity: 0.85 }}>
            {bars.map((h, i) => (
                <rect
                    key={i}
                    x={i * 19 + 4} y={(64 - h) / 2} width="7" height={h} rx="3.5"
                    fill="var(--sage-400)"
                    opacity={0.28 + (h / 58) * 0.6}
                />
            ))}
        </svg>
    );
}

/* ── Feature card ───────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, color, delay }: {
    icon: string; title: string; desc: string; color: string; delay: number
}) {
    return (
        <div style={{
            background: 'var(--surface-0)',
            border: '1px solid var(--surface-border)',
            borderRadius: 18, padding: '26px 24px',
            position: 'relative', overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
            animation: `fadeUp 0.5s ease-out ${delay}ms both`,
        }}
            onMouseOver={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lg)';
                (e.currentTarget as HTMLDivElement).style.borderColor = color;
            }}
            onMouseOut={e => {
                (e.currentTarget as HTMLDivElement).style.transform = '';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--surface-border)';
            }}
        >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, opacity: 0.85 }} />
            <div style={{ fontSize: 30, marginBottom: 14 }}>{icon}</div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 9 }}>{title}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.72 }}>{desc}</div>
        </div>
    );
}

/* ── Tech pill ──────────────────────────────────────────────────── */
function Pill({ name }: { name: string }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 9999,
            background: 'var(--surface-2)', border: '1px solid var(--surface-border)',
            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
        }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-primary)' }} />
            {name}
        </span>
    );
}

/* ── ML Model card ──────────────────────────────────────────────── */
function MLCard({ name, metric, metricLabel, bar, algo, note, color }: {
    name: string; metric: string; metricLabel: string; bar: number;
    algo: string; note?: string; color: string;
}) {
    return (
        <div style={{
            background: 'var(--surface-0)',
            border: '1px solid var(--surface-border)', borderRadius: 16, padding: '22px 20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex', flexDirection: 'column', gap: 12,
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text-primary)', marginBottom: 3 }}>{name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{algo}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{metric}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>{metricLabel}</div>
                </div>
            </div>
            <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, width: `${bar}%`, background: color }} />
            </div>
            {note && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>{note}</div>}
        </div>
    );
}

/* ── Role card ──────────────────────────────────────────────────── */
function RoleCard({ icon, role, desc, color }: { icon: string; role: string; desc: string; color: string }) {
    return (
        <div style={{
            background: 'var(--surface-0)', border: '1px solid var(--surface-border)',
            borderRadius: 16, padding: '22px 18px', textAlign: 'center',
            boxShadow: 'var(--shadow-sm)',
            transition: 'transform 0.2s, box-shadow 0.2s',
        }}
            onMouseOver={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseOut={e => {
                (e.currentTarget as HTMLDivElement).style.transform = '';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
            }}
        >
            <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
            <div style={{ fontWeight: 800, color, fontSize: 14, marginBottom: 6 }}>{role}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</div>
        </div>
    );
}

/* ── Section heading ────────────────────────────────────────────── */
function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
    return (
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>{eyebrow}</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 42px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', textWrap: 'balance' }}>{title}</h2>
            {sub && <p style={{ color: 'var(--text-secondary)', marginTop: 14, fontSize: 15, maxWidth: 620, margin: '14px auto 0', lineHeight: 1.75 }}>{sub}</p>}
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

    const TERRA  = 'var(--accent-primary)';
    const CLAY   = 'var(--accent-magenta)';
    const GOLD   = 'var(--risk-medium)';
    const SAGE   = 'var(--risk-low)';
    const PLUM   = 'var(--vitals-bp)';

    const features = [
        { icon: '🗣️', title: 'AI Doctor — Voice Consultation', color: TERRA, delay: 0, desc: 'Speak to Priya, an AI health assistant, in Hindi, English or Hinglish. She takes a structured 9-phase OPD-style history, then produces a written assessment for your doctor to review.' },
        { icon: '🌿', title: 'Grounded Ayurvedic Guidance', color: SAGE, delay: 60, desc: 'Advice is retrieved from a curated remedy knowledge base rather than improvised, and every suggestion is screened against your recorded medicines and conditions for interactions.' },
        { icon: '❤️', title: 'Heart Disease Risk Model', color: TERRA, delay: 120, desc: 'An XGBoost model reads 13 clinical parameters — chest pain type, ST depression, thalassemia, ECG findings — and returns a risk probability with per-feature importance.' },
        { icon: '🩸', title: 'CBC Blood Analyzer', color: CLAY, delay: 180, desc: 'Enter or upload a blood report. 20 CBC parameters are checked against reference ranges, with unsupervised anomaly detection flagging unusual overall patterns.' },
        { icon: '🧠', title: 'Symptom Checker', color: PLUM, delay: 240, desc: 'Describe what you are feeling and get the most probable conditions ranked by confidence, as a starting point for a real consultation — never as a diagnosis.' },
        { icon: '📉', title: 'ECG Beat Screening', color: GOLD, delay: 300, desc: 'A supervised 1D-CNN trained on labelled normal and abnormal beats from the PhysioNet MIT-BIH database, evaluated on patients it never saw in training. A screening aid that surfaces beats for review, not an arrhythmia classifier.' },
        { icon: '🚨', title: 'Real Clinical Escalation', color: TERRA, delay: 360, desc: 'Emergency phrases in a consultation trigger a real alert on the clinical dashboard over websockets — not just a line of text buried in a report.' },
        { icon: '🏥', title: 'Full Hospital Workflow', color: GOLD, delay: 420, desc: 'Appointments, billing, prescriptions, lab orders and role-based dashboards for doctors, receptionists, lab technicians and patients — all behind ownership-checked access control.' },
    ];

    /* Metrics below are read straight from ml-service/models_manifest.json.
       They are reported as measured, including the weak one — an inflated
       number on a landing page is the fastest way to lose a viva. */
    const mlModels = [
        {
            name: 'Heart Disease Risk', algo: 'XGBoost · 1,025 records', color: TERRA,
            metric: '0.99', metricLabel: 'ROC-AUC', bar: 99,
            note: '95.5% accuracy, 98% sensitivity at the tuned threshold.',
        },
        {
            name: 'Symptom Checker', algo: 'Random Forest · 4,920 rows', color: PLUM,
            metric: '100%', metricLabel: 'benchmark acc.', bar: 100,
            note: 'The public dataset is perfectly separable — this reflects clean-case performance, not real-world ambiguity.',
        },
        {
            name: 'Bayesian Risk Engine', algo: 'pgmpy · 7-node DAG', color: CLAY,
            metric: '1,025', metricLabel: 'records fit', bar: 82,
            note: 'Every conditional probability is estimated from data, not hand-picked.',
        },
        {
            name: 'CBC Analyzer', algo: 'IsolationForest + KMeans', color: GOLD,
            metric: '416', metricLabel: 'samples', bar: 70,
            note: 'Unsupervised — cluster severity is recomputed each training run.',
        },
        {
            name: 'ECG Beat Screen', algo: 'Supervised 1D-CNN ensemble · MIT-BIH', color: SAGE,
            metric: '0.82', metricLabel: 'ROC-AUC', bar: 82,
            note: 'Scored once on 22 patients it never saw. Catches 62% of ventricular beats at under 1% false alarms; misses supraventricular ones, which a single beat cannot show.',
        },
    ];

    const roles = [
        { icon: '👤', role: 'Patient', color: SAGE, desc: 'Talk to the AI Doctor, view your reports, risk level, appointments and prescriptions.' },
        { icon: '🩺', role: 'Doctor', color: TERRA, desc: 'Clinical dashboard, AI tools, consultation notes, and every AI Doctor call your patient made.' },
        { icon: '📋', role: 'Receptionist', color: GOLD, desc: 'Register patients, approve appointment requests, and manage billing and scheduling.' },
        { icon: '🔬', role: 'Lab Technician', color: PLUM, desc: 'Accept lab orders, upload results, and push flagged findings to the assigned doctor.' },
    ];

    const stats = [
        { val: 5, suffix: '', label: 'Trained ML Models' },
        { val: 22165, suffix: '', label: 'ECG Beats Trained On' },
        { val: 4920, suffix: '', label: 'Symptom Records' },
        { val: 3, suffix: '', label: 'Languages Spoken' },
    ];

    const techLayers = [
        { label: 'Frontend', items: ['React 18', 'TypeScript', 'Vite', 'Zustand'] },
        { label: 'Backend', items: ['Node.js', 'Prisma ORM', 'PostgreSQL', 'Redis', 'JWT + RBAC'] },
        { label: 'AI / ML', items: ['Python FastAPI', 'scikit-learn', 'XGBoost', 'PyTorch', 'pgmpy', 'TF-IDF RAG'] },
        { label: 'Voice & Infra', items: ['Vapi', 'Groq', 'Deepgram', 'Docker', 'Socket.IO', 'Nginx'] },
    ];

    const btnPrimary: React.CSSProperties = {
        padding: '14px 32px', borderRadius: 12, border: 'none',
        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))',
        color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(35, 83, 71, 0.28)', transition: 'all 0.2s',
    };
    const btnSecondary: React.CSSProperties = {
        padding: '14px 32px', borderRadius: 12,
        border: '1px solid var(--surface-border-md)',
        background: 'var(--surface-0)',
        color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
        transition: 'all 0.2s',
    };

    // Controls on the dark bands. The nav floats over the hero until scrolled,
    // then becomes a light glass bar — so it needs both a dark and light set.
    const navBase: React.CSSProperties = { padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'var(--font-body)' };
    const navGhostDark: React.CSSProperties = { ...navBase, background: 'transparent', color: 'var(--mint-100)', border: '1px solid rgba(218, 241, 222, 0.28)' };
    const navSolidDark: React.CSSProperties = { ...navBase, background: 'var(--mint-100)', color: 'var(--forest-900)', border: '1px solid var(--mint-100)' };
    const navGhostLight: React.CSSProperties = { ...navBase, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--surface-border-md)' };
    const navSolidLight: React.CSSProperties = { ...navBase, background: 'var(--accent-primary)', color: '#fff', border: '1px solid var(--accent-primary)' };
    const heroPrimary: React.CSSProperties = { padding: '15px 34px', borderRadius: 12, border: 'none', background: 'var(--mint-100)', color: 'var(--forest-900)', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 28px rgba(142, 182, 155, 0.25)', transition: 'transform 0.2s ease', fontFamily: 'var(--font-body)' };
    const heroSecondary: React.CSSProperties = { padding: '15px 34px', borderRadius: 12, border: '1px solid rgba(218, 241, 222, 0.32)', background: 'rgba(218, 241, 222, 0.06)', color: 'var(--mint-100)', fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'background 0.2s ease', fontFamily: 'var(--font-body)' };

    return (
        <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', overflowX: 'hidden' }}>

            {/* ── NAVBAR ── */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
                padding: '0 clamp(20px, 4vw, 48px)', height: 66,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: scrolled ? 'var(--bg-glass)' : 'transparent',
                backdropFilter: scrolled ? 'blur(20px)' : 'none',
                borderBottom: scrolled ? '1px solid var(--surface-border)' : '1px solid transparent',
                transition: 'all 0.3s ease',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, var(--sage-400), var(--forest-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🩺</div>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, letterSpacing: '-0.03em', color: scrolled ? 'var(--text-primary)' : 'var(--mint-100)', transition: 'color 0.3s ease' }}>
                        MediSense <span style={{ color: scrolled ? 'var(--accent-primary)' : 'var(--sage-400)' }}>AI</span>
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => navigate('/login')} style={scrolled ? navGhostLight : navGhostDark}>Sign In</button>
                    <button onClick={() => navigate('/register')} style={scrolled ? navSolidLight : navSolidDark}>Register →</button>
                </div>
            </nav>

            {/* ── HERO — the dark half of the palette ── */}
            <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '150px clamp(20px, 5vw, 40px) 96px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, var(--forest-900) 0%, var(--forest-800) 60%, var(--forest-700) 100%)' }}>
                <div style={{ position: 'absolute', top: '-8%', left: '4%', width: 640, height: 640, maxWidth: '100%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(142, 182, 155, 0.14) 0%, transparent 64%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-12%', right: '2%', width: 520, height: 520, maxWidth: '100%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(35, 83, 71, 0.55) 0%, transparent 66%)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 16px', borderRadius: 9999, background: 'rgba(142, 182, 155, 0.12)', border: '1px solid rgba(142, 182, 155, 0.30)', fontSize: 11.5, fontWeight: 700, color: 'var(--mint-100)', marginBottom: 32, letterSpacing: '0.06em', animation: 'fadeUp 0.4s ease-out both' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sage-400)', boxShadow: '0 0 10px var(--sage-400)' }} className="live-dot" />
                    AI-ASSISTED HEALTHCARE PLATFORM
                </div>

                <h1 style={{ position: 'relative', fontSize: 'clamp(40px, 6.6vw, 80px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.035em', marginBottom: 24, maxWidth: 920, color: 'var(--mint-100)', animation: 'fadeUp 0.5s ease-out 80ms both' }}>
                    Healthcare that listens —{' '}
                    <span style={{ color: 'var(--sage-400)' }}>in your own language</span>
                </h1>

                <div style={{ position: 'relative', marginBottom: 22, animation: 'fadeUp 0.5s ease-out 120ms both' }}>
                    <VoiceWave />
                </div>

                <p style={{ position: 'relative', maxWidth: 640, fontSize: 17, color: 'rgba(218, 241, 222, 0.78)', lineHeight: 1.8, marginBottom: 38, animation: 'fadeUp 0.5s ease-out 160ms both' }}>
                    MediSense AI pairs a <strong style={{ color: 'var(--mint-100)' }}>Hindi-speaking AI health assistant</strong> with{' '}
                    <strong style={{ color: 'var(--mint-100)' }}>five trained clinical ML models</strong> and a complete hospital
                    workflow — so a patient can simply describe how they feel, and their doctor receives a structured, reviewable assessment.
                </p>

                <div style={{ position: 'relative', display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeUp 0.5s ease-out 240ms both' }}>
                    <button onClick={() => navigate('/register')} style={heroPrimary}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
                    >
                        Get Started — It's Free
                    </button>
                    <button onClick={() => navigate('/login')} style={heroSecondary}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(218, 241, 222, 0.12)'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(218, 241, 222, 0.06)'; }}
                    >
                        Sign In ↗
                    </button>
                </div>

                <div style={{ position: 'relative', display: 'flex', gap: 'clamp(24px, 5vw, 56px)', marginTop: 64, paddingTop: 36, borderTop: '1px solid rgba(142, 182, 155, 0.16)', flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeUp 0.5s ease-out 320ms both' }}>
                    {stats.map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 600, color: 'var(--sage-400)', fontFamily: 'var(--font-mono)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                                <Counter to={s.val} suffix={s.suffix} />
                            </div>
                            <div style={{ fontSize: 11, color: '#8FAE9C', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section style={{ padding: '72px clamp(20px, 5vw, 40px)', maxWidth: 1180, margin: '0 auto' }}>
                <SectionHead
                    eyebrow="How it works"
                    title="From a spoken symptom to a doctor's desk"
                    sub="Three steps, each one leaving a record a clinician can actually audit."
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                    {[
                        { n: '01', color: TERRA, title: 'Describe how you feel', desc: 'Start a voice call and talk normally in Hindi, English or Hinglish. Priya asks one question at a time and works through a structured clinical history — complaint, duration, past illness, medicines, lifestyle, diet.' },
                        { n: '02', color: SAGE, title: 'The system checks its own advice', desc: 'Remedies are retrieved from a curated knowledge base, screened against your recorded medicines for interactions, and the transcript is scanned for emergency red flags independently of the model.' },
                        { n: '03', color: CLAY, title: 'Your doctor gets a real report', desc: 'A structured assessment — summary, possible conditions, suggested actions, red flags and urgency — lands on the clinician dashboard, downloadable as a PDF. Anything urgent raises a live alert.' },
                    ].map(item => (
                        <div key={item.n} style={{ background: 'var(--surface-0)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: '28px 24px', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: item.color, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 14 }}>{item.n}</div>
                            <h3 style={{ fontWeight: 800, fontSize: 16.5, color: 'var(--text-primary)', marginBottom: 10 }}>{item.title}</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.76 }}>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section style={{ padding: '72px clamp(20px, 5vw, 40px)', maxWidth: 1180, margin: '0 auto' }}>
                <SectionHead eyebrow="Core features" title="What the platform actually does" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(275px, 1fr))', gap: 18 }}>
                    {features.map(f => <FeatureCard key={f.title} {...f} />)}
                </div>
            </section>

            {/* ── ML MODELS ── */}
            <section style={{ padding: '72px clamp(20px, 5vw, 40px)', background: 'var(--bg-secondary)', borderTop: '1px solid var(--surface-border)', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ maxWidth: 1180, margin: '0 auto' }}>
                    <SectionHead
                        eyebrow="Machine learning"
                        title="Five real models, reported honestly"
                        sub="Every number below is read from the training manifest, including the model that underperforms. Nothing here is a placeholder or a hardcoded score."
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))', gap: 18 }}>
                        {mlModels.map(m => <MLCard key={m.name} {...m} />)}
                    </div>
                    <p style={{ marginTop: 26, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 780, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
                        These models support clinical decisions — they do not make them. Every output is framed as a suggestion for a
                        qualified doctor to review, and none of them is a licensed diagnostic device.
                    </p>
                </div>
            </section>

            {/* ── ROLES ── */}
            <section style={{ padding: '72px clamp(20px, 5vw, 40px)', maxWidth: 1080, margin: '0 auto' }}>
                <SectionHead eyebrow="User roles" title="One platform, four points of view" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: 18 }}>
                    {roles.map(r => <RoleCard key={r.role} {...r} />)}
                </div>
            </section>

            {/* ── TECH STACK ── */}
            <section style={{ padding: '72px clamp(20px, 5vw, 40px)', background: 'var(--bg-secondary)', borderTop: '1px solid var(--surface-border)', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ maxWidth: 1080, margin: '0 auto' }}>
                    <SectionHead eyebrow="Technology" title="How it is built" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))', gap: 18 }}>
                        {techLayers.map(layer => (
                            <div key={layer.label} style={{ background: 'var(--surface-0)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: '20px 18px', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.11em', marginBottom: 14 }}>{layer.label}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {layer.items.map(i => <Pill key={i} name={i} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA — back to the dark half, bookending the light middle ── */}
            <section style={{ padding: 'clamp(76px, 10vw, 110px) clamp(20px, 5vw, 40px)', textAlign: 'center', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, var(--forest-700) 0%, var(--forest-800) 55%, var(--forest-900) 100%)' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 880, maxWidth: '100%', height: 440, borderRadius: '50%', background: 'radial-gradient(circle, rgba(142, 182, 155, 0.14) 0%, transparent 66%)', pointerEvents: 'none' }} />
                <h2 style={{ fontSize: 'clamp(32px, 4.8vw, 58px)', fontWeight: 800, letterSpacing: '-0.035em', marginBottom: 20, position: 'relative', color: 'var(--mint-100)' }}>
                    Start with a conversation
                </h2>
                <p style={{ color: 'rgba(218, 241, 222, 0.75)', fontSize: 16, marginBottom: 38, maxWidth: 540, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.75, position: 'relative' }}>
                    Register as a patient, doctor, receptionist or lab technician and explore the full platform.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
                    <button onClick={() => navigate('/register')} style={{ ...heroPrimary, padding: '16px 42px', fontSize: 16 }}>
                        Create an Account
                    </button>
                    <button onClick={() => navigate('/login')} style={{ ...heroSecondary, padding: '16px 42px', fontSize: 16 }}>
                        Sign In →
                    </button>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer style={{ background: 'var(--forest-900)', borderTop: '1px solid rgba(142, 182, 155, 0.12)', padding: '32px clamp(20px, 5vw, 48px)' }}>
                <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg, var(--sage-400), var(--forest-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🩺</div>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--mint-100)', letterSpacing: '-0.02em' }}>MediSense AI</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8FAE9C' }}>
                        React · Node.js · FastAPI · PyTorch · Docker
                    </div>
                </div>
                <div style={{ maxWidth: 1180, margin: '20px auto 0', paddingTop: 18, borderTop: '1px solid rgba(142, 182, 155, 0.12)', fontSize: 11.5, color: '#8FAE9C', lineHeight: 1.7 }}>
                    <strong style={{ color: 'var(--mint-100)' }}>Medical disclaimer:</strong> MediSense AI is an academic project.
                    It is not a licensed medical device and does not provide medical diagnosis. The AI health assistant is not a doctor.
                    Always consult a qualified physician before acting on anything you read here. In an emergency in India, call 108.
                </div>
            </footer>

            <style>{`
                @keyframes fadeUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }
            `}</style>
        </div>
    );
}
