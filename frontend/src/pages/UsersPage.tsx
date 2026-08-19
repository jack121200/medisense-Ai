import React, { useEffect, useState } from 'react';
import api from '../api/axiosInstance';
import { Plus, UserX, UserCheck, UserCog, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
    ADMIN: { color: '#FF2CF5', bg: 'rgba(255,44,245,0.10)' },
    DOCTOR: { color: '#00E5FF', bg: 'rgba(0,229,255,0.10)' },
    NURSE: { color: '#00FF87', bg: 'rgba(0,255,135,0.10)' },
    ANALYST: { color: '#FFD166', bg: 'rgba(255,209,102,0.10)' },
};

export default function UsersPage() {
    const { user } = useAuthStore();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'DOCTOR', department: '' });

    if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

    useEffect(() => {
        api.get('/users')
            .then(r => setUsers(r.data.data || []))
            .finally(() => setLoading(false));
    }, []);

    const addUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/users', { ...form, password: 'Cardio@2024' });
            setUsers(u => [data.data, ...u]);
            setShowAdd(false);
            setForm({ email: '', firstName: '', lastName: '', role: 'DOCTOR', department: '' });
            toast.success('User created. Default password: Cardio@2024');
        } catch { toast.error('Failed to create user'); }
    };

    const toggleActive = async (u: any) => {
        try {
            await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
            toast.success(`User ${u.isActive ? 'deactivated' : 'reactivated'}`);
        } catch { toast.error('Failed'); }
    };

    return (
        <div className="page-enter">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
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

            {/* Add user form */}
            {showAdd && (
                <div style={{
                    background: 'var(--surface-1)',
                    border: '1px solid rgba(0,229,255,0.20)',
                    borderRadius: 18, padding: '24px 28px', marginBottom: 20,
                    position: 'relative', overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                        background: 'linear-gradient(90deg, transparent, var(--accent-primary) 50%, transparent)', opacity: 0.5,
                    }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Create New User</h3>
                    <form onSubmit={addUser}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                            {(['email', 'firstName', 'lastName'] as const).map(f => (
                                <div key={f}>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        {f === 'firstName' ? 'First Name' : f === 'lastName' ? 'Last Name' : 'Email'}
                                    </label>
                                    <input className="form-input" value={form[f]} onChange={e => setForm(x => ({ ...x, [f]: e.target.value }))} required type={f === 'email' ? 'email' : 'text'} />
                                </div>
                            ))}
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Department</label>
                                <input className="form-input" value={form.department} onChange={e => setForm(x => ({ ...x, department: e.target.value }))} placeholder="Optional" />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Role</label>
                                <select className="form-input" value={form.role} onChange={e => setForm(x => ({ ...x, role: e.target.value }))}>
                                    {['DOCTOR', 'RECEPTIONIST'].map(r => <option key={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <button type="submit" className="btn-primary">Create User</button>
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                Default password: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>Cardio@2024</span>
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
                            border: '3px solid rgba(0,229,255,0.15)',
                            borderTopColor: 'var(--accent-primary)',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User</th><th>Email</th><th>Role</th><th>Department</th><th>Last Login</th><th>Status</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u: any) => {
                                const roleStyle = ROLE_COLORS[u.role] || { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)' };
                                return (
                                    <tr key={u.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                                                    background: `linear-gradient(135deg, ${roleStyle.color}80, ${roleStyle.color}40)`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 11, fontWeight: 800, color: '#050709',
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
                                                fontSize: 10.5, padding: '3px 10px', borderRadius: 9999,
                                                background: roleStyle.bg, color: roleStyle.color,
                                                fontWeight: 800, letterSpacing: '0.04em',
                                                border: `1px solid ${roleStyle.color}25`,
                                            }}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{u.department || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                            {u.lastLoginAt ? format(new Date(u.lastLoginAt), 'MMM d, yyyy') : <span style={{ color: 'var(--text-muted)' }}>Never</span>}
                                        </td>
                                        <td>
                                            <span style={{
                                                fontSize: 11, padding: '3px 10px', borderRadius: 9999, fontWeight: 700,
                                                background: u.isActive ? 'rgba(0,255,135,0.10)' : 'rgba(255,45,85,0.10)',
                                                color: u.isActive ? 'var(--accent-green)' : 'var(--risk-critical)',
                                                border: `1px solid ${u.isActive ? 'rgba(0,255,135,0.20)' : 'rgba(255,45,85,0.20)'}`,
                                            }}>
                                                {u.isActive ? '● Active' : '○ Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <button onClick={() => toggleActive(u)} className="btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }}>
                                                {u.isActive ? <><UserX size={13} /> Deactivate</> : <><UserCheck size={13} /> Activate</>}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {users.length === 0 && (
                                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No users</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

