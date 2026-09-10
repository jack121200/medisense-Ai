import React, { useState, useEffect } from 'react';
import { Bell, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import { format } from 'date-fns';

interface TopbarProps {
    onOpenNotifications?: () => void;
}

export default function Topbar({ onOpenNotifications }: TopbarProps) {
    const { user } = useAuthStore();
    const { unreadCount } = useAlertStore();
    const [now, setNow] = useState(new Date());
    const [search, setSearch] = useState('');

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <header style={{
            height: 58,
            background: 'var(--bg-glass)',
            borderBottom: '1px solid var(--surface-border)',
            display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
            flexShrink: 0, position: 'sticky', top: 0, zIndex: 100,
            backdropFilter: 'blur(20px)',
        }}>
            {/* Search */}
            <div
                role="search"
                style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--surface-0)',
                border: '1px solid var(--surface-border-md)',
                borderRadius: 10, padding: '7px 14px', maxWidth: 400,
                transition: 'all 0.2s ease',
            }}
                onFocus={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-primary)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(13, 92, 126, 0.12)';
                }}
                onBlur={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--surface-border-md)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
            >
                <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} aria-hidden="true" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search patients, MRN, diagnosis..."
                    aria-label="Search patients, MRN, diagnosis"
                    style={{
                        background: 'none', border: 'none', outline: 'none',
                        color: 'var(--text-primary)', fontSize: 13, width: '100%',
                    }}
                />
                {search && (
                    <button onClick={() => setSearch('')} aria-label="Clear search" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                        <X size={13} />
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                {/* Live system status */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                    background: 'var(--risk-low-bg)', borderRadius: 9999,
                    border: '1px solid var(--accent-green-glow)',
                }}>
                    <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--accent-green)',
                    }} className="live-dot" />
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent-green-text)', letterSpacing: '0.06em' }}>
                        LIVE
                    </span>
                </div>

                {/* Clock */}
                <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: 'var(--text-secondary)',
                    padding: '5px 12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 8,
                    display: 'flex', gap: 6, alignItems: 'center',
                }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>
                        {format(now, 'EEE, MMM d')}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                        {format(now, 'HH:mm:ss')}
                    </span>
                </div>

                {/* Notification bell — opens drawer */}
                <button
                    onClick={onOpenNotifications}
                    aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                    style={{
                        position: 'relative', padding: '7px 8px', display: 'flex',
                        background: unreadCount > 0 ? 'var(--risk-critical-bg)' : 'var(--surface-2)',
                        border: `1px solid ${unreadCount > 0 ? 'var(--risk-critical-border)' : 'var(--surface-border)'}`,
                        borderRadius: 10, transition: 'all 0.15s ease', cursor: 'pointer',
                    }}
                >
                    <Bell size={17} color={unreadCount > 0 ? 'var(--risk-critical)' : 'var(--text-secondary)'} strokeWidth={1.75} aria-hidden="true" style={{ animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none' }} />
                    {unreadCount > 0 && (
                        <span aria-hidden="true" style={{
                            position: 'absolute', top: 2, right: 2,
                            background: 'var(--risk-critical)',
                            color: 'white', borderRadius: 9999, fontSize: 8.5, fontWeight: 800,
                            width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: 'var(--glow-red)',
                        }}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {/* User avatar */}
                {user && (
                    <Link
                        to="/settings"
                        style={{
                            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-dim) 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 12, color: '#fff', textDecoration: 'none',
                            boxShadow: 'var(--glow-cyan-sm)',
                            fontFamily: 'var(--font-display)',
                        }}
                    >
                        {user.firstName[0]}{user.lastName[0]}
                    </Link>
                )}
            </div>
        </header>
    );
}
