import React, { useEffect, useState, useCallback } from 'react';
import { alertApi } from '../api/index';
import { CheckCheck, RefreshCw, Bell, AlertTriangle, Info, Loader2, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAlertStore } from '../store/alertStore';
import toast from 'react-hot-toast';

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: any }> = {
    CRITICAL: { color: 'var(--risk-critical)', bg: 'rgba(179, 64, 46, 0.08)', border: 'rgba(179, 64, 46, 0.25)', icon: AlertTriangle },
    WARNING: { color: 'var(--risk-medium)', bg: 'rgba(184, 145, 47, 0.08)', border: 'rgba(184, 145, 47, 0.20)', icon: AlertTriangle },
    HIGH: { color: 'var(--risk-high)', bg: 'rgba(204, 107, 61, 0.08)', border: 'rgba(204, 107, 61, 0.20)', icon: AlertTriangle },
    INFO: { color: 'var(--accent-primary)', bg: 'rgba(194, 91, 60, 0.06)', border: 'rgba(194, 91, 60, 0.15)', icon: Info },
};

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [pagination, setPagination] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<{ severity: string; resolved: string }>({ severity: '', resolved: 'false' });
    const { setUnreadCount } = useAlertStore();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await alertApi.list({ ...filter, limit: '50' });
            setAlerts(data.data || []);
            setPagination(data.pagination);
            const countRes = await alertApi.getUnreadCount();
            setUnreadCount(countRes.data.data.count);
        } catch { toast.error('Failed to load alerts'); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    const resolve = async (id: string) => {
        try {
            await alertApi.resolve(id);
            setAlerts(a => a.map(alert => alert.id === id ? { ...alert, isResolved: true } : alert));
            toast.success('Alert resolved');
        } catch { toast.error('Failed to resolve'); }
    };

    const markAllRead = async () => {
        try {
            await alertApi.markAllRead();
            setAlerts(a => a.map(alert => ({ ...alert, isRead: true })));
            setUnreadCount(0);
            toast.success('All marked as read');
        } catch { toast.error('Failed'); }
    };

    const criticalCount = alerts.filter(a => a.severity === 'CRITICAL' && !a.isResolved).length;

    return (
        <div className="page-enter">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <Bell size={22} color="var(--accent-primary)" strokeWidth={1.75} />
                        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                            Alerts Center
                        </h1>
                        {criticalCount > 0 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px',
                                background: 'rgba(179, 64, 46, 0.10)', borderRadius: 9999,
                                border: '1px solid rgba(179, 64, 46, 0.30)', fontSize: 12, fontWeight: 800,
                                color: 'var(--risk-critical)',
                            }} className="pulse-critical">
                                🚨 {criticalCount} CRITICAL
                            </div>
                        )}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                        {pagination?.total || 0} alerts · {alerts.filter(a => !a.isRead).length} unread
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={markAllRead} className="btn-ghost">
                        <CheckCheck size={15} /> Mark All Read
                    </button>
                    <button onClick={load} className="btn-ghost" style={{ padding: '9px 12px' }}>
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {['', 'CRITICAL', 'HIGH', 'WARNING', 'INFO'].map(s => {
                    const cfg = s ? SEVERITY_CONFIG[s] : null;
                    const isActive = filter.severity === s;
                    return (
                        <button
                            key={s}
                            onClick={() => setFilter(f => ({ ...f, severity: s }))}
                            style={{
                                padding: '7px 16px', borderRadius: 9999,
                                border: `1px solid ${isActive ? (cfg?.border || 'rgba(194, 91, 60, 0.30)') : 'var(--surface-border)'}`,
                                background: isActive ? (cfg?.bg || 'rgba(194, 91, 60, 0.06)') : 'var(--surface-2)',
                                color: isActive ? (cfg?.color || 'var(--accent-primary)') : 'var(--text-muted)',
                                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                transition: 'all 0.15s', letterSpacing: s ? '0.04em' : '0',
                            }}
                        >
                            {s || 'All Alerts'}
                        </button>
                    );
                })}
                <button
                    onClick={() => setFilter(f => ({ ...f, resolved: f.resolved === 'false' ? 'true' : 'false' }))}
                    style={{
                        padding: '7px 16px', borderRadius: 9999,
                        border: filter.resolved === 'true' ? '1px solid rgba(62, 142, 126, 0.25)' : '1px solid var(--surface-border)',
                        background: filter.resolved === 'true' ? 'rgba(62, 142, 126, 0.08)' : 'var(--surface-2)',
                        color: filter.resolved === 'true' ? 'var(--accent-green)' : 'var(--text-muted)',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                >
                    {filter.resolved === 'true' ? '✓ Resolved' : 'Unresolved'}
                </button>
            </div>

            {/* Alert list */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        border: '3px solid rgba(194, 91, 60, 0.15)',
                        borderTopColor: 'var(--accent-primary)',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {alerts.map(a => {
                        const cfg = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG['INFO'];
                        const IconComp = cfg.icon;
                        return (
                            <div key={a.id} style={{
                                background: 'var(--surface-1)',
                                border: `1px solid ${a.isRead ? 'var(--surface-border)' : cfg.border}`,
                                borderRadius: 14, padding: '16px 20px',
                                opacity: a.isResolved ? 0.55 : 1,
                                display: 'flex', gap: 14, alignItems: 'flex-start',
                                transition: 'all 0.15s ease',
                                position: 'relative', overflow: 'hidden',
                            }}>
                                {/* Severity side bar */}
                                {!a.isRead && (
                                    <div style={{
                                        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                                        borderRadius: '14px 0 0 14px',
                                        background: cfg.color,
                                        opacity: 0.8,
                                    }} />
                                )}

                                {/* Severity icon */}
                                <div style={{
                                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    ...(a.severity === 'CRITICAL' && !a.isRead ? { animation: 'vitalCriticalPulse 2s ease-in-out infinite' } : {}),
                                }}>
                                    <IconComp size={17} style={{ color: cfg.color }} strokeWidth={2} />
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{
                                                padding: '2px 9px', borderRadius: 9999,
                                                background: cfg.bg, color: cfg.color,
                                                fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em',
                                                border: `1px solid ${cfg.border}`,
                                            }}>
                                                {a.severity}
                                            </span>
                                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.type}</span>
                                            {a.patient && (
                                                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                    {a.patient.firstName} {a.patient.lastName}
                                                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>
                                                        ({a.patient.patientCode})
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                        {!a.isRead && (
                                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0, marginTop: 4 }} />
                                        )}
                                    </div>
                                    <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.5, fontWeight: 500 }}>
                                        {a.message}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                                        <Clock size={11} color="var(--text-muted)" />
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            {format(new Date(a.createdAt), 'MMM d, HH:mm')}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                                        </span>
                                        {a.isResolved && (
                                            <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: 11 }}>
                                                ✓ Resolved
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {!a.isResolved && (
                                    <button onClick={() => resolve(a.id)} className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }}>
                                        Resolve
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {alerts.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                            <Bell size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
                            <div style={{ fontSize: 14 }}>No alerts matching current filters</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
