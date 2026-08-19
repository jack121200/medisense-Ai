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
const ROLE_COLORS: Record<string, string> = {
    RECEPTIONIST: '#FFD166', DOCTOR: '#E63946', LAB_TECHNICIAN: '#FF6B6B',
    PATIENT: '#06D6A0', ADMIN: '#C77DFF', SUPER_ADMIN: '#C77DFF',
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
    const roleColor = ROLE_COLORS[role] || '#00E5FF';
    const W = collapsed ? 68 : 236;

    return (
        <aside style={{ width: W, minHeight: '100vh', background: 'var(--bg-secondary)', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', flexShrink: 0, position: 'relative', zIndex: 20, overflow: 'hidden' }}>
            {/* Logo */}
            <div style={{ padding: collapsed ? '24px 0' : '24px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(230,57,70,0.12)', justifyContent: collapsed ? 'center' : 'flex-start', flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #E63946, #A4161A)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🫀</div>
                {!collapsed && (
                    <div>
                        <div style={{ fontWeight: 900, fontSize: 15.5, background: 'linear-gradient(90deg, #E63946, #FF6B6B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>CardioSense</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>AI Cardiology</div>
                    </div>
                )}
            </div>

            {/* Role badge */}
            {!collapsed && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ background: `${roleColor}12`, border: `1px solid ${roleColor}25`, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: roleColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: roleColor }}>{ROLE_LABELS[role] || role}</span>
                    </div>
                </div>
            )}

            {/* Nav items */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
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
                                background: isActive ? `${roleColor}18` : 'transparent',
                                color: isActive ? roleColor : 'rgba(255,255,255,0.5)',
                                borderLeft: isActive ? `3px solid ${roleColor}` : '3px solid transparent',
                            })}
                        >
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <Icon size={18} />
                                {item.badge && unreadCount > 0 && (
                                    <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#FF2D55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>{unreadCount > 9 ? '9+' : unreadCount}</div>
                                )}
                            </div>
                            {!collapsed && <span style={{ fontSize: 13.5, fontWeight: 600 }}>{item.label}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* User info + logout */}
            <div style={{ padding: collapsed ? '16px 8px' : '16px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                {!collapsed && user && (
                    <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{user.firstName} {user.lastName}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                    </div>
                )}
                <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start', background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.15)', borderRadius: 10, color: '#FF2D55', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'background 0.15s' }}>
                    <LogOut size={16} />
                    {!collapsed && 'Sign Out'}
                </button>
            </div>

            {/* Collapse toggle */}
            <button onClick={() => setCollapsed(!collapsed)} style={{ position: 'absolute', top: 28, right: -12, width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', zIndex: 10 }}>
                {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </button>
        </aside>
    );
}
