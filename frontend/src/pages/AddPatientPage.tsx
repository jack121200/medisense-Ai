import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ArrowLeft, Phone, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { patientApi } from '../api/patient.api';
import { useAppointmentStore } from '../store/appointmentStore';
import toast from 'react-hot-toast';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['MALE', 'FEMALE', 'OTHER'];

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div>
        <label style={{
            display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 7,
        }}>
            {label} {required && <span style={{ color: 'var(--risk-critical-text)' }}>*</span>}
        </label>
        {children}
    </div>
);

export default function AddPatientPage() {
    const navigate = useNavigate();
    const { addManualPatientId } = useAppointmentStore();
    const [loading, setLoading] = useState(false);
    const [smsSent, setSmsSent] = useState(false);
    const [createdPatient, setCreatedPatient] = useState<any>(null);

    const [form, setForm] = useState({
        firstName: '', lastName: '', dateOfBirth: '', gender: 'MALE',
        bloodType: 'O+', phone: '', email: '',
        address: '', city: '',
        emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
        medicalHistory: '', allergies: '', currentMedications: '',
        insuranceProvider: '', insuranceNumber: '',
        notes: '',
    });

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.firstName || !form.lastName || !form.dateOfBirth || !form.phone) {
            toast.error('Fill in all required fields'); return;
        }
        setLoading(true);
        try {
            const payload = {
                firstName: form.firstName, lastName: form.lastName,
                dateOfBirth: form.dateOfBirth, gender: form.gender,
                bloodType: form.bloodType,
                contactInfo: {
                    phone: form.phone, email: form.email || undefined,
                    address: form.address ? `${form.address}, ${form.city}` : undefined,
                },
                emergencyContact: form.emergencyContactName ? {
                    name: form.emergencyContactName,
                    phone: form.emergencyContactPhone,
                    relation: form.emergencyContactRelation || 'Family',
                } : undefined,
                medicalHistory: form.medicalHistory || undefined,
                allergies: form.allergies ? form.allergies.split(',').map(a => a.trim()) : undefined,
                currentMedications: form.currentMedications ? form.currentMedications.split(',').map(m => m.trim()) : undefined,
                insuranceInfo: form.insuranceProvider ? {
                    provider: form.insuranceProvider, policyNumber: form.insuranceNumber,
                } : undefined,
                notes: form.notes || undefined,
            };

            const { data } = await patientApi.create(payload);
            const patient = data.data;
            addManualPatientId(patient.id);
            setCreatedPatient(patient);

            // Simulate SMS
            setTimeout(() => {
                setSmsSent(true);
                toast.success(`📱 SMS sent to ${form.phone}`);
            }, 800);

            toast.success(`Patient ${form.firstName} ${form.lastName} registered successfully!`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to register patient');
        } finally {
            setLoading(false);
        }
    };

    // ── SUCCESS STATE ─────────────────────────────────────
    if (createdPatient) {
        return (
            <div className="page-enter" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 20 }}>
                <div style={{
                    background: 'var(--surface-1)', border: '1px solid rgba(24, 155, 130, 0.20)',
                    borderRadius: 20, padding: '36px 32px', textAlign: 'center',
                }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
                        background: 'rgba(24, 155, 130, 0.12)', border: '2px solid rgba(24, 155, 130, 0.30)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <CheckCircle2 size={36} color="var(--accent-green-text)" />
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 8 }}>
                        Patient Registered!
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                        {form.firstName} {form.lastName} has been added to the system.
                    </p>

                    {/* Patient ID Card */}
                    <div style={{
                        background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                        borderRadius: 14, padding: '16px 20px', marginBottom: 20,
                        display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left',
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 14,
                            background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-dim) 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 16, color: 'var(--bg-primary)', flexShrink: 0,
                        }}>
                            {form.firstName[0]}{form.lastName[0]}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                                {form.firstName} {form.lastName}
                            </div>
                            <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                ID: {createdPatient.patientCode || createdPatient.id?.slice(0, 8).toUpperCase()}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                📞 {form.phone}
                            </div>
                        </div>
                    </div>

                    {/* SMS simulation */}
                    {smsSent && (
                        <div style={{
                            background: 'rgba(13, 92, 126, 0.04)', border: '1px solid rgba(13, 92, 126, 0.15)',
                            borderRadius: 14, padding: '16px 20px', marginBottom: 24, textAlign: 'left',
                        }}>
                            <div style={{
                                fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)',
                                marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                            }}>
                                📱 SMS Sent to {form.phone}
                            </div>
                            <div style={{
                                background: 'var(--surface-1)', borderRadius: 10, padding: '12px 14px',
                                fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                                fontFamily: 'var(--font-mono)', borderLeft: '3px solid var(--accent-primary)',
                            }}>
                                Dear {form.firstName}, welcome to MediSense AI.
                                Your patient ID is <strong style={{ color: 'var(--text-primary)' }}>
                                    {createdPatient.patientCode || createdPatient.id?.slice(0, 8).toUpperCase()}
                                </strong>.
                                Please carry this ID for all visits.
                                For appointments: call 1800-MED-SENSE.
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button
                            onClick={() => navigate(`/patients/${createdPatient.id}`)}
                            className="btn-primary"
                        >
                            View Patient Profile
                        </button>
                        <button
                            onClick={() => navigate('/appointments?new=1&patientId=' + createdPatient.id)}
                            className="btn-ghost"
                            style={{ background: 'rgba(13, 92, 126, 0.06)', border: '1px solid rgba(13, 92, 126, 0.20)' }}
                        >
                            Book Appointment
                        </button>
                        <button onClick={() => { setCreatedPatient(null); setSmsSent(false); setForm(f => ({ ...f, firstName: '', lastName: '' })); }} className="btn-ghost">
                            Register Another
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── FORM ─────────────────────────────────────
    return (
        <div className="page-enter">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <button onClick={() => navigate('/patients')} className="btn-ghost" style={{ padding: '7px 10px' }}>
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserPlus size={22} color="var(--accent-primary)" />
                        <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                            Register New Patient
                        </h1>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                        Patient will receive an SMS confirmation on their phone.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                    {/* ── PERSONAL INFO ── */}
                    <div style={{
                        background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                        borderRadius: 18, padding: '24px', position: 'relative', overflow: 'hidden',
                        gridColumn: '1 / -1',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent-primary)', opacity: 0.5 }} />
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Personal Information
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                            <Field label="First Name" required>
                                <input className="form-input" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Rahul" required />
                            </Field>
                            <Field label="Last Name" required>
                                <input className="form-input" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Sharma" required />
                            </Field>
                            <Field label="Date of Birth" required>
                                <input type="date" className="form-input" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} required />
                            </Field>
                            <Field label="Gender">
                                <select className="form-input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                                    {GENDERS.map(g => <option key={g}>{g}</option>)}
                                </select>
                            </Field>
                            <Field label="Blood Type">
                                <select className="form-input" value={form.bloodType} onChange={e => set('bloodType', e.target.value)}>
                                    {BLOOD_TYPES.map(b => <option key={b}>{b}</option>)}
                                </select>
                            </Field>
                        </div>
                    </div>

                    {/* ── CONTACT ── */}
                    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent-green)', opacity: 0.5 }} />
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: 'var(--accent-green-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Contact Details
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <Field label="Phone Number" required>
                                <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" required type="tel" />
                            </Field>
                            <Field label="Email (Optional)">
                                <input type="email" className="form-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="patient@example.com" />
                            </Field>
                            <Field label="Address">
                                <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123, Street Name" />
                            </Field>
                            <Field label="City">
                                <input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Mumbai" />
                            </Field>
                        </div>
                    </div>

                    {/* ── EMERGENCY CONTACT ── */}
                    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--risk-high)', opacity: 0.5 }} />
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: 'var(--risk-high-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Emergency Contact
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <Field label="Contact Name">
                                <input className="form-input" value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} placeholder="Priya Sharma" />
                            </Field>
                            <Field label="Contact Phone">
                                <input className="form-input" value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} placeholder="+91 98765 43211" type="tel" />
                            </Field>
                            <Field label="Relation">
                                <input className="form-input" value={form.emergencyContactRelation} onChange={e => set('emergencyContactRelation', e.target.value)} placeholder="Wife, Father, Son..." />
                            </Field>
                        </div>
                    </div>

                    {/* ── MEDICAL ── */}
                    <div style={{
                        background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                        borderRadius: 18, padding: '24px', position: 'relative', overflow: 'hidden',
                        gridColumn: '1 / -1',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent-magenta)', opacity: 0.5 }} />
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: 'var(--accent-magenta)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Medical Information
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Field label="Medical History">
                                <textarea className="form-input" rows={3} value={form.medicalHistory} onChange={e => set('medicalHistory', e.target.value)} placeholder="Diabetes Type 2, Hypertension..." style={{ resize: 'vertical', minHeight: 80 }} />
                            </Field>
                            <Field label="Allergies (comma-separated)">
                                <textarea className="form-input" rows={3} value={form.allergies} onChange={e => set('allergies', e.target.value)} placeholder="Penicillin, Sulfa drugs..." style={{ resize: 'vertical', minHeight: 80 }} />
                            </Field>
                            <Field label="Current Medications (comma-separated)">
                                <textarea className="form-input" rows={3} value={form.currentMedications} onChange={e => set('currentMedications', e.target.value)} placeholder="Metformin 500mg, Lisinopril..." style={{ resize: 'vertical', minHeight: 80 }} />
                            </Field>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <Field label="Insurance Provider">
                                    <input className="form-input" value={form.insuranceProvider} onChange={e => set('insuranceProvider', e.target.value)} placeholder="Star Health, HDFC Ergo..." />
                                </Field>
                                <Field label="Policy Number">
                                    <input className="form-input" value={form.insuranceNumber} onChange={e => set('insuranceNumber', e.target.value)} placeholder="POL-12345678" />
                                </Field>
                            </div>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <Field label="Additional Notes">
                                <textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any special instructions for the care team..." style={{ resize: 'vertical' }} />
                            </Field>
                        </div>
                    </div>
                </div>

                {/* ── SMS NOTICE ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
                    background: 'rgba(13, 92, 126, 0.05)', border: '1px solid rgba(13, 92, 126, 0.15)',
                    borderRadius: 12, margin: '20px 0',
                }}>
                    <MessageSquare size={16} color="var(--accent-primary)" />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        An SMS with Patient ID and welcome message will be sent to{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>{form.phone || 'the patient\'s phone number'}</strong> upon registration.
                    </span>
                </div>

                <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15 }}>
                    {loading ? (
                        <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Registering Patient...</>
                    ) : (
                        <><UserPlus size={17} /> Register Patient & Send SMS</>
                    )}
                </button>
            </form>
        </div>
    );
}

