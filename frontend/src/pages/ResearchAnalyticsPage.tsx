import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { FlaskConical, BarChart3, ChevronRight, AlertCircle, CheckCircle, Info } from 'lucide-react';
import api from '../api/axiosInstance';

import { tint } from '../utils/tint';
const C = {
    crimson: 'var(--accent-primary)', rose: 'var(--accent-primary-hover)', gold: 'var(--risk-medium)',
    teal: 'var(--risk-low)', lavender: 'var(--vitals-bp)', blue: '#256876',
    bg: 'var(--surface-1)', border: 'var(--surface-border)',
};

// ── HYPOTHESIS TEST QUESTIONS ────────────────────────────────────────────────
const QUESTIONS = [
    {
        id: 1,
        label: 'High BP vs Heart Disease Rate',
        desc: 'Do patients with high resting blood pressure have significantly higher heart disease rates than patients with normal BP?',
        test: 'chi2',
        groupA: 'High BP (>130)',
        groupB: 'Normal BP (≤130)',
    },
    {
        id: 2,
        label: 'Gender vs Heart Disease Rate',
        desc: 'Is the heart disease rate significantly different between male and female patients?',
        test: 'chi2',
        groupA: 'Male Patients',
        groupB: 'Female Patients',
    },
    {
        id: 3,
        label: 'High Cholesterol vs Max Heart Rate',
        desc: 'Do patients with cholesterol above 240 have a significantly lower max heart rate than patients with normal cholesterol?',
        test: 'ttest',
        groupA: 'Cholesterol >240',
        groupB: 'Normal Cholesterol',
    },
    {
        id: 4,
        label: 'Age Group vs Cardiac Risk Score',
        desc: 'Is there a significant difference in cardiac risk scores between patients above and below age 55?',
        test: 'ttest',
        groupA: 'Age > 55',
        groupB: 'Age ≤ 55',
    },
];

// ── Hypothesis Test — via backend proxy ─────────────────────────────────────
async function runHypothesisTest(questionId: number) {
    const res = await api.get(`/ml/hypothesis-test?question=${questionId}`);
    return res.data;
}

// ── Big Data Analytics — via backend proxy ───────────────────────────────────
async function fetchPopulationStats() {
    const res = await api.get('/ml/population-stats');
    return res.data;
}

// ── HYPOTHESIS TAB ───────────────────────────────────────────────────────────
function HypothesisTab() {
    const [selected, setSelected] = useState<number | null>(null);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const run = async (qid: number) => {
        setSelected(qid);
        setResult(null);
        setError('');
        setLoading(true);
        try {
            const data = await runHypothesisTest(qid);
            setResult(data);
        } catch {
            setError('Could not connect to ML service. Ensure ml-service is running on port 8000.');
        } finally {
            setLoading(false);
        }
    };

    const q = QUESTIONS.find(q => q.id === selected);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24 }}>
            {/* Question list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>Select a Question</div>
                {QUESTIONS.map(q => (
                    <button key={q.id} onClick={() => run(q.id)} style={{
                        padding: '14px 16px', borderRadius: 12, border: `1px solid ${selected === q.id ? `${tint(C.lavender, '50')}` : C.border}`,
                        background: selected === q.id ? `${tint(C.lavender, '10')}` : C.bg,
                        color: selected === q.id ? C.lavender : 'var(--text-secondary)',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 5 }}>{q.label}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{q.desc}</div>
                        <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: q.test === 'chi2' ? C.teal : C.gold, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {q.test === 'chi2' ? 'Chi-Square Test' : 'Independent T-Test'}
                        </div>
                    </button>
                ))}
            </div>

            {/* Result panel */}
            <div>
                {!selected && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: 'var(--text-muted)' }}>
                        <FlaskConical size={40} opacity={0.2} />
                        <div style={{ fontSize: 13 }}>Select a question to run the statistical test</div>
                    </div>
                )}
                {loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid rgba(122, 104, 174, 0.15)`, borderTopColor: C.lavender, animation: 'spin 0.8s linear infinite' }} />
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Running {q?.test === 'chi2' ? 'Chi-Square' : 'T-Test'}...</div>
                    </div>
                )}
                {error && (
                    <div style={{ padding: 20, background: 'rgba(35, 83, 71, 0.08)', border: `1px solid ${tint(C.crimson, '30')}`, borderRadius: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <AlertCircle size={18} color={C.crimson} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{error}</div>
                    </div>
                )}
                {result && !loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Verdict banner */}
                        <div style={{
                            padding: '20px 24px', borderRadius: 16,
                            background: result.significant ? `${tint(C.crimson, '12')}` : `${tint(C.teal, '10')}`,
                            border: `1px solid ${result.significant ? `${tint(C.crimson, '35')}` : `${tint(C.teal, '30')}`}`,
                            display: 'flex', alignItems: 'flex-start', gap: 14,
                        }}>
                            {result.significant
                                ? <AlertCircle size={22} color={C.crimson} style={{ flexShrink: 0 }} />
                                : <CheckCircle size={22} color={C.teal} style={{ flexShrink: 0 }} />
                            }
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: result.significant ? C.crimson : C.teal, marginBottom: 6 }}>
                                    {result.verdict}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.plain_english}</div>
                            </div>
                        </div>

                        {/* Stats row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            {[
                                { label: q?.groupA || 'Group A', value: result.group_a_value },
                                { label: q?.groupB || 'Group B', value: result.group_b_value },
                                { label: 'p-value', value: result.p_value?.toFixed(4) },
                            ].map(s => (
                                <div key={s.label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{s.label}</div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Bar comparison */}
                        {result.chart_data && (
                            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Group Comparison</div>
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart data={result.chart_data} layout="vertical" barCategoryGap={20}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--text-muted)" horizontal={false} />
                                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} width={120} />
                                        <Tooltip contentStyle={{ background: 'var(--surface-0)', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} />
                                        <Bar dataKey="value" fill={C.lavender} radius={[0, 6, 6, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Test explanation */}
                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <Info size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                <strong style={{ color: 'var(--text-secondary)' }}>{result.test_used}:</strong> {result.test_explanation}
                                {' '}<strong>p &lt; 0.05</strong> = statistically significant pattern. <strong>p ≥ 0.05</strong> = may be random variation.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── BIG DATA ANALYTICS TAB ───────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = { HIGH: 'var(--risk-high)', MEDIUM: C.gold, LOW: C.teal, CRITICAL: 'var(--risk-critical)' };
const AGE_COLORS = [C.teal, C.gold, C.rose, C.crimson];

function BigDataTab() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPopulationStats()
            .then(setStats)
            .catch(() => setError('Could not load population statistics from ML service.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid rgba(35, 83, 71, 0.15)`, borderTopColor: C.crimson, animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading population analytics...</div>
        </div>
    );

    if (error) return (
        <div style={{ padding: 20, background: 'rgba(35, 83, 71, 0.08)', border: `1px solid ${tint(C.crimson, '30')}`, borderRadius: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
            ⚠️ {error}
        </div>
    );

    if (!stats) return null;

    const riskDist = stats.risk_distribution || [];
    const ageRisk = stats.risk_by_age_group || [];
    const topFactors = stats.top_risk_factors || [];
    const cbcTrend = stats.cbc_monthly_flags || [];
    const genderSplit = stats.gender_high_risk || { male_pct: 0, female_pct: 0 };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {[
                    { label: 'Total Patients', value: stats.total_patients || 0, color: C.lavender },
                    { label: '% High Risk', value: `${stats.pct_high?.toFixed(1) || 0}%`, color: C.crimson },
                    { label: '% Medium Risk', value: `${stats.pct_medium?.toFixed(1) || 0}%`, color: C.gold },
                    { label: '% Low Risk', value: `${stats.pct_low?.toFixed(1) || 0}%`, color: C.teal },
                ].map(kpi => (
                    <div key={kpi.label} style={{ background: C.bg, border: `1px solid ${tint(kpi.color, '20')}`, borderRadius: 14, padding: '18px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{kpi.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: kpi.color, fontFamily: 'var(--font-mono)' }}>{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Charts row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Risk by age group */}
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>Risk Distribution by Age Group</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={ageRisk}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--text-muted)" vertical={false} />
                            <XAxis dataKey="age_group" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                            <Tooltip contentStyle={{ background: 'var(--surface-0)', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [`${v}%`]} />
                            <Bar dataKey="medium_high_pct" name="Medium/High Risk %" radius={[4, 4, 0, 0]}>
                                {ageRisk.map((_: any, i: number) => <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Top 5 risk factors */}
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>Top 5 Risk Factors (Feature Importance)</div>
                    {topFactors.length === 0
                        ? <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Train heart model first to see feature importance</div>
                        : (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={topFactors} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--text-muted)" horizontal={false} />
                                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                                    <YAxis type="category" dataKey="factor" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={140} />
                                    <Tooltip contentStyle={{ background: 'var(--surface-0)', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [`${v}%`]} />
                                    <Bar dataKey="importance_pct" name="Importance" fill={C.crimson} radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )
                    }
                </div>
            </div>

            {/* Charts row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                {/* CBC monthly anomaly flags */}
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>CBC Anomaly Flags — Monthly Trend</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Reports with 2+ abnormal parameters per month</div>
                    {cbcTrend.length === 0
                        ? <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No CBC records yet</div>
                        : (
                            <ResponsiveContainer width="100%" height={150}>
                                <BarChart data={cbcTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--text-muted)" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ background: 'var(--surface-0)', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} />
                                    <Bar dataKey="flag_count" name="Flagged Reports" fill={C.rose} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )
                    }
                </div>

                {/* Gender split of high-risk */}
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>High-Risk Gender Split</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>% Male vs Female among HIGH risk patients</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                        {[
                            { label: 'Male', pct: genderSplit.male_pct, color: C.blue },
                            { label: 'Female', pct: genderSplit.female_pct, color: C.rose },
                        ].map(g => (
                            <div key={g.label}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{g.label}</span>
                                    <span style={{ color: g.color, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{g.pct?.toFixed(1) || 0}%</span>
                                </div>
                                <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 5, overflow: 'hidden' }}>
                                    <div style={{ width: `${g.pct || 0}%`, height: '100%', background: g.color, borderRadius: 5, transition: 'width 0.8s ease' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                        Aggregated across all patients. No individual data.
                    </div>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
    { id: 'hypothesis', label: '🔬 Hypothesis Test', icon: FlaskConical },
    { id: 'bigdata', label: '📊 Big Data Analytics', icon: BarChart3 },
];

export default function ResearchAnalyticsPage() {
    const [tab, setTab] = useState('hypothesis');

    return (
        <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.lavender}, var(--accent-primary-dim))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔬</div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Research & Analytics</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Population-level statistical analysis — aggregated, anonymized clinic-wide data</p>
                    </div>
                </div>
                <div style={{ padding: '8px 14px', background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    🔒 Doctor access only — No individual patient names or IDs are shown in this section
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 28, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: 6, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: tab === t.id ? `${tint(C.lavender, '18')}` : 'transparent',
                        color: tab === t.id ? C.lavender : 'var(--text-secondary)',
                        fontWeight: tab === t.id ? 800 : 600, fontSize: 13.5,
                        boxShadow: tab === t.id ? `0 0 0 1px ${tint(C.lavender, '35')}` : 'none',
                        transition: 'all 0.15s',
                    }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20, padding: 28 }}>
                {tab === 'hypothesis' && <HypothesisTab />}
                {tab === 'bigdata' && <BigDataTab />}
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
