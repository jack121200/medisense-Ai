import React, { useEffect, useState, useRef } from 'react';
import { X, Bell, Calendar, AlertTriangle, Brain, ChevronRight, CheckCheck } from 'lucide-react';
import { alertApi } from '../api/index';
import { useAppointmentStore } from '../store/appointmentStore';
import { isToday, isTomorrow, parseISO, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';


interface NotificationDrawerProps {
    open: boolean;
    onClose: () => void;
}

export default function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
    const navigate = useNavigate();
    const { appointments } = useAppointmentStore();
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        alertApi.list({ limit: 20, unread: true })
            .then(r => setAlerts((r.data.data || []).slice(0, 20)))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [open]);

    const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && !a.resolvedAt);
    const todayAppts = appointments.filter(a =>
        a.status === 'UPCOMING' && isToday(parseISO(a.date))
    );
    const tomorrowAppts = appointments.filter(a =>
        a.status === 'UPCOMING' && isTomorrow(parseISO(a.date))
    );

    const totalCount = criticalAlerts.length + todayAppts.length;

    const SEV_COLORS: Record<string, string> = {
        CRITICAL: 'var(--risk-critical)', HIGH: 'var(--risk-high)', MEDIUM: 'var(--risk-medium)', LOW: 'var(--risk-low)', INFO: 'var(--accent-primary)',
    };

    const SectionTitle = ({ icon: Icon, label, count, color }: any) => (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            paddingBottom: 8, borderBottom: '1px solid var(--surface-border)',
        }}>
            <Icon size={14} color={color} />
            <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
            {count > 0 && (
                <span style={{
                    marginLeft: 'auto', fontSize: 11, padding: '2px 7px', borderRadius: 9999,
                    background: `${color}18`, color, fontWeight: 800, border: `1px solid ${color}30`,
                }}>
                    {count}
                </span>
            )}
        </div>
    );

    return (
        <>
            {/* Backdrop */}
            {open && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(90, 65, 45, 0.16)',
                        zIndex: 1998, backdropFilter: 'blur(2px)',
                    }}
                />
            )}

            {/* Drawer */}
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 380,
                background: 'var(--surface-1)',
                borderLeft: '1px solid var(--surface-border)',
                boxShadow: '-20px 0 60px rgba(90, 65, 45, 0.16)',
                zIndex: 1999,
                transform: open ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 22px 16px',
                    borderBottom: '1px solid var(--surface-border)',
                    background: 'rgba(194, 91, 60, 0.03)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: 10,
                                background: 'rgba(194, 91, 60, 0.08)', border: '1px solid rgba(194, 91, 60, 0.20)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                            }}>
                                <Bell size={16} color="var(--accent-primary)" />
                                {totalCount > 0 && (
                                    <div style={{
                                        position: 'absolute', top: -4, right: -4,
                                        width: 16, height: 16, borderRadius: '50%',
                                        background: 'var(--risk-critical)', fontSize: 9, fontWeight: 800,
                                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '2px solid var(--surface-1)',
                                    }}>
                                        {totalCount > 9 ? '9+' : totalCount}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div style={{ fontSize: 15.5, fontWeight: 800, fontFamily: 'var(--font-display)' }}>Notifications</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                    {totalCount > 0 ? `${totalCount} items need attention` : 'All clear'}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} aria-label="Close notifications" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

                    {/* Critical Alerts */}
                    <div style={{ marginBottom: 24 }}>
                        <SectionTitle icon={AlertTriangle} label="Critical Alerts" count={criticalAlerts.length} color="var(--risk-critical)" />
                        {loading ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading alerts...</div>
                        ) : criticalAlerts.length === 0 ? (
                            <div style={{
                                background: 'rgba(62, 142, 126, 0.04)', border: '1px solid rgba(62, 142, 126, 0.12)',
                                borderRadius: 12, padding: '14px 16px', fontSize: 13,
                                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <CheckCheck size={15} color="var(--accent-green)" /> No critical alerts right now
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {criticalAlerts.slice(0, 8).map(alert => (
                                    <div key={alert.id} onClick={() => { navigate('/alerts'); onClose(); }} style={{
                                        background: 'rgba(179, 64, 46, 0.05)', border: '1px solid rgba(179, 64, 46, 0.15)',
                                        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                                        transition: 'all 0.15s', borderLeft: '3px solid var(--risk-critical)',
                                    }}
                                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(179, 64, 46, 0.10)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(179, 64, 46, 0.05)'}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                                {alert.title}
                                            </div>
                                            <span style={{
                                                flexShrink: 0, fontSize: 9.5, padding: '2px 7px', borderRadius: 9999, fontWeight: 800,
                                                background: `${SEV_COLORS[alert.severity] || 'var(--surface-0)'}18`,
                                                color: SEV_COLORS[alert.severity] || 'var(--text-primary)',
                                                border: `1px solid ${SEV_COLORS[alert.severity] || 'var(--surface-border-hi)'}30`,
                                            }}>
                                                {alert.severity}
                                            </span>
                                        </div>
                                        {alert.message && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{alert.message.slice(0, 80)}{alert.message.length > 80 ? '...' : ''}</div>}
                                        {alert.patient && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Patient: {alert.patient.firstName} {alert.patient.lastName}</div>}
                                    </div>
                                ))}
                                <button onClick={() => { navigate('/alerts'); onClose(); }} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
                                    View all alerts <ChevronRight size={13} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Today's Appointments */}
                    <div style={{ marginBottom: 24 }}>
                        <SectionTitle icon={Calendar} label="Today's Appointments" count={todayAppts.length} color="var(--accent-primary)" />
                        {todayAppts.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>No appointments scheduled for today</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {todayAppts.map(appt => (
                                    <div key={appt.id} onClick={() => { navigate('/appointments'); onClose(); }} style={{
                                        background: 'rgba(194, 91, 60, 0.04)', border: '1px solid rgba(194, 91, 60, 0.12)',
                                        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                                        display: 'flex', gap: 12, alignItems: 'center',
                                        transition: 'all 0.15s',
                                    }}
                                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(194, 91, 60, 0.08)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(194, 91, 60, 0.04)'}
                                    >
                                        <div style={{
                                            background: 'rgba(194, 91, 60, 0.10)', border: '1px solid rgba(194, 91, 60, 0.20)',
                                            borderRadius: 8, padding: '6px 8px', textAlign: 'center', minWidth: 46,
                                        }}>
                                            <div className="font-mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-primary)' }}>{appt.time}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{appt.patientName}</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Dr. {appt.doctorName} · {appt.doctorDept}</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{appt.reason}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tomorrow's Appointments */}
                    {tomorrowAppts.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                            <SectionTitle icon={Calendar} label="Tomorrow's Appointments" count={tomorrowAppts.length} color="var(--risk-medium)" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {tomorrowAppts.slice(0, 3).map(appt => (
                                    <div key={appt.id} style={{
                                        background: 'rgba(184, 145, 47, 0.04)', border: '1px solid rgba(184, 145, 47, 0.12)',
                                        borderRadius: 12, padding: '12px 14px',
                                        display: 'flex', gap: 12, alignItems: 'center',
                                    }}>
                                        <div style={{
                                            background: 'rgba(184, 145, 47, 0.10)', borderRadius: 8, padding: '6px 8px',
                                            textAlign: 'center', minWidth: 46,
                                        }}>
                                            <div className="font-mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--risk-medium)' }}>{appt.time}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{appt.patientName}</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Dr. {appt.doctorName}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Activity */}
                    <div>
                        <SectionTitle icon={Brain} label="AI Engine Status" count={0} color="var(--accent-magenta)" />
                        <div style={{
                            background: 'rgba(255,44,245,0.04)', border: '1px solid rgba(255,44,245,0.12)',
                            borderRadius: 12, padding: '14px 16px',
                        }}>
                            {[
                                { label: 'Risk Classifier', status: 'Active', color: 'var(--accent-green)' },
                                { label: 'Readmission Model', status: 'Active', color: 'var(--accent-green)' },
                                { label: 'LOS Predictor', status: 'Active', color: 'var(--accent-green)' },
                                { label: 'Anomaly Detection', status: 'Streaming', color: 'var(--accent-primary)' },
                            ].map(m => (
                                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{m.label}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: m.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                                        {m.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 18px', borderTop: '1px solid var(--surface-border)',
                    display: 'flex', gap: 8, flexShrink: 0,
                }}>
                    <button onClick={() => { navigate('/alerts'); onClose(); }} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12.5 }}>
                        All Alerts
                    </button>
                    <button onClick={() => { navigate('/appointments'); onClose(); }} className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 12.5 }}>
                        <Calendar size={13} /> Appointments
                    </button>
                </div>
            </div>
        </>
    );
}
