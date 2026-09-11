import React, { useEffect, useState } from 'react';
import { analyticsApi } from '../api/index';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { BarChart3, FlaskConical, TrendingUp, Database } from 'lucide-react';
import toast from 'react-hot-toast';

type TabId = 'stats' | 'hypothesis' | 'eda' | 'bigdata';

const TABS: { id: TabId; icon: any; label: string }[] = [
    { id: 'stats', icon: BarChart3, label: 'Statistics' },
    { id: 'hypothesis', icon: FlaskConical, label: 'Hypothesis Tests' },
    { id: 'eda', icon: TrendingUp, label: 'Distributions' },
    { id: 'bigdata', icon: Database, label: 'Big Data' },
];

export default function AnalyticsPage() {
    const [stats, setStats] = useState<any>(null);
    const [hypothesis, setHypothesis] = useState<any[]>([]);
    const [eda, setEda] = useState<any>(null);
    const [bigdata, setBigdata] = useState<any>(null);
    const [tab, setTab] = useState<TabId>('stats');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                if (tab === 'stats') {
                    const r = await analyticsApi.getStats();
                    setStats(r.data.data);
                } else if (tab === 'hypothesis') {
                    const r = await analyticsApi.getHypothesis();
                    setHypothesis(r.data.data || []);
                } else if (tab === 'eda') {
                    const r = await analyticsApi.getEDA();
                    setEda(r.data.data);
                } else if (tab === 'bigdata') {
                    const r = await analyticsApi.getBigData();
                    setBigdata(r.data.data);
                }
            } catch { toast.error('Analytics unavailable — ensure ML service is running'); }
            finally { setLoading(false); }
        };
        load();
    }, [tab]);

    return (
        <div className="page-enter">
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', marginBottom: 6 }}>
                    Statistical Analytics
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                    EDA, descriptive statistics, hypothesis tests, and big data aggregations
                </p>
            </div>

            {/* Tab bar */}
            <div style={{
                display: 'flex', gap: 6, marginBottom: 24, padding: '6px',
                background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                borderRadius: 14, width: 'fit-content',
            }}>
                {TABS.map(({ id, icon: Icon, label }) => {
                    const isActive = tab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 7,
                                padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                                background: isActive ? 'rgba(35, 83, 71, 0.10)' : 'transparent',
                                border: isActive ? '1px solid rgba(35, 83, 71, 0.20)' : '1px solid transparent',
                                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                fontSize: 12.5, fontWeight: 600,
                                transition: 'all 0.15s ease',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            <Icon size={14} />
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, flexDirection: 'column', gap: 16 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        border: '3px solid rgba(35, 83, 71, 0.15)',
                        borderTopColor: 'var(--accent-primary)',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                        Running analysis...
                    </div>
                </div>
            ) : (
                <>
                    {/* Stats tab */}
                    {tab === 'stats' && stats?.descriptive && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
                                {Object.entries(stats?.descriptive || {}).slice(0, 12).map(([col, s]: any) => (
                                    <div key={col} style={{
                                        background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                                        borderRadius: 14, padding: '16px 18px',
                                        transition: 'all 0.2s',
                                    }}
                                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(35, 83, 71, 0.20)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--surface-border)'}
                                    >
                                        <div style={{
                                            fontSize: 11.5, fontWeight: 700, color: 'var(--accent-primary)',
                                            marginBottom: 12, textTransform: 'capitalize',
                                            letterSpacing: '0.02em',
                                        }}>
                                            {col.replace(/_/g, ' ')}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            {[['Mean', s.mean], ['Median', s.median], ['Std Dev', s.std], ['Skewness', s.skewness], ['Min', s.min], ['Max', s.max]].map(([label, val]) => (
                                                <div key={label as string}>
                                                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                                                        {label}
                                                    </div>
                                                    <div className="font-mono" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {Number(val).toFixed(2)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {stats?.group_stats?.by_risk_level && (
                                <div style={{
                                    background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                                    borderRadius: 18, padding: '22px 24px', marginTop: 20,
                                }}>
                                    <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 18 }}>KPIs by Risk Level</h3>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={stats.group_stats.by_risk_level}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--text-muted)" vertical={false} />
                                            <XAxis dataKey="risk_level" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border-md)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 12 }} />
                                            <Bar dataKey="avg_los" name="Avg LOS (days)" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} opacity={0.9} />
                                            <Bar dataKey="readmission_rate" name="Readmission Rate" fill="var(--risk-high)" radius={[4, 4, 0, 0]} opacity={0.9} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Hypothesis tab */}
                    {tab === 'hypothesis' && hypothesis.length > 0 && (
                        <div style={{ display: 'grid', gap: 14 }}>
                            {hypothesis.map(test => {
                                const color = test.reject_h0 ? 'var(--risk-medium)' : 'var(--accent-green)';
                                return (
                                    <div key={test.test_id} style={{
                                        background: 'var(--surface-1)',
                                        border: `1px solid ${test.reject_h0 ? 'rgba(201, 154, 42, 0.20)' : 'rgba(63, 138, 102, 0.15)'}`,
                                        borderRadius: 14, padding: '20px 24px',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                            <div>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Test #{test.test_id}</span>
                                                <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{test.name}</h3>
                                            </div>
                                            <span style={{
                                                padding: '5px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 800,
                                                background: `${color}18`, color,
                                                border: `1px solid ${color}30`,
                                            }}>
                                                {test.reject_h0 ? '✓ Reject H₀' : '✗ Fail to Reject H₀'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                                            {[['H₀ (Null)', test.h0], ['H₁ (Alternative)', test.h1]].map(([label, val]) => (
                                                <div key={label} style={{ background: 'var(--surface-1)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--surface-border)' }}>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>{label}</div>
                                                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{val}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: 20, fontSize: 12.5, flexWrap: 'wrap' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Method: <strong style={{ color: 'var(--accent-primary)' }}>{test.method}</strong></span>
                                            <span style={{ color: 'var(--text-muted)' }}>Statistic: <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>{test.statistic}</strong></span>
                                            <span style={{ color: 'var(--text-muted)' }}>p-value: <strong className="font-mono" style={{ color }}>{test.p_value}</strong></span>
                                            {test.effect_size !== null && <span style={{ color: 'var(--text-muted)' }}>Effect: <strong className="font-mono">{test.effect_size}</strong></span>}
                                        </div>
                                        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--text-secondary)', borderTop: '1px solid var(--surface-border)', paddingTop: 12 }}>
                                            💡 {test.conclusion}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* EDA tab */}
                    {tab === 'eda' && eda && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            {Object.entries(eda.distributions || {}).slice(0, 6).map(([col, dist]: any) => (
                                <div key={col} style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: '18px 22px' }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, textTransform: 'capitalize' }}>
                                        {col.replace(/_/g, ' ')}
                                    </h3>
                                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
                                        μ={dist.mean} · σ={dist.std} · [{dist.min}, {dist.max}]
                                    </div>
                                    <ResponsiveContainer width="100%" height={120}>
                                        <AreaChart data={dist.values.slice(0, 100).map((v: number, i: number) => ({ i, v }))}>
                                            <defs>
                                                <linearGradient id={`g_${col}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="i" hide />
                                            <YAxis hide />
                                            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: 'none', borderRadius: 10, fontSize: 11 }} />
                                            <Area type="monotone" dataKey="v" stroke="var(--accent-primary)" strokeWidth={2} fill={`url(#g_${col})`} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Big Data tab */}
                    {tab === 'bigdata' && bigdata && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                                {[
                                    { label: 'Total Records', value: bigdata.total_records?.toLocaleString(), color: 'var(--accent-primary)' },
                                    { label: 'ICU Utilization', value: `${bigdata.icu_utilization_rate}%`, color: 'var(--risk-high-text)' },
                                    { label: 'Readmission Rate', value: `${bigdata.overall_readmission_rate}%`, color: 'var(--risk-medium-text)' },
                                ].map(kpi => (
                                    <div key={kpi.label} style={{
                                        background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                                        borderRadius: 14, padding: '24px', textAlign: 'center',
                                    }}>
                                        <div className="font-mono" style={{ fontSize: 32, fontWeight: 700, color: kpi.color, letterSpacing: '-0.02em' }}>{kpi.value}</div>
                                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6 }}>{kpi.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: '22px 24px' }}>
                                <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 18 }}>Ward Statistics</h3>
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={bigdata.ward_statistics}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--text-muted)" vertical={false} />
                                        <XAxis dataKey="ward_type" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border-md)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 12 }} />
                                        <Bar dataKey="avg_los" name="Avg LOS (days)" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} opacity={0.9} />
                                        <Bar dataKey="avg_risk_score" name="Avg Risk Score" fill="var(--risk-high)" radius={[4, 4, 0, 0]} opacity={0.9} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {!loading && tab === 'hypothesis' && hypothesis.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            <FlaskConical size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
                            Analytics unavailable — ensure the ML service is running and models are trained
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
