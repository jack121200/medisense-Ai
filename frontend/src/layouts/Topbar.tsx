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
            background: 'rgba(8, 11, 16, 0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
            flexShrink: 0, position: 'sticky', top: 0, zIndex: 100,
            backdropFilter: 'blur(20px)',
        }}>
            {/* Search */}
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '7px 14px', maxWidth: 400,
                transition: 'all 0.2s ease',
            }}
                onFocus={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,229,255,0.3)';
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,229,255,0.04)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(0,229,255,0.07)';
                }}
                onBlur={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
            >
                <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search patients, MRN, diagnosis..."
                    style={{
                        background: 'none', border: 'none', outline: 'none',
                        color: 'var(--text-primary)', fontSize: 13, width: '100%',
                    }}
                />
                {search && (
                    <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                        <X size={13} />
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                {/* Live system status */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                    background: 'rgba(0,255,135,0.06)', borderRadius: 9999,
                    border: '1px solid rgba(0,255,135,0.15)',
                }}>
                    <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--accent-green)',
                    }} className="live-dot" />
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent-green)', letterSpacing: '0.06em' }}>
                        LIVE
                    </span>
                </div>

                {/* Clock */}
                <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: 'var(--text-secondary)',
                    padding: '5px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    display: 'flex', gap: 6, alignItems: 'center',
                }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>
                        {format(now, 'EEE, MMM d')}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                        {format(now, 'HH:mm:ss')}
                    </span>
                </div>

                {/* Notification bell — opens drawer */}
                <button
                    onClick={onOpenNotifications}
                    style={{
                        position: 'relative', padding: '7px 8px', display: 'flex',
                        background: unreadCount > 0 ? 'rgba(255,45,85,0.08)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${unreadCount > 0 ? 'rgba(255,45,85,0.20)' : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: 10, transition: 'all 0.15s ease', cursor: 'pointer',
                    }}
                >
                    <Bell size={17} color={unreadCount > 0 ? 'var(--risk-critical)' : 'var(--text-secondary)'} strokeWidth={1.75} style={{ animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none' }} />
                    {unreadCount > 0 && (
                        <span style={{
                            position: 'absolute', top: 2, right: 2,
                            background: 'var(--risk-critical)',
                            color: 'white', borderRadius: 9999, fontSize: 8.5, fontWeight: 800,
                            width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 8px rgba(255,45,85,0.6)',
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
                            background: 'linear-gradient(135deg, #00E5FF 0%, #0096C7 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 12, color: '#050709', textDecoration: 'none',
                            boxShadow: '0 0 12px rgba(0,229,255,0.30)',
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
