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
// One distinguishable hue per role, all drawn from the palette in index.css
// so the shell never fights the page content.
//
// Used as text on a ~7-10% tint of themselves (role badge, active nav item),
// so these are the darkened text-safe variants rather than the vivid palette
// values — vivid gold measured 2.05:1 against its own tint, well under the
// 4.5:1 AA floor for small text.
const ROLE_COLORS: Record<string, string> = {
    RECEPTIONIST: '#7E5F12', DOCTOR: '#0D5C7E', LAB_TECHNICIAN: '#A05A28',
    PATIENT: '#137965', ADMIN: '#6A5A9C', SUPER_ADMIN: '#6A5A9C',
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
    const roleColor = ROLE_COLORS[role] || 'var(--accent-primary)';
    const W = collapsed ? 68 : 236;

    return (
        <aside style={{ width: W, minHeight: '100vh', background: 'var(--bg-secondary)', borderRight: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', flexShrink: 0, position: 'relative', zIndex: 20, overflow: 'hidden' }}>
            {/* Logo */}
            <div style={{ padding: collapsed ? '24px 0' : '24px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--surface-border)', justifyContent: collapsed ? 'center' : 'flex-start', flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🩺</div>
                {!collapsed && (
                    <div>
                        <div style={{ fontWeight: 900, fontSize: 15.5, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>MediSense <span style={{ color: 'var(--accent-primary)' }}>AI</span></div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Health Platform</div>
                    </div>
                )}
            </div>

            {/* Role badge */}
            {!collapsed && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-border)' }}>
                    <div style={{ background: `${roleColor}12`, border: `1px solid ${roleColor}25`, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: roleColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: roleColor }}>{ROLE_LABELS[role] || role}</span>
                    </div>
                </div>
            )}

            {/* Nav items */}
            <nav aria-label="Main navigation" style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
                {navItems.map(item => {
                    const Icon = item.icon;
                    return (
                        <NavLink key={item.to + item.label} to={item.to}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: collapsed ? '12px 0' : '11px 16px',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                margin: '2px 8px', borderRadius: 12,
                                textDecoration: 'none', transition: 'all 0.15s',
                                background: isActive ? `${roleColor}1A` : 'transparent',
                                color: isActive ? roleColor : 'var(--text-secondary)',
                                borderLeft: isActive ? `3px solid ${roleColor}` : '3px solid transparent',
                            })}
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
            <div style={{ padding: collapsed ? '16px 8px' : '16px', borderTop: '1px solid var(--surface-border)', flexShrink: 0 }}>
                {!collapsed && user && (
                    <div style={{ marginBottom: 10, padding: '10px 12px', background: 'var(--surface-1)', borderRadius: 12, border: '1px solid var(--surface-border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{user.firstName} {user.lastName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                    </div>
                )}
                <button onClick={handleLogout} aria-label="Sign out" className="btn-danger" style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '10px 12px' }}>
                    <LogOut size={16} aria-hidden="true" />
                    {!collapsed && 'Sign Out'}
                </button>
            </div>

            {/* Collapse toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                style={{ position: 'absolute', top: 28, right: -12, width: 24, height: 24, borderRadius: '50%', background: 'var(--surface-0)', border: '1px solid var(--surface-border-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-sm)', zIndex: 10 }}
            >
                {collapsed ? <ChevronRight size={13} aria-hidden="true" /> : <ChevronLeft size={13} aria-hidden="true" />}
            </button>
        </aside>
    );
}
