import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth.api';
import { roleHome } from '../utils/roleHome';

// The role picker only frames the sign-in: the account's own role decides
// where it lands after login.
const ROLES = [
    { id: 'PATIENT', label: 'Patient', icon: '🏥', desc: 'Book appointments, view reports, manage your health' },
    { id: 'DOCTOR', label: 'Doctor', icon: '🩺', desc: 'Access patient records, write prescriptions, manage consultations' },
    { id: 'RECEPTIONIST', label: 'Receptionist', icon: '📋', desc: 'Manage appointment requests, patient intake and scheduling' },
    { id: 'LAB_TECHNICIAN', label: 'Lab Technician', icon: '🧪', desc: 'Process lab orders and upload patient test reports' },
    // Administrators had no tile and had to sign in under another role's.
    { id: 'ADMIN', label: 'Administrator', icon: '🛡️', desc: 'Manage staff accounts, billing and hospital analytics' },
];

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--surface-border-md)',
    background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 };
const focusBorder = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'var(--accent-primary)'; };
const blurBorder = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'var(--surface-border-md)'; };

const LoginPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const justRegistered = searchParams.get('registered') === '1';
    const { user, setAuth } = useAuthStore();
    const [selectedRole, setSelectedRole] = useState<string | null>(justRegistered ? 'PATIENT' : null);
    const [step, setStep] = useState<'role' | 'form'>(justRegistered ? 'form' : 'role');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Signed in (now or from a stored session): go to this account's home.
    useEffect(() => {
        if (user) navigate(roleHome(user.role), { replace: true });
    }, [user, navigate]);

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

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-primary) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '32px 16px', position: 'relative', overflow: 'hidden',
        }}>
            {/* Ambient glows */}
            <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(35, 83, 71, 0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46, 107, 91, 0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ width: '100%', maxWidth: step === 'role' ? 900 : 440, transition: 'max-width 0.4s ease', position: 'relative' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16, textDecoration: 'none' }}>
                        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🫀</div>
                        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                            MediSense <span style={{ color: 'var(--accent-primary)' }}>AI</span>
                        </span>
                    </Link>
                    <h1 style={{ fontSize: step === 'role' ? 32 : 26, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                        {step === 'role' ? 'Who are you?' : `Sign in as ${selectedRoleData?.label}`}
                    </h1>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8 }}>
                        {step === 'role' ? 'Select your role to continue' : `Access your ${selectedRoleData?.label.toLowerCase()} dashboard`}
                    </p>
                </div>

                {/* Step 1: Role tiles */}
                {step === 'role' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
                        {ROLES.map(role => (
                            <button
                                key={role.id}
                                onClick={() => handleRoleSelect(role.id)}
                                style={{
                                    background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16,
                                    padding: '28px 24px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'var(--surface-1)'; }}
                            >
                                <div style={{ fontSize: 36, marginBottom: 14 }}>{role.icon}</div>
                                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{role.label}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{role.desc}</div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Step 2: Login form */}
                {step === 'form' && selectedRoleData && (
                    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20, padding: 36 }}>
                        {justRegistered && (
                            <div role="status" style={{ marginBottom: 20, padding: '10px 14px', background: 'rgba(63, 138, 102, 0.10)', border: '1px solid rgba(63, 138, 102, 0.3)', borderRadius: 8, fontSize: 13, color: 'var(--risk-low-text)' }}>
                                Account created. Sign in with the email and password you just set.
                            </div>
                        )}

                        {/* Role badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--surface-border)' }}>
                            <span style={{ fontSize: 24 }}>{selectedRoleData.icon}</span>
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>Signing in as</div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedRoleData.label}</div>
                            </div>
                            <button onClick={() => { setStep('role'); setError(''); }} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6 }}>
                                ← Change
                            </button>
                        </div>

                        <form onSubmit={handleLogin}>
                            <div style={{ marginBottom: 16 }}>
                                <label htmlFor="login-email" style={labelStyle}>Email address</label>
                                <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                    placeholder="you@example.com" autoComplete="email" style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
                            </div>

                            <div style={{ marginBottom: 24, position: 'relative' }}>
                                <label htmlFor="login-password" style={labelStyle}>Password</label>
                                <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                    placeholder="••••••••" autoComplete="current-password" style={{ ...inputStyle, paddingRight: 44 }} onFocus={focusBorder} onBlur={blurBorder} />
                                <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    style={{ position: 'absolute', right: 14, top: 38, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 0 }}>
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>

                            {error && (
                                <div role="alert" style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(200, 67, 75, 0.1)', border: '1px solid rgba(200, 67, 75, 0.25)', borderRadius: 8, fontSize: 13, color: 'var(--risk-critical-text)' }}>
                                    {error}
                                </div>
                            )}

                            <button type="submit" disabled={submitting} style={{
                                width: '100%', padding: 14, borderRadius: 10, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))',
                                color: '#fff', fontSize: 15, fontWeight: 700, opacity: submitting ? 0.7 : 1,
                            }}>
                                {submitting ? 'Signing in…' : `Sign in as ${selectedRoleData.label}`}
                            </button>
                        </form>

                        <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--surface-border)', fontSize: 13 }}>
                            {selectedRole === 'PATIENT' ? (
                                <>
                                    <span style={{ color: 'var(--text-muted)' }}>New here? </span>
                                    <Link to="/register" style={{ color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none' }}>Create a patient account →</Link>
                                </>
                            ) : (
                                <span style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                    Staff accounts are created by your hospital administrator.
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
