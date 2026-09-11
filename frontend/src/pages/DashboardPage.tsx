import React, { useEffect, useState } from 'react';
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from 'recharts';
import {
    Users, AlertTriangle, Activity, Shield,
    ArrowUpRight, ArrowDownRight, Minus,
    Calendar, Bell, CheckCircle2, HeartPulse
} from 'lucide-react';
import { analyticsApi } from '../api/index';
import { patientApi } from '../api/patient.api';
import { alertApi } from '../api/index';
import { appointmentApi } from '../api/appointment.api';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { doctorName } from '../utils/doctorName';

const RISK_COLORS: Record<string, string> = {
    CRITICAL: 'var(--accent-primary)', HIGH: 'var(--accent-primary-hover)', MEDIUM: 'var(--risk-medium)', LOW: 'var(--risk-low)',
};

function KpiCard({ kpi, delay }: { kpi: any; delay: number }) {
    return (
        <div className="stat-card card-hover-accent" style={{ animation: `fadeUp 0.4s ease-out ${delay}ms both` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: `${kpi.color}15`, border: `1px solid ${kpi.color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <kpi.icon size={18} style={{ color: kpi.color }} strokeWidth={1.75} />
                </div>
                {kpi.trend !== undefined && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 9999,
                        background: kpi.trend > 0 ? 'rgba(63, 138, 102, 0.10)' : kpi.trend < 0 ? 'rgba(200, 67, 75, 0.10)' : 'var(--surface-2)',
                        fontSize: 11, fontWeight: 700,
                        color: kpi.trend > 0 ? 'var(--accent-green)' : kpi.trend < 0 ? 'var(--risk-critical)' : 'var(--text-muted)',
                    }}>
                        {kpi.trend > 0 ? <ArrowUpRight size={11} /> : kpi.trend < 0 ? <ArrowDownRight size={11} /> : <Minus size={11} />}
                        {Math.abs(kpi.trend)}
                    </div>
                )}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 5 }}>
                {kpi.value}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>{kpi.label}</div>
            {kpi.change && <div style={{ fontSize: 11, color: kpi.color, marginTop: 3, fontWeight: 600 }}>{kpi.change}</div>}
        </div>
    );
}

function SectionHeader({ title, sub, to, toLabel }: { title: string; sub?: string; to?: string; toLabel?: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
                {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
            </div>
            {to && (
                <Link to={to} style={{ fontSize: 11.5, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {toLabel || 'View All'} <ArrowUpRight size={12} />
                </Link>
            )}
        </div>
    );
}

export default function DashboardPage() {
    const { user } = useAuthStore();
    const [dashboard, setDashboard] = useState<any>(null);
    const [wardOccupancy, setWardOccupancy] = useState<any[]>([]);
    const [highRisk, setHighRisk] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [apptRequests, setApptRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [dashRes, wardRes, riskRes, alertRes, apptRes] = await Promise.all([
                    analyticsApi.getDashboard(),
                    analyticsApi.getWardOccupancy(),
                    patientApi.getHighRisk(),
                    alertApi.list({ limit: 5, resolved: false }),
                    appointmentApi.list().catch(() => ({ data: { data: [] } })),
                ]);
                setDashboard(dashRes.data.data);
                setWardOccupancy(wardRes.data.data || []);
                setHighRisk(riskRes.data.data?.slice(0, 5) || []);
                setAlerts(alertRes.data.data?.slice(0, 4) || []);
                const allAppts = apptRes.data.data || [];
                const today = new Date().toISOString().slice(0, 10);
                setApptRequests(allAppts.filter((a: any) =>
                    a.status === 'PENDING' || (a.scheduledDate && a.scheduledDate.slice(0, 10) === today)
                ).slice(0, 4));
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(35, 83, 71, 0.15)', borderTopColor: 'var(--accent-primary)', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Loading system overview...</div>
        </div>
    );

    const totalPats = dashboard?.totalPatients || 0;
    const riskPieData = (dashboard?.riskDistribution || []).map((r: any) => ({
        name: r.level, value: r.count, color: RISK_COLORS[r.level] || 'var(--text-muted)',
    }));

    // Today stats
    const todayISO = new Date().toISOString().slice(0, 10);
    const pendingAppts = apptRequests.filter(a => a.status === 'PENDING').length;
    const todayAppts = apptRequests.filter(a => a.scheduledDate?.slice(0, 10) === todayISO).length;

    const kpis = [
        { label: 'Total Patients', value: totalPats.toLocaleString() || '—', icon: Users, color: 'var(--accent-primary)', change: '+registered in system', trend: undefined },
        { label: 'Critical Risk', value: dashboard?.criticalCount || '0', icon: AlertTriangle, color: 'var(--risk-critical-text)', change: 'Need immediate attention', trend: dashboard?.criticalCount || 0 },
        { label: 'High Risk', value: dashboard?.highRiskCount || '0', icon: Shield, color: 'var(--risk-high-text)', change: 'Monitor closely' },
        { label: "Today's Admissions", value: dashboard?.admissionsToday || '0', icon: Activity, color: 'var(--accent-green-text)', change: 'New patients today', trend: dashboard?.admissionsToday },
        { label: 'Unresolved Alerts', value: dashboard?.unresolvedAlerts || '0', icon: Bell, color: 'var(--risk-medium-text)', change: 'Require action' },
        { label: 'Pending Appointments', value: pendingAppts || '0', icon: Calendar, color: 'var(--accent-primary)', change: 'Awaiting approval' },
    ];

    return (
        <div className="page-enter">
            {/* ── Header ── */}
            <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', marginBottom: 4 }}>
                        Hospital Overview
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {user?.firstName && ` · Welcome, ${user.role === 'DOCTOR' ? doctorName(user.firstName) : user.firstName}`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <Link to="/patients/new" className="btn-ghost" style={{ textDecoration: 'none', color: 'var(--accent-primary)', borderColor: 'rgba(35, 83, 71, 0.2)', background: 'rgba(35, 83, 71, 0.04)' }}>
                        <Users size={14} /> New Patient
                    </Link>
                    <Link to="/appointments" className="btn-primary" style={{ textDecoration: 'none' }}>
                        <Calendar size={14} /> Appointments
                    </Link>
                </div>
            </div>

            {/* ── KPI Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 14, marginBottom: 24 }}>
                {kpis.map((kpi, i) => <KpiCard key={kpi.label} kpi={kpi} delay={i * 55} />)}
            </div>

            {/* ── Quick Actions ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                    { label: '❤️ Heart Risk AI', sub: 'Predict heart disease risk', to: '/ml-predictions', color: 'var(--accent-primary)' },
                    { label: '🩸 CBC Analyzer', sub: 'Analyze blood report', to: '/report-analyzer', color: 'var(--accent-primary-hover)' },
                    { label: '👥 Patients', sub: 'Browse patient registry', to: '/patients', color: 'var(--risk-medium-text)' },
                    { label: '🚨 View Alerts', sub: 'Review open alerts', to: '/alerts', color: 'var(--risk-low-text)' },
                ].map(a => (
                    <Link key={a.to} to={a.to} style={{
                        display: 'flex', flexDirection: 'column', gap: 4, background: `${a.color}08`,
                        border: `1px solid ${a.color}20`, borderRadius: 14, padding: '14px 18px',
                        textDecoration: 'none', transition: 'all 0.15s ease',
                    }}
                        onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.background = `${a.color}14`}
                        onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.background = `${a.color}08`}
                    >
                        <span style={{ fontSize: 13, fontWeight: 800, color: a.color }}>{a.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.sub}</span>
                    </Link>
                ))}
            </div>

            {/* ── Charts Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginBottom: 20 }}>
                {/* Risk distribution */}
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: '20px 22px' }}>
                    <SectionHeader title="Risk Distribution" sub={`${totalPats} patients`} to="/patients" toLabel="All Patients" />
                    {riskPieData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={150}>
                                <PieChart>
                                    <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={68} dataKey="value" paddingAngle={3}>
                                        {riskPieData.map((entry: any, idx: number) => <Cell key={idx} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 12 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', justifyContent: 'center', marginTop: 6 }}>
                                {riskPieData.map((r: any) => (
                                    <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.color, boxShadow: `0 0 5px ${r.color}80` }} />
                                        <span style={{ color: 'var(--text-secondary)' }}>{r.name}: <strong style={{ color: 'var(--text-primary)' }}>{r.value}</strong></span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                            No risk data — run ML predictions on patients
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bottom Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 20 }}>

                {/* High Risk Patients */}
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--surface-border)' }}>
                        <SectionHeader title="🚨 High Risk Patients" sub="Immediate attention needed" to="/patients" toLabel="All" />
                    </div>
                    <div style={{ padding: '0 4px' }}>
                        {highRisk.length === 0 ? (
                            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                No high-risk patients
                            </div>
                        ) : highRisk.map((p: any) => (
                            <Link key={p.id} to={`/patients/${p.id}`} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 16px', borderBottom: '1px solid var(--surface-border)',
                                textDecoration: 'none', transition: 'background 0.1s',
                            }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.firstName} {p.lastName}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{p.patientCode}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: RISK_COLORS[p.currentRiskLevel] || 'var(--text-muted)' }}>
                                        {p.riskScore?.toFixed(1)}
                                    </span>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, color: RISK_COLORS[p.currentRiskLevel] || 'var(--text-muted)', background: `${RISK_COLORS[p.currentRiskLevel] || 'var(--surface-2)'}15`, border: `1px solid ${RISK_COLORS[p.currentRiskLevel] || 'var(--surface-border)'}25` }}>
                                        {p.currentRiskLevel}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Ward Occupancy */}
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: '18px 20px' }}>
                    <SectionHeader title="🏥 Ward Occupancy" sub="Current bed utilization" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {wardOccupancy.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>No ward data available</div>
                        ) : wardOccupancy.map((w: any) => {
                            const rate = w.occupancyRate || 0;
                            const barColor = rate > 85 ? 'var(--risk-critical)' : rate > 65 ? 'var(--risk-medium)' : 'var(--accent-primary)';
                            return (
                                <div key={w.ward}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11.5 }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>{w.ward}</span>
                                        <span style={{ color: barColor, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{w.occupied}/{w.capacity} ({rate}%)</span>
                                    </div>
                                    <div className="progress-bar-track">
                                        <div className="progress-bar-fill" style={{ width: `${Math.min(100, rate)}%`, background: `linear-gradient(90deg, ${barColor}80, ${barColor})` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Alerts */}
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--surface-border)' }}>
                        <SectionHeader title="🔔 Recent Alerts" sub="Unresolved system alerts" to="/alerts" toLabel="All" />
                    </div>
                    <div>
                        {alerts.length === 0 ? (
                            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                <CheckCircle2 size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.2 }} />
                                No active alerts
                            </div>
                        ) : alerts.map((a: any) => (
                            <div key={a.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <div style={{
                                    width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                                    background: a.severity === 'CRITICAL' ? 'var(--risk-critical)' : a.severity === 'WARNING' ? 'var(--risk-medium)' : 'var(--accent-primary)',
                                }} />
                                <div>
                                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.3 }}>{a.message?.slice(0, 60)}{a.message?.length > 60 ? '...' : ''}</div>
                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {a.severity} · {new Date(a.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Pending Appointments Row ── */}
            {apptRequests.length > 0 && (
                <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(35, 83, 71, 0.2)', borderRadius: 18, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 22px 10px', borderBottom: '1px solid var(--surface-border)' }}>
                        <SectionHeader title="📋 Pending Appointment Requests" sub={`${pendingAppts} awaiting review`} to="/appointments" toLabel="Manage All" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                        {apptRequests.map((r: any) => (
                            <div key={r.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--surface-border)', borderRight: '1px solid var(--surface-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {r.patient?.user?.firstName || r.patient?.firstName} {r.patient?.user?.lastName || r.patient?.lastName}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                            Dr. {r.doctor?.firstName} {r.doctor?.lastName} · {new Date(r.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                        color: r.status === 'PENDING' ? 'var(--risk-medium)' : 'var(--risk-low)',
                                        background: r.status === 'PENDING' ? 'rgba(201, 154, 42, 0.1)' : 'rgba(63, 138, 102, 0.1)',
                                    }}>{r.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
