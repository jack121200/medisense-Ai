import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth.api';

const ROLES = [
    {
        id: 'PATIENT',
        label: 'Patient',
        icon: '🏥',
        desc: 'Book appointments, view reports, manage your health',
        gradient: 'from-emerald-500 to-teal-600',
        glow: 'shadow-emerald-500/25',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        textColor: 'text-emerald-400',
    },
    {
        id: 'DOCTOR',
        label: 'Doctor',
        icon: '🩺',
        desc: 'Access patient records, write prescriptions, manage consultations',
        gradient: 'from-blue-500 to-indigo-600',
        glow: 'shadow-blue-500/25',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        textColor: 'text-blue-400',
    },
    {
        id: 'RECEPTIONIST',
        label: 'Receptionist',
        icon: '📋',
        desc: 'Manage appointment requests, patient intake, and scheduling',
        gradient: 'from-violet-500 to-purple-600',
        glow: 'shadow-violet-500/25',
        bg: 'bg-violet-500/10',
        border: 'border-violet-500/30',
        textColor: 'text-violet-400',
    },
    {
        id: 'LAB_TECHNICIAN',
        label: 'Lab Technician',
        icon: '🧪',
        desc: 'Process lab orders and upload patient test reports',
        gradient: 'from-amber-500 to-orange-600',
        glow: 'shadow-amber-500/25',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        textColor: 'text-amber-400',
    },
];

const LoginPage = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, setAuth } = useAuthStore();
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [step, setStep] = useState<'role' | 'form'>('role');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (user) {
            const path = getRoleHome(user.role);
            navigate(path, { replace: true });
        }
    }, [user, navigate]);

    function getRoleHome(role: string) {
        switch (role) {
            case 'PATIENT': return '/patient-portal';
            case 'DOCTOR': return '/doctor-dashboard';
            case 'RECEPTIONIST': return '/dashboard';
            case 'LAB_TECHNICIAN': return '/lab';
            case 'ADMIN':
            case 'SUPER_ADMIN': return '/dashboard';
            default: return '/dashboard';
        }
    }

    const handleRoleSelect = (roleId: string) => {
        setSelectedRole(roleId);
        setTimeout(() => setStep('form'), 150);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const res = await authApi.login(email, password);
            const { user: loggedUser, accessToken, refreshToken } = res.data.data;
            setAuth(loggedUser, accessToken, refreshToken);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Invalid email or password');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedRoleData = ROLES.find(r => r.id === selectedRole);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated && user) {
            navigate(getRoleHome(user.role), { replace: true });
        }
    }, [isAuthenticated, user, navigate]);

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-primary) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Inter", -apple-system, sans-serif',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Ambient glows */}
            <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13, 92, 126, 0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(18, 121, 163, 0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ width: '100%', maxWidth: step === 'role' ? 900 : 440, transition: 'max-width 0.4s ease' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🫀</div>
                        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}><span style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-primary-hover))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MediSense</span> <span style={{ color: 'var(--accent-primary)' }}>AI</span></span>
                    </div>
                    <h1 style={{ fontSize: step === 'role' ? 32 : 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
                        {step === 'role' ? 'Who are you?' : `Sign in as ${selectedRoleData?.label}`}
                    </h1>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8 }}>
                        {step === 'role' ? 'Select your role to continue' : `Access your ${selectedRoleData?.label.toLowerCase()} dashboard`}
                    </p>
                </div>

                {/* Step 1: Role tiles */}
                {step === 'role' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                        {ROLES.map(role => (
                            <button
                                key={role.id}
                                onClick={() => handleRoleSelect(role.id)}
                                style={{
                                    background: 'var(--surface-1)',
                                    border: `1px solid var(--surface-border)`,
                                    borderRadius: 16,
                                    padding: '28px 24px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                                onMouseEnter={e => {
                                    const el = e.currentTarget;
                                    el.style.transform = 'translateY(-3px)';
                                    el.style.border = `1px solid var(--surface-border)`;
                                    el.style.background = 'var(--surface-2)';
                                }}
                                onMouseLeave={e => {
                                    const el = e.currentTarget;
                                    el.style.transform = 'translateY(0)';
                                    el.style.border = '1px solid var(--surface-border)';
                                    el.style.background = 'var(--surface-1)';
                                }}
                            >
                                <div style={{ fontSize: 36, marginBottom: 14 }}>{role.icon}</div>
                                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{role.label}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{role.desc}</div>
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                                    background: `linear-gradient(90deg, transparent, var(--surface-2))`,
                                }} />
                            </button>
                        ))}
                    </div>
                )}

                {/* Step 2: Login form */}
                {step === 'form' && selectedRoleData && (
                    <div style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--surface-border)',
                        borderRadius: 20,
                        padding: 36,
                        backdropFilter: 'blur(20px)',
                    }}>
                        {/* Role badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--surface-border)' }}>
                            <span style={{ fontSize: 24 }}>{selectedRoleData.icon}</span>
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>Signed in as</div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedRoleData.label}</div>
                            </div>
                            <button onClick={() => { setStep('role'); setError(''); }} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, transition: 'color 0.2s' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                ← Change
                            </button>
                        </div>

                        <form onSubmit={handleLogin}>
                            {/* Email */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    placeholder="you@example.com"
                                    style={{
                                        width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--surface-border-md)',
                                        background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => (e.target.style.borderColor = 'var(--accent-primary)')}
                                    onBlur={e => (e.target.style.borderColor = 'var(--surface-border)')}
                                />
                            </div>

                            {/* Password */}
                            <div style={{ marginBottom: 24, position: 'relative' }}>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>Password</label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%', padding: '12px 44px 12px 16px', borderRadius: 10, border: '1px solid var(--surface-border-md)',
                                        background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => (e.target.style.borderColor = 'var(--accent-primary)')}
                                    onBlur={e => (e.target.style.borderColor = 'var(--surface-border)')}
                                />
                                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 14, top: 38, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 0 }}>
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>

                            {error && (
                                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(209, 63, 74, 0.1)', border: '1px solid rgba(209, 63, 74, 0.25)', borderRadius: 8, fontSize: 13, color: 'var(--risk-high)' }}>
                                    ⚠️ {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    width: '100%', padding: '14px', borderRadius: 10, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                                    background: submitting ? 'rgba(13, 92, 126, 0.4)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))',
                                    color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, transition: 'opacity 0.2s, transform 0.1s',
                                    opacity: submitting ? 0.7 : 1,
                                }}
                                onMouseEnter={e => { if (!submitting) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                                {submitting ? '⏳ Signing in...' : `Sign In as ${selectedRoleData.label}`}
                            </button>
                        </form>

                        {/* Register link — all roles */}
                        <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--surface-border)' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Not registered yet? </span>
                            <Link to={`/register?role=${selectedRole}`} style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none' }}>
                                Register as {selectedRoleData?.label} →
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                @keyframes spin { to { transform: rotate(360deg); } }
                input::placeholder { color: var(--text-muted); }
            `}</style>
        </div>
    );
};

export default LoginPage;

