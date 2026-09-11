import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axiosInstance';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];
const SMOKING = ['Never', 'Former', 'Current'];
const ALCOHOL = ['Never', 'Occasional', 'Regular', 'Heavy'];
// Saved to the patient record, where the AI Doctor reads them for its
// herb-interaction checks and knowledge retrieval.
const CONDITIONS = [
    ['hasDiabetes', 'Diabetes'], ['hasHypertension', 'High blood pressure'], ['hasHeartDisease', 'Heart disease'],
    ['hasCKD', 'Chronic kidney disease'], ['hasAsthma', 'Asthma'], ['hasCOPD', 'COPD'], ['hasObesity', 'Obesity'],
] as const;
const STEPS = ['Basic info', 'Medical history', 'Emergency contact'];

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--surface-border-md)',
    background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500,
};
const pair: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 };
const errorBox: React.CSSProperties = {
    marginTop: 14, padding: '10px 14px', background: 'rgba(200, 67, 75, 0.1)', border: '1px solid rgba(200, 67, 75, 0.25)',
    borderRadius: 8, fontSize: 13, color: 'var(--risk-critical-text)',
};

/**
 * Patient self-registration only. Staff accounts are created by an admin on
 * the Users page. The public staff sign-up this page used to offer created
 * active accounts in any staff role for anyone, while telling them an admin
 * would review it first.
 */
export default function RegisterPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
        dateOfBirth: '', gender: '', phone: '', city: '',
        bloodGroup: '', allergies: '', medicalHistory: '', currentMedications: '',
        smokingStatus: 'Never', alcoholUse: 'Never',
        hasDiabetes: false, hasHypertension: false, hasHeartDisease: false,
        hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false,
        emergencyContactName: '', emergencyContactPhone: '', emergencyContactRel: '',
    });
    const update = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

    function validateBasics() {
        if (!form.firstName.trim() || !form.lastName.trim()) return 'Enter your full name';
        if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Enter a valid email address';
        if (form.password.length < 8) return 'Password must be at least 8 characters';
        if (form.password !== form.confirmPassword) return 'Passwords do not match';
        if (!form.dateOfBirth) return 'Date of birth is required';
        if (new Date(form.dateOfBirth) > new Date()) return 'Date of birth cannot be in the future';
        if (!form.gender) return 'Please select gender';
        return null;
    }

    async function submit() {
        setSubmitting(true);
        setError('');
        try {
            await api.post('/auth/patient-register', {
                firstName: form.firstName.trim(), lastName: form.lastName.trim(),
                email: form.email.trim(), password: form.password,
                dateOfBirth: form.dateOfBirth, gender: form.gender.toUpperCase(),
                phone: form.phone || undefined, city: form.city || undefined,
                bloodGroup: form.bloodGroup || undefined,
                allergies: form.allergies || undefined,
                medicalHistory: form.medicalHistory || undefined,
                currentMedications: form.currentMedications || undefined,
                smokingStatus: form.smokingStatus.toUpperCase(),
                alcoholUse: form.alcoholUse.toUpperCase(),
                ...Object.fromEntries(CONDITIONS.map(([key]) => [key, form[key]])),
                emergencyContactName: form.emergencyContactName || undefined,
                emergencyContactPhone: form.emergencyContactPhone || undefined,
                emergencyContactRel: form.emergencyContactRel || undefined,
            });
            navigate('/login?registered=1');
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (step === 0) {
            const err = validateBasics();
            if (err) { setError(err); return; }
        }
        setError('');
        if (step < STEPS.length - 1) setStep(s => s + 1);
        else submit();
    }

    return (
        <div style={{
            minHeight: '100vh', background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-primary) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px',
        }}>
            <div style={{ width: '100%', maxWidth: 560 }}>
                {/* Logo + title */}
                <div style={{ textAlign: 'center', marginBottom: 26 }}>
                    <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14, textDecoration: 'none' }}>
                        <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🫀</div>
                        <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>MediSense AI</span>
                    </Link>
                    <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
                        Create your patient account
                    </h1>
                    <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                        Book appointments, see your reports and consult the AI health assistant.
                    </p>
                </div>

                {/* Step indicator */}
                <ol style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 6, listStyle: 'none', padding: 0, margin: '0 0 22px' }}>
                    {STEPS.map((label, i) => {
                        const done = i < step;
                        const current = i === step;
                        return (
                            <React.Fragment key={label}>
                                <li style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }} aria-current={current ? 'step' : undefined}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
                                        background: done ? 'var(--accent-primary)' : current ? 'rgba(35, 83, 71, 0.12)' : 'var(--surface-2)',
                                        border: current ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                        color: done ? '#fff' : current ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    }}>
                                        {done ? '✓' : i + 1}
                                    </div>
                                    <span style={{ fontSize: 11, color: done || current ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
                                </li>
                                {i < STEPS.length - 1 && (
                                    <div aria-hidden style={{ width: 44, height: 2, marginTop: 15, background: done ? 'var(--accent-primary)' : 'var(--surface-2)', transition: 'background 0.2s' }} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </ol>

                <form onSubmit={handleSubmit} noValidate style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20, padding: 28 }}>
                    {step === 0 && (
                        <div>
                            <div style={pair}>
                                <div><label style={labelStyle}>First name *</label><input style={inputStyle} value={form.firstName} onChange={e => update('firstName', e.target.value)} autoComplete="given-name" /></div>
                                <div><label style={labelStyle}>Last name *</label><input style={inputStyle} value={form.lastName} onChange={e => update('lastName', e.target.value)} autoComplete="family-name" /></div>
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Email address *</label>
                                <input type="email" style={inputStyle} value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" autoComplete="email" />
                            </div>
                            <div style={pair}>
                                <div><label style={labelStyle}>Password *</label><input type="password" style={inputStyle} value={form.password} onChange={e => update('password', e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" /></div>
                                <div><label style={labelStyle}>Confirm password *</label><input type="password" style={inputStyle} value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} autoComplete="new-password" /></div>
                            </div>
                            <div style={pair}>
                                <div>
                                    <label style={labelStyle}>Date of birth *</label>
                                    <input type="date" style={inputStyle} value={form.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={e => update('dateOfBirth', e.target.value)} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Gender *</label>
                                    <select style={inputStyle} value={form.gender} onChange={e => update('gender', e.target.value)}>
                                        <option value="">Select</option>
                                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ ...pair, marginBottom: 0 }}>
                                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" /></div>
                                <div><label style={labelStyle}>City</label><input style={inputStyle} value={form.city} onChange={e => update('city', e.target.value)} autoComplete="address-level2" /></div>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div>
                            <div style={pair}>
                                <div>
                                    <label style={labelStyle}>Blood group</label>
                                    <select style={inputStyle} value={form.bloodGroup} onChange={e => update('bloodGroup', e.target.value)}>
                                        <option value="">Not sure</option>
                                        {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Smoking</label>
                                    <select style={inputStyle} value={form.smokingStatus} onChange={e => update('smokingStatus', e.target.value)}>
                                        {SMOKING.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Alcohol</label>
                                    <select style={inputStyle} value={form.alcoholUse} onChange={e => update('alcoholUse', e.target.value)}>
                                        {ALCOHOL.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Known allergies</label>
                                <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={form.allergies} onChange={e => update('allergies', e.target.value)} placeholder="e.g. Penicillin, peanuts" />
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Current medicines</label>
                                <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={form.currentMedications} onChange={e => update('currentMedications', e.target.value)} placeholder="Name and dose of anything you take regularly" />
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Past medical history</label>
                                <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={form.medicalHistory} onChange={e => update('medicalHistory', e.target.value)} placeholder="e.g. Appendix surgery 2019" />
                            </div>
                            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                                <legend style={labelStyle}>Existing conditions</legend>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                                    {CONDITIONS.map(([key, label]) => (
                                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                                            <input type="checkbox" checked={form[key]} onChange={e => update(key, e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--accent-primary)' }} />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Emergency contact name</label>
                                <input style={inputStyle} value={form.emergencyContactName} onChange={e => update('emergencyContactName', e.target.value)} />
                            </div>
                            <div style={pair}>
                                <div><label style={labelStyle}>Contact phone</label><input style={inputStyle} value={form.emergencyContactPhone} onChange={e => update('emergencyContactPhone', e.target.value)} placeholder="+91 98765 43210" /></div>
                                <div><label style={labelStyle}>Relationship</label><input style={inputStyle} value={form.emergencyContactRel} onChange={e => update('emergencyContactRel', e.target.value)} placeholder="Mother, spouse…" /></div>
                            </div>
                            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, padding: '12px 14px', background: 'rgba(63, 138, 102, 0.07)', border: '1px solid rgba(63, 138, 102, 0.2)', borderRadius: 10 }}>
                                Your record is visible only to you and the hospital staff treating you.
                            </p>
                        </div>
                    )}

                    {error && <div role="alert" style={errorBox}>{error}</div>}

                    <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                        {step > 0 && (
                            <button type="button" onClick={() => { setStep(s => s - 1); setError(''); }}
                                style={{ flex: 1, padding: 13, borderRadius: 10, border: '1px solid var(--surface-border-md)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                                Back
                            </button>
                        )}
                        <button type="submit" disabled={submitting}
                            style={{ flex: 2, padding: 13, borderRadius: 10, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                            {step < STEPS.length - 1 ? 'Next' : submitting ? 'Creating account…' : 'Create account'}
                        </button>
                    </div>
                </form>

                <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Already have an account? </span>
                    <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
                </div>
                <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
                    Hospital staff? Your account is created by your administrator — sign in with the details they gave you.
                </p>
            </div>
        </div>
    );
}
