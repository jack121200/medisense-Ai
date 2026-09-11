import React, { useEffect, useState } from 'react';
import api from '../api/axiosInstance';
import { Plus, UserX, UserCheck, UserCog, X, Copy, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';

// Literal hex, not CSS variables: the avatar and badge tints are built by
// appending an alpha suffix, which a var() reference cannot take.
const ROLE_COLORS: Record<string, string> = {
    SUPER_ADMIN: '#5B4B8A',
    ADMIN: '#5B4B8A',
    DOCTOR: '#235347',
    NURSE: '#2B6A4F',
    LAB_TECHNICIAN: '#3F7A63',
    RECEPTIONIST: '#7A5C14',
    ANALYST: '#924E21',
    PATIENT: '#3E5A52',
};
const STAFF_ROLES = ['DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'ANALYST'];
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];
const EMPTY_FORM = { email: '', firstName: '', lastName: '', role: 'DOCTOR', department: '' };

const roleLabel = (role: string) => role.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
const errorMessage = (err: any, fallback: string) => err?.response?.data?.message || fallback;

const fieldLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.08em',
};

export default function UsersPage() {
    const { user } = useAuthStore();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    // The server generates a one-time password for each new account and
    // returns it exactly once; it stays on screen until dismissed.
    const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
    // Only a super admin may create administrators — enforced by the server.
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const roleOptions = isSuperAdmin ? [...STAFF_ROLES, 'ADMIN'] : STAFF_ROLES;

    useEffect(() => {
        api.get('/users')
            .then(r => setUsers(r.data.data || []))
            .catch(err => toast.error(errorMessage(err, 'Could not load users')))
            .finally(() => setLoading(false));
    }, []);

    const addUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/users', form);
            const { generatedPassword, ...created } = data.data;
            setUsers(u => [created, ...u]);
            setShowAdd(false);
            setForm(EMPTY_FORM);
            if (generatedPassword) setIssued({ email: created.email, password: generatedPassword });
            toast.success(`Account created for ${created.email}`);
        } catch (err) { toast.error(errorMessage(err, 'Failed to create user')); }
    };

    const toggleActive = async (u: any) => {
        try {
            await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
            toast.success(`User ${u.isActive ? 'deactivated' : 'reactivated'}`);
        } catch (err) { toast.error(errorMessage(err, 'Could not update user')); }
    };

    const copyPassword = async () => {
        if (!issued) return;
        try {
            await navigator.clipboard.writeText(issued.password);
            toast.success('Password copied');
        } catch {
            toast.error('Copy failed — select the password and copy it manually');
        }
    };

    return (
        <div className="page-enter">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <UserCog size={22} color="var(--accent-primary)" />
                        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                            User Management
                        </h1>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                        {users.length} users · {users.filter(u => u.isActive).length} active
                    </p>
                </div>
                <button onClick={() => setShowAdd(s => !s)} className="btn-primary">
                    {showAdd ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add User</>}
                </button>
            </div>

            {/* One-time password for the account just created */}
            {issued && (
                <div role="status" style={{
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20,
                    background: 'rgba(201, 154, 42, 0.10)', border: '1px solid rgba(201, 154, 42, 0.35)',
                    borderRadius: 14, padding: '14px 18px',
                }}>
                    <KeyRound size={18} color="var(--risk-medium-text)" />
                    <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        One-time password for <strong>{issued.email}</strong>. Share it securely — it won't be shown again.
                        <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, marginTop: 4, userSelect: 'all' }}>{issued.password}</div>
                    </div>
                    <button onClick={copyPassword} className="btn-ghost" style={{ fontSize: 12 }}>
                        <Copy size={13} /> Copy
                    </button>
                    <button onClick={() => setIssued(null)} className="btn-ghost" style={{ fontSize: 12 }} aria-label="Dismiss">
                        <X size={13} />
                    </button>
                </div>
            )}

            {/* Add user form */}
            {showAdd && (
                <div style={{
                    background: 'var(--surface-1)',
                    border: '1px solid rgba(35, 83, 71, 0.20)',
                    borderRadius: 18, padding: '24px 28px', marginBottom: 20,
                }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Create New User</h3>
                    <form onSubmit={addUser}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
                            {(['email', 'firstName', 'lastName'] as const).map(f => (
                                <div key={f}>
                                    <label style={fieldLabel}>
                                        {f === 'firstName' ? 'First Name' : f === 'lastName' ? 'Last Name' : 'Email'}
                                    </label>
                                    <input className="form-input" value={form[f]} onChange={e => setForm(x => ({ ...x, [f]: e.target.value }))} required type={f === 'email' ? 'email' : 'text'} />
                                </div>
                            ))}
                            <div>
                                <label style={fieldLabel}>Department</label>
                                <input className="form-input" value={form.department} onChange={e => setForm(x => ({ ...x, department: e.target.value }))} placeholder="Optional" />
                            </div>
                            <div>
                                <label style={fieldLabel}>Role</label>
                                <select className="form-input" value={form.role} onChange={e => setForm(x => ({ ...x, role: e.target.value }))}>
                                    {roleOptions.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button type="submit" className="btn-primary">Create User</button>
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                A one-time password is generated and shown once, after the account is created.
                            </span>
                        </div>
                    </form>
                </div>
            )}

            {/* Table */}
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            border: '3px solid rgba(35, 83, 71, 0.15)',
                            borderTopColor: 'var(--accent-primary)',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>User</th><th>Email</th><th>Role</th><th>Department</th><th>Last Login</th><th>Status</th><th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u: any) => {
                                    const color = ROLE_COLORS[u.role] || '#3E5A52';
                                    // Mirrors the server: nobody changes their own
                                    // status, and only a super admin touches admins.
                                    const locked = u.id === user?.id || (ADMIN_ROLES.includes(u.role) && !isSuperAdmin);
                                    return (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{
                                                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: color,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 11, fontWeight: 800, color: '#fff',
                                                    }}>
                                                        {u.firstName?.[0]}{u.lastName?.[0]}
                                                    </div>
                                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13.5 }}>
                                                        {u.firstName} {u.lastName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.email}</td>
                                            <td>
                                                <span style={{
                                                    fontSize: 10.5, padding: '3px 10px', borderRadius: 9999, whiteSpace: 'nowrap',
                                                    background: `${color}1A`, color, border: `1px solid ${color}33`,
                                                    fontWeight: 800, letterSpacing: '0.04em',
                                                }}>
                                                    {roleLabel(u.role)}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{u.department || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                            <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                                {u.lastLoginAt ? format(new Date(u.lastLoginAt), 'MMM d, yyyy') : 'Never'}
                                            </td>
                                            <td>
                                                <span style={{
                                                    fontSize: 11, padding: '3px 10px', borderRadius: 9999, fontWeight: 700, whiteSpace: 'nowrap',
                                                    background: u.isActive ? 'rgba(63, 138, 102, 0.10)' : 'rgba(200, 67, 75, 0.10)',
                                                    color: u.isActive ? 'var(--risk-low-text)' : 'var(--risk-critical-text)',
                                                    border: `1px solid ${u.isActive ? 'rgba(63, 138, 102, 0.25)' : 'rgba(200, 67, 75, 0.25)'}`,
                                                }}>
                                                    {u.isActive ? '● Active' : '○ Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                {locked ? (
                                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.id === user?.id ? 'You' : '—'}</span>
                                                ) : (
                                                    <button onClick={() => toggleActive(u)} className="btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }}>
                                                        {u.isActive ? <><UserX size={13} /> Deactivate</> : <><UserCheck size={13} /> Activate</>}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {users.length === 0 && (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No users</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
