import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Activity, Brain, BarChart3, Bell,
    UserCog, Settings, LogOut, Heart, ChevronLeft, ChevronRight,
    Calendar, FlaskConical, Receipt, Stethoscope, User, Upload, Microscope
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import { authApi } from '../api/auth.api';
import toast from 'react-hot-toast';

// Role-specific navigation
const NAV_BY_ROLE: Record<string, Array<{ to: string; icon: any; label: string; badge?: boolean }>> = {
    RECEPTIONIST: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/patients', icon: Users, label: 'Patients' },
        { to: '/appointments', icon: Calendar, label: 'Appointments', badge: true },
        { to: '/billing', icon: Receipt, label: 'Billing' },
        { to: '/alerts', icon: Bell, label: 'Alerts', badge: true },
        { to: '/users', icon: UserCog, label: 'Users' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ],
    ADMIN: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/patients', icon: Users, label: 'Patients' },
        { to: '/appointments', icon: Calendar, label: 'Appointments', badge: true },
        { to: '/billing', icon: Receipt, label: 'Billing' },
        { to: '/analytics', icon: BarChart3, label: 'Analytics' },
        { to: '/alerts', icon: Bell, label: 'Alerts', badge: true },
        { to: '/users', icon: UserCog, label: 'Users' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ],
    DOCTOR: [
        { to: '/doctor-dashboard', icon: Stethoscope, label: 'My Dashboard' },
        { to: '/my-patients', icon: Users, label: 'My Patients' },
        { to: '/appointments', icon: Calendar, label: 'Appointments', badge: true },
        { to: '/ml-predictions', icon: Brain, label: 'AI Clinical Tools' },
        { to: '/report-analyzer', icon: FlaskConical, label: 'CBC Analyzer' },
        { to: '/research-analytics', icon: BarChart3, label: 'Research & Analytics' },
        { to: '/alerts', icon: Bell, label: 'Alerts', badge: true },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ],
    LAB_TECHNICIAN: [
        { to: '/lab-dashboard', icon: Microscope, label: 'Upload Reports' },
        { to: '/patients', icon: Users, label: 'Patients' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ],
    PATIENT: [
        { to: '/patient-portal', icon: User, label: 'My Portal' },
        { to: '/ai-doctor', icon: Stethoscope, label: 'AI Doctor' },
        { to: '/ml-predictions', icon: Brain, label: 'AI Health Tools' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ],

    // Fallback for existing SUPER_ADMIN, NURSE, ANALYST
    SUPER_ADMIN: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/patients', icon: Users, label: 'Patients' },
        { to: '/appointments', icon: Calendar, label: 'Appointments' },
        { to: '/billing', icon: Receipt, label: 'Billing' },
        { to: '/analytics', icon: BarChart3, label: 'Analytics' },
        { to: '/alerts', icon: Bell, label: 'Alerts', badge: true },
        { to: '/users', icon: UserCog, label: 'Users' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ],
    NURSE: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/patients', icon: Users, label: 'Patients' },
        { to: '/vitals', icon: Activity, label: 'Vitals Monitor' },
        { to: '/alerts', icon: Bell, label: 'Alerts', badge: true },
    ],
    ANALYST: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/analytics', icon: BarChart3, label: 'Analytics' },
        { to: '/ml-predictions', icon: Brain, label: 'AI Predictions' },
        { to: '/report-analyzer', icon: FlaskConical, label: 'Report Analyzer' },
    ],
};

const ROLE_LABELS: Record<string, string> = {
    RECEPTIONIST: 'Receptionist',
    DOCTOR: 'Doctor',
    LAB_TECHNICIAN: 'Lab Technician',
    PATIENT: 'Patient',
    ADMIN: 'Admin',
    SUPER_ADMIN: 'Super Admin',
    NURSE: 'Nurse',
    ANALYST: 'Analyst',
};
// One distinguishable hue per role. The sidebar is dark forest, so these are
// the light end of each hue — every one clears 7:1 on #051F20.
const ROLE_COLORS: Record<string, string> = {
    RECEPTIONIST: '#E3C16F', DOCTOR: '#8EB69B', LAB_TECHNICIAN: '#E8A77A',
    PATIENT: '#9FD5B0', ADMIN: '#B9ABE0', SUPER_ADMIN: '#B9ABE0',
};

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const { user, refreshToken, logout } = useAuthStore();
    const { unreadCount } = useAlertStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try { if (refreshToken) await authApi.logout(refreshToken); } catch { }
        logout();
        navigate('/login');
        toast.success('Signed out');
    };

    const role = user?.role || 'DOCTOR';
    const navItems = NAV_BY_ROLE[role] || NAV_BY_ROLE['DOCTOR'];
    const roleColor = ROLE_COLORS[role] || 'var(--sage-400)';
    const W = collapsed ? 68 : 236;

    return (
        <aside style={{ width: W, minHeight: '100vh', background: 'var(--forest-900)', borderRight: '1px solid rgba(142, 182, 155, 0.12)', display: 'flex', flexDirection: 'column', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', flexShrink: 0, position: 'relative', zIndex: 20, overflow: 'hidden', ['--role-color' as string]: roleColor } as React.CSSProperties}>
            {/* Logo */}
            <div style={{ padding: collapsed ? '24px 0' : '24px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(142, 182, 155, 0.12)', justifyContent: collapsed ? 'center' : 'flex-start', flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--sage-400), var(--forest-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🩺</div>
                {!collapsed && (
                    <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--mint-100)', letterSpacing: '-0.03em' }}>MediSense <span style={{ color: 'var(--sage-400)' }}>AI</span></div>
                        <div style={{ fontSize: 10, color: '#6F9483', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Health Platform</div>
                    </div>
                )}
            </div>

            {/* Role badge */}
            {!collapsed && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(142, 182, 155, 0.12)' }}>
                    <div style={{ background: 'rgba(142, 182, 155, 0.08)', border: '1px solid rgba(142, 182, 155, 0.18)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: roleColor, flexShrink: 0, boxShadow: `0 0 8px ${roleColor}` }} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: roleColor, letterSpacing: '0.02em' }}>{ROLE_LABELS[role] || role}</span>
                    </div>
                </div>
            )}

            {/* Nav items */}
            <nav aria-label="Main navigation" style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
                {navItems.map(item => {
                    const Icon = item.icon;
                    return (
                        <NavLink key={item.to + item.label} to={item.to}
                            className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: collapsed ? '12px 0' : '11px 16px',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                margin: '2px 8px', borderRadius: 12,
                                textDecoration: 'none',
                            }}
                        >
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <Icon size={18} />
                                {item.badge && unreadCount > 0 && (
                                    <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: 'var(--risk-critical)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>{unreadCount > 9 ? '9+' : unreadCount}</div>
                                )}
                            </div>
                            {!collapsed && <span style={{ fontSize: 13.5, fontWeight: 600 }}>{item.label}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* User info + logout */}
            <div style={{ padding: collapsed ? '16px 8px' : '16px', borderTop: '1px solid rgba(142, 182, 155, 0.12)', flexShrink: 0 }}>
                {!collapsed && user && (
                    <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(142, 182, 155, 0.07)', borderRadius: 12, border: '1px solid rgba(142, 182, 155, 0.14)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mint-100)', marginBottom: 2 }}>{user.firstName} {user.lastName}</div>
                        <div style={{ fontSize: 11, color: '#6F9483', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                    </div>
                )}
                <button onClick={handleLogout} aria-label="Sign out" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '10px 12px', background: 'rgba(200, 67, 75, 0.14)', border: '1px solid rgba(200, 67, 75, 0.32)', borderRadius: 10, color: '#F0A3A8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <LogOut size={16} aria-hidden="true" />
                    {!collapsed && 'Sign Out'}
                </button>
            </div>

            {/* Collapse toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                style={{ position: 'absolute', top: 28, right: -12, width: 24, height: 24, borderRadius: '50%', background: 'var(--forest-800)', border: '1px solid rgba(142, 182, 155, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--sage-400)', zIndex: 10 }}
            >
                {collapsed ? <ChevronRight size={13} aria-hidden="true" /> : <ChevronLeft size={13} aria-hidden="true" />}
            </button>
        </aside>
    );
}
