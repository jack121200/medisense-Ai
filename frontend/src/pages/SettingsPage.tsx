import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth.api';
import toast from 'react-hot-toast';
import { User, Lock, Shield, Cpu, Heart, Zap, Database, Globe } from 'lucide-react';

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
    return (
        <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
            borderRadius: 18, padding: '24px 28px', marginBottom: 20,
            position: 'relative', overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                background: 'linear-gradient(90deg, transparent, var(--accent-primary) 50%, transparent)', opacity: 0.3,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(13, 92, 126, 0.08)', border: '1px solid rgba(13, 92, 126, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Icon size={16} color="var(--accent-primary)" />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>{title}</h3>
            </div>
            {children}
        </div>
    );
}

export default function SettingsPage() {
    const { user, setAuth, refreshToken, accessToken } = useAuthStore();
    const [profile, setProfile] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        department: user?.department || '',
    });
    const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPw, setSavingPw] = useState(false);

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const { data } = await authApi.updateProfile(profile);
            setAuth(data.data.user, accessToken!, refreshToken!);
            toast.success('Profile updated successfully');
        } catch { toast.error('Failed to update profile'); }
        finally { setSavingProfile(false); }
    };

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) { toast.error('Passwords do not match'); return; }
        if (passwords.newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
        setSavingPw(true);
        try {
            await authApi.changePassword(passwords.currentPassword, passwords.newPassword);
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
            toast.success('Password changed successfully');
        } catch { toast.error('Failed to change password — check current password'); }
        finally { setSavingPw(false); }
    };

    return (
        <div className="page-enter" style={{ maxWidth: 720 }}>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', marginBottom: 6 }}>
                    Settings
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                    Manage your profile, security, and system preferences
                </p>
            </div>

            {/* User avatar card */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(13, 92, 126, 0.06) 0%, rgba(255,44,245,0.03) 100%)',
                border: '1px solid rgba(13, 92, 126, 0.12)', borderRadius: 18,
                padding: '24px 28px', marginBottom: 20,
                display: 'flex', alignItems: 'center', gap: 20,
            }}>
                <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-dim) 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 22, color: 'var(--bg-primary)', flexShrink: 0,
                    boxShadow: '0 0 24px rgba(13, 92, 126, 0.35)',
                }}>
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        {user?.firstName} {user?.lastName}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{user?.email}</div>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8,
                        padding: '3px 10px', borderRadius: 9999,
                        background: 'rgba(13, 92, 126, 0.10)', border: '1px solid rgba(13, 92, 126, 0.20)',
                        fontSize: 11, fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.06em',
                    }}>
                        <Zap size={10} /> {user?.role}
                    </div>
                </div>
            </div>

            {/* Profile section */}
            <Section icon={User} title="Profile Information">
                <form onSubmit={saveProfile}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        {['firstName', 'lastName'].map(f => (
                            <div key={f}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    {f === 'firstName' ? 'First Name' : 'Last Name'}
                                </label>
                                <input className="form-input" value={(profile as any)[f]} onChange={e => setProfile(x => ({ ...x, [f]: e.target.value }))} />
                            </div>
                        ))}
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Department</label>
                        <input className="form-input" value={profile.department} onChange={e => setProfile(x => ({ ...x, department: e.target.value }))} placeholder="e.g., Cardiology" />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
                        <input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Role</label>
                        <input className="form-input" value={user?.role || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                    </div>
                    <button type="submit" disabled={savingProfile} className="btn-primary">
                        {savingProfile ? 'Saving...' : 'Save Profile'}
                    </button>
                </form>
            </Section>

            {/* Password section */}
            <Section icon={Lock} title="Change Password">
                <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                        ['currentPassword', 'Current Password'],
                        ['newPassword', 'New Password (min 8 chars)'],
                        ['confirmPassword', 'Confirm New Password'],
                    ].map(([f, label]) => (
                        <div key={f}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
                            <input
                                type="password" className="form-input"
                                value={(passwords as any)[f]}
                                onChange={e => setPasswords(x => ({ ...x, [f]: e.target.value }))}
                                required minLength={f === 'currentPassword' ? 1 : 8}
                            />
                        </div>
                    ))}
                    <button type="submit" disabled={savingPw} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                        {savingPw ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </Section>

            {/* System info */}
            <Section icon={Shield} title="System Information">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                        { label: 'Platform', value: 'MediSense AI v1.0.0', icon: Heart },
                        { label: 'Backend', value: 'Node.js + Express + TypeScript', icon: Globe },
                        { label: 'ML Service', value: 'Python + FastAPI + XGBoost', icon: Cpu },
                        { label: 'Database', value: 'PostgreSQL + TimescaleDB', icon: Database },
                        { label: 'Cache', value: 'Redis', icon: Zap },
                        { label: 'Real-time', value: 'Socket.IO', icon: Zap },
                    ].map(({ label, value, icon: ItemIcon }) => (
                        <div key={label} style={{
                            background: 'var(--surface-1)', padding: '12px 16px',
                            borderRadius: 12, border: '1px solid var(--surface-border)',
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}>
                            <ItemIcon size={14} style={{ color: 'var(--accent-primary)', marginTop: 2, flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
}

