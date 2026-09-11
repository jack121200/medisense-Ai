import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/axiosInstance';
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];
const SMOKING = ['Never', 'Former', 'Current'];
const ALCOHOL = ['Never', 'Occasional', 'Regular', 'Heavy'];

const ROLES = [
    {
        id: 'PATIENT',
        label: 'Patient',
        icon: '🫀',
        desc: 'Book appointments, view cardiac reports, manage your heart health records',
        color: 'var(--risk-low-text)',
        endpoint: '/auth/patient-register',
    },
    {
        id: 'DOCTOR',
        label: 'Cardiologist',
        icon: '🩺',
        desc: 'Access patient cardiac records, view AI diagnostics, run heart risk analysis',
        color: 'var(--accent-primary)',
        endpoint: '/auth/register',
    },
    {
        id: 'RECEPTIONIST',
        label: 'Receptionist',
        icon: '📋',
        desc: 'Manage appointments, handle patient intake and scheduling',
        color: 'var(--risk-medium-text)',
        endpoint: '/auth/register',
    },
    {
        id: 'LAB_TECHNICIAN',
        label: 'Lab Technician',
        icon: '🧪',
        desc: 'Upload CBC reports, extract lab values, link reports to patient records',
        color: 'var(--accent-primary-hover)',
        endpoint: '/auth/register',
    },
];

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--surface-border-md)',
    background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500,
};

export default function RegisterPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselected = searchParams.get('role');

    const [selectedRole, setSelectedRole] = useState<string | null>(preselected);
    const [step, setStep] = useState(preselected ? 1 : 0); // 0=role picker, 1=basic, 2=medical/extra, 3=emergency/confirm
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
        dateOfBirth: '', gender: '', phone: '', address: '', city: '',
        // Medical history (patient only)
        bloodGroup: '', allergies: '', medicalHistory: '', currentMedications: '',
        smokingStatus: 'Never', alcoholUse: 'Never',
        hasDiabetes: false, hasHypertension: false, hasHeartDisease: false,
        hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false,
        // Emergency contact
        emergencyContactName: '', emergencyContactPhone: '', emergencyContactRel: '',
    });

    const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
    const roleObj = ROLES.find(r => r.id === selectedRole);
    const isPatient = selectedRole === 'PATIENT';
    const isDoctor = selectedRole === 'DOCTOR';

    // How many data steps for this role (not counting role picker as step)
    const totalSteps = isPatient ? 3 : 1;
    // Data step labels
    const stepLabels = isPatient
        ? ['Basic Info', 'Medical History', 'Emergency Contact']
        : ['Basic Info'];

    function validateStep() {
        if (step === 1) {
            if (!form.firstName || !form.lastName) return 'Enter your full name';
            if (!form.email) return 'Email is required';
            if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters';
            if (form.password !== form.confirmPassword) return 'Passwords do not match';
            if (!form.dateOfBirth) return 'Date of birth is required';
            if (!form.gender) return 'Please select gender';
        }
        return null;
    }

    function handleNext() {
        const err = validateStep();
        if (err) { setError(err); return; }
        setError('');
        setStep(s => s + 1);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            if (isPatient) {
                await api.post('/auth/patient-register', {
                    firstName: form.firstName, lastName: form.lastName,
                    email: form.email, password: form.password,
                    dateOfBirth: form.dateOfBirth, gender: form.gender.toUpperCase(),
                    phone: form.phone, address: form.address, city: form.city,
                    bloodGroup: form.bloodGroup || undefined,
                    allergies: form.allergies || undefined,
                    medicalHistory: form.medicalHistory || undefined,
                    currentMedications: form.currentMedications || undefined,
                    smokingStatus: form.smokingStatus.toUpperCase(),
                    alcoholUse: form.alcoholUse.toUpperCase().replace(' ', '_'),
                    emergencyContactName: form.emergencyContactName || undefined,
                    emergencyContactPhone: form.emergencyContactPhone || undefined,
                    emergencyContactRel: form.emergencyContactRel || undefined,
                });
            } else {
                await api.post('/auth/register', {
                    firstName: form.firstName, lastName: form.lastName,
                    email: form.email, password: form.password,
                    role: selectedRole,
                    dateOfBirth: form.dateOfBirth, gender: form.gender.toUpperCase(),
                    phone: form.phone,
                    // Doctors are always Cardiologist — specialization is set server-side
                });
            }
            navigate('/login?registered=1');
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    // ── ROLE PICKER SCREEN ────────────────────────────────────────────────────
    if (step === 0) {
        return (
            <div style={{
                minHeight: '100vh', background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-primary) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Inter", system-ui, sans-serif', padding: '24px',
            }}>
                <div style={{ width: '100%', maxWidth: 640 }}>
                    {/* Logo */}
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🫀</div>
                            <span style={{ fontSize: 22, fontWeight: 900, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-primary-hover))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MediSense AI</span>
                        </div>
                        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8 }}>Register As</h1>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Choose your role to get started</p>
                    </div>

                    {/* Role cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        {ROLES.map(role => (
                            <button key={role.id} onClick={() => { setSelectedRole(role.id); setStep(1); }}
                                style={{
                                    padding: '28px 20px', borderRadius: 18, border: `1px solid ${role.color}30`,
                                    background: `${role.color}08`, cursor: 'pointer', textAlign: 'left',
                                    transition: 'all 0.18s', display: 'flex', flexDirection: 'column', gap: 10,
                                }}
                                onMouseOver={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = `${role.color}18`;
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = `${role.color}60`;
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)';
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 12px 40px ${role.color}20`;
                                }}
                                onMouseOut={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = `${role.color}08`;
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = `${role.color}30`;
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                                }}
                            >
                                <div style={{ fontSize: 36 }}>{role.icon}</div>
                                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>{role.label}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{role.desc}</div>
                                <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, color: role.color, fontSize: 13, fontWeight: 700 }}>
                                    Register as {role.label} →
                                </div>
                            </button>
                        ))}
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Already have an account? </span>
                        <Link to="/login" style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none' }}>Sign In →</Link>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                        <Link to="/" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>← Back to home</Link>
                    </div>
                </div>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>
            </div>
        );
    }

    // ── REGISTRATION FORM ─────────────────────────────────────────────────────
    const accentColor = roleObj?.color || 'var(--accent-primary)';
    const dataStep = step - 1; // 0-indexed within form steps

    return (
        <div style={{
            minHeight: '100vh', background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-primary) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Inter", system-ui, sans-serif', padding: '24px', overflowY: 'auto',
        }}>
            <div style={{ width: '100%', maxWidth: 560 }}>
                {/* Logo + role badge */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dim))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🫀</div>
                        <span style={{ fontSize: 18, fontWeight: 900, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-primary-hover))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MediSense AI</span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, background: `${accentColor}15`, border: `1px solid ${accentColor}40`, marginBottom: 10 }}>
                        <span style={{ fontSize: 16 }}>{roleObj?.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>Registering as {roleObj?.label}</span>
                    </div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{stepLabels[dataStep]}</h1>
                </div>

                {/* Step indicator */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 0 }}>
                    {stepLabels.map((label, i) => (
                        <React.Fragment key={i}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: i < dataStep ? accentColor : i === dataStep ? `${accentColor}30` : 'var(--surface-2)',
                                    border: i === dataStep ? `2px solid ${accentColor}` : '2px solid transparent',
                                    fontSize: 13, fontWeight: 700, color: i <= dataStep ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.3s',
                                }}>
                                    {i < dataStep ? '✓' : i + 1}
                                </div>
                                <span style={{ fontSize: 10, color: i <= dataStep ? accentColor : 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
                            </div>
                            {i < stepLabels.length - 1 && (
                                <div style={{ width: 50, height: 2, background: i < dataStep ? accentColor : 'var(--surface-2)', margin: '0 6px', marginBottom: 20, transition: 'background 0.3s' }} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20, padding: 28 }}>

                    {/* ── STEP 1: Basic Info (all roles) ── */}
                    {step === 1 && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                <div><label style={labelStyle}>First Name *</label><input style={inputStyle} value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="John" /></div>
                                <div><label style={labelStyle}>Last Name *</label><input style={inputStyle} value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Doe" /></div>
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Email Address *</label>
                                <input type="email" style={inputStyle} value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                <div><label style={labelStyle}>Password *</label><input type="password" style={inputStyle} value={form.password} onChange={e => update('password', e.target.value)} placeholder="Min 8 characters" /></div>
                                <div><label style={labelStyle}>Confirm Password *</label><input type="password" style={inputStyle} value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} placeholder="Repeat password" /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                <div>
                                    <label style={labelStyle}>Date of Birth *</label>
                                    <input type="date" style={inputStyle} value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Gender *</label>
                                    <select style={{ ...inputStyle, appearance: 'none' }} value={form.gender} onChange={e => update('gender', e.target.value)}>
                                        <option value="">Select</option>
                                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+91 98765 43210" /></div>
                                <div><label style={labelStyle}>City</label><input style={inputStyle} value={form.city} onChange={e => update('city', e.target.value)} placeholder="Mumbai" /></div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2 (PATIENT): Medical History ── */}
                    {step === 2 && isPatient && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                <div>
                                    <label style={labelStyle}>Blood Group</label>
                                    <select style={{ ...inputStyle, appearance: 'none' }} value={form.bloodGroup} onChange={e => update('bloodGroup', e.target.value)}>
                                        <option value="">Select</option>
                                        {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Smoking Status</label>
                                    <select style={{ ...inputStyle, appearance: 'none' }} value={form.smokingStatus} onChange={e => update('smokingStatus', e.target.value)}>
                                        {SMOKING.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Alcohol Use</label>
                                <select style={{ ...inputStyle, appearance: 'none' }} value={form.alcoholUse} onChange={e => update('alcoholUse', e.target.value)}>
                                    {ALCOHOL.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Known Allergies</label>
                                <textarea style={{ ...inputStyle, height: 64, resize: 'none' }} value={form.allergies} onChange={e => update('allergies', e.target.value)} placeholder="e.g. Penicillin, Peanuts..." />
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Past Medical History</label>
                                <textarea style={{ ...inputStyle, height: 64, resize: 'none' }} value={form.medicalHistory} onChange={e => update('medicalHistory', e.target.value)} placeholder="e.g. Appendectomy 2019..." />
                            </div>
                            <div>
                                <label style={labelStyle}>Existing Conditions</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {[['hasDiabetes','Diabetes'],['hasHypertension','Hypertension'],['hasHeartDisease','Heart Disease'],['hasCKD','Chronic Kidney Disease'],['hasAsthma','Asthma'],['hasObesity','Obesity']].map(([key, label]) => (
                                        <label key={key} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'var(--text-secondary)' }}>
                                            <input type="checkbox" checked={(form as any)[key]} onChange={e => update(key, e.target.checked)} style={{ width:15, height:15, accentColor }} />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2 (DOCTOR): Static Cardiologist Info ── */}
                    {step === 2 && isDoctor && (
                        <div>
                            <div style={{ padding: '20px', background: 'rgba(35, 83, 71, 0.07)', border: '1px solid rgba(35, 83, 71, 0.2)', borderRadius: 14, marginBottom: 16, textAlign: 'center' }}>
                                <div style={{ fontSize: 40, marginBottom: 8 }}>🫀</div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent-primary)', marginBottom: 6 }}>Cardiologist</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                    All doctors in MediSense AI are registered as Cardiologists.<br />
                                    Your specialization is set automatically upon account creation.
                                </div>
                            </div>
                            <div style={{ padding: '12px 16px', background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 10 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                    ✅ Your account will be reviewed by an admin before activation.<br />
                                    You will receive access to the cardiac AI tools upon approval.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2 (RECEPTIONIST/LABTECH): Confirm ── */}
                    {step === 2 && !isPatient && !isDoctor && (
                        <div>
                            <div style={{ padding: '18px', background: `${accentColor}10`, border: `1px solid ${accentColor}25`, borderRadius: 12, marginBottom: 16 }}>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
                                    You are registering as a <strong style={{ color: accentColor }}>{roleObj?.label}</strong>.<br />
                                    Your account will need to be approved by an admin before you can log in.<br /><br />
                                    <strong>Name:</strong> {form.firstName} {form.lastName}<br />
                                    <strong>Email:</strong> {form.email}<br />
                                    <strong>Role:</strong> {roleObj?.label}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3 (PATIENT): Emergency Contact ── */}
                    {step === 3 && isPatient && (
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Emergency Contact Name</label>
                                <input style={inputStyle} value={form.emergencyContactName} onChange={e => update('emergencyContactName', e.target.value)} placeholder="Jane Doe" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                <div><label style={labelStyle}>Contact Phone</label><input style={inputStyle} value={form.emergencyContactPhone} onChange={e => update('emergencyContactPhone', e.target.value)} placeholder="+91 98765 43210" /></div>
                                <div><label style={labelStyle}>Relationship</label><input style={inputStyle} value={form.emergencyContactRel} onChange={e => update('emergencyContactRel', e.target.value)} placeholder="Mother, Spouse..." /></div>
                            </div>
                            <div style={{ padding: '14px', background: 'rgba(63, 138, 102, 0.07)', border: '1px solid rgba(63, 138, 102, 0.2)', borderRadius: 10, marginBottom: 18 }}>
                                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                                    ✓ By registering, you agree to provide accurate medical information. Your data is secured and only accessible to authorized medical staff.
                                </p>
                            </div>
                            {error && <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(200, 67, 75, 0.1)', border: '1px solid rgba(200, 67, 75, 0.25)', borderRadius: 8, fontSize: 13, color: 'var(--risk-high-text)' }}>⚠️ {error}</div>}
                            <button type="submit" disabled={submitting} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', background: submitting ? `${accentColor}50` : `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, color: '#fff', fontSize: 15, fontWeight: 700, opacity: submitting ? 0.7 : 1 }}>
                                {submitting ? '⏳ Creating account...' : `✅ Create ${roleObj?.label} Account`}
                            </button>
                        </form>
                    )}

                    {/* ── FINAL SUBMIT for non-patient ── */}
                    {step === 2 && !isPatient && (
                        <form onSubmit={handleSubmit} style={{ marginTop: 0 }}>
                            {error && <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(200, 67, 75, 0.1)', border: '1px solid rgba(200, 67, 75, 0.25)', borderRadius: 8, fontSize: 13, color: 'var(--risk-high-text)' }}>⚠️ {error}</div>}
                        </form>
                    )}

                    {/* Error for non-final steps */}
                    {error && step < (isPatient ? 3 : 2) && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(200, 67, 75, 0.1)', border: '1px solid rgba(200, 67, 75, 0.25)', borderRadius: 8, fontSize: 13, color: 'var(--risk-high-text)' }}>⚠️ {error}</div>
                    )}

                    {/* Navigation buttons */}
                    {!(step === 3 && isPatient) && (
                        <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                            <button onClick={() => { setStep(s => s - 1); setError(''); }}
                                style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid var(--surface-border-md)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                                ← Back
                            </button>
                            {step < (isPatient ? 3 : 2) ? (
                                <button onClick={handleNext}
                                    style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                    Next →
                                </button>
                            ) : (
                                // Final step for non-patient (step 2, non-patient)
                                <button onClick={(e: any) => handleSubmit(e as any)} disabled={submitting}
                                    style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: submitting ? `${accentColor}50` : `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                                    {submitting ? '⏳ Creating...' : `✅ Create ${roleObj?.label} Account`}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ textAlign: 'center', marginTop: 18, display: 'flex', justifyContent: 'center', gap: 20 }}>
                    <button onClick={() => { setStep(0); setSelectedRole(null); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>← Change role</button>
                    <Link to="/login" style={{ fontSize: 13, color: accentColor, fontWeight: 600, textDecoration: 'none' }}>Already registered? Sign In →</Link>
                </div>
            </div>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                input::placeholder, textarea::placeholder { color: var(--text-muted); }
                select option { background: var(--surface-0); color: var(--surface-0); }
                input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
            `}</style>
        </div>
    );
}

