import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Download, RefreshCw, ChevronLeft, ChevronRight, Users, Filter, X, Calendar } from 'lucide-react';
import { patientApi } from '../api/patient.api';
import { reportApi } from '../api/index';
import toast from 'react-hot-toast';

const RISK_LEVELS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const RISK_COLORS: Record<string, string> = {
    CRITICAL: 'var(--risk-critical)', HIGH: 'var(--risk-high)', MEDIUM: 'var(--risk-medium)', LOW: 'var(--risk-low)',
};

export default function PatientsPage() {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<any[]>([]);
    const [pagination, setPagination] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [riskFilter, setRiskFilter] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await patientApi.list({ page, limit: 20, search: search || undefined, riskLevel: riskFilter || undefined });
            setPatients(data.data);
            setPagination(data.pagination);
        } catch { toast.error('Failed to load patients'); }
        finally { setLoading(false); }
    }, [page, search, riskFilter]);

    useEffect(() => { load(); }, [load]);

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(); };

    const downloadPDF = async (id: string, name: string) => {
        try {
            const res = await reportApi.generatePatientPDF(id);
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url; a.download = `${name}-report.pdf`; a.click();
            URL.revokeObjectURL(url);
            toast.success('Report downloaded');
        } catch { toast.error('Failed to generate report'); }
    };

    return (
        <div className="page-enter">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <Users size={22} color="var(--accent-primary)" />
                        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                            Patient Registry
                        </h1>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                        {pagination?.total?.toLocaleString() || '—'} patients total
                    </p>
                </div>
                <Link to="/patients/new" className="btn-primary" style={{ textDecoration: 'none' }}>
                    <Plus size={16} /> Add Patient
                </Link>
            </div>

            {/* Filters */}
            <div style={{
                background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                borderRadius: 14, padding: '14px 18px', marginBottom: 20,
                display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
            }}>
                <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: 10, minWidth: 260 }}>
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 9,
                        background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                        borderRadius: 10, padding: '8px 12px',
                        transition: 'all 0.2s',
                    }}
                        onFocus={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(35, 83, 71, 0.3)'}
                        onBlur={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--surface-border)'}
                    >
                        <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Name, MRN, email..."
                            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }}
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>Search</button>
                </form>

                {/* Risk filter pills */}
                <div style={{ display: 'flex', gap: 6 }}>
                    {RISK_LEVELS.map(r => {
                        const isActive = riskFilter === r;
                        const color = r ? RISK_COLORS[r] : 'var(--accent-primary)';
                        return (
                            <button
                                key={r}
                                onClick={() => { setRiskFilter(r); setPage(1); }}
                                style={{
                                    padding: '5px 12px', borderRadius: 9999,
                                    border: `1px solid ${isActive ? color + '50' : 'var(--surface-border)'}`,
                                    background: isActive ? `${color}15` : 'var(--surface-2)',
                                    color: isActive ? color : 'var(--text-muted)',
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    letterSpacing: r ? '0.04em' : '0',
                                }}
                            >
                                {r || 'All'}
                            </button>
                        );
                    })}
                </div>

                <button onClick={load} className="btn-ghost" style={{ padding: '8px 10px' }}>
                    <RefreshCw size={14} />
                </button>
            </div>

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
                                    <th>Patient</th>
                                    <th>MRN</th>
                                    <th>Age / Sex</th>
                                    <th>Risk Level</th>
                                    <th>Risk Score</th>
                                    <th>Ward</th>
                                    <th>Alerts</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patients.map((p: any) => {
                                    const riskColor = RISK_COLORS[p.currentRiskLevel] || 'var(--text-muted)';
                                    return (
                                        <tr key={p.id}>
                                            <td>
                                                <Link to={`/patients/${p.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 700, fontSize: 13.5 }}>
                                                    {p.firstName} {p.lastName}
                                                </Link>
                                            </td>
                                            <td className="font-mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                                {p.patientCode}
                                            </td>
                                            <td style={{ fontSize: 13 }}>
                                                {new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()}
                                                <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                                                    / {p.gender === 'MALE' ? 'M' : p.gender === 'FEMALE' ? 'F' : 'O'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`risk-badge ${p.currentRiskLevel?.toLowerCase()}`}>
                                                    {p.currentRiskLevel}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span className="font-mono" style={{ color: riskColor, fontWeight: 700, fontSize: 14 }}>
                                                        {p.riskScore?.toFixed(1)}
                                                    </span>
                                                    {p.riskScore > 0 && (
                                                        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--surface-1)', overflow: 'hidden' }}>
                                                            <div style={{
                                                                height: '100%', borderRadius: 2,
                                                                width: `${Math.min(100, p.riskScore)}%`,
                                                                background: riskColor, opacity: 0.8,
                                                            }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                                                {p.admissions?.[0]?.wardType || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>
                                            <td>
                                                {(p.alerts?.length || 0) > 0 ? (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                        padding: '2px 9px', borderRadius: 9999,
                                                        background: 'rgba(200, 67, 75, 0.10)',
                                                        color: 'var(--risk-critical-text)', fontWeight: 700, fontSize: 12,
                                                        border: '1px solid rgba(200, 67, 75, 0.20)',
                                                    }}>
                                                        {p.alerts.length}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>–</span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <Link to={`/patients/${p.id}`} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}>View</Link>
                                                    <button
                                                        onClick={() => navigate(`/appointments?new=1&patientId=${p.id}`)}
                                                        className="btn-ghost"
                                                        style={{ padding: '4px 10px', fontSize: 12, color: 'var(--accent-primary)' }}
                                                        title="Book Appointment"
                                                    >
                                                        <Calendar size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => downloadPDF(p.id, `${p.firstName}-${p.lastName}`)}
                                                        className="btn-ghost"
                                                        style={{ padding: '4px 9px', fontSize: 12 }}
                                                        title="Download PDF Report"
                                                    >
                                                        <Download size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {patients.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48, fontSize: 13 }}>
                                            No patients found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 20px', borderTop: '1px solid var(--surface-border)',
                        background: 'var(--surface-1)',
                    }}>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            Page <strong style={{ color: 'var(--text-secondary)' }}>{pagination.page}</strong> of {pagination.totalPages}
                            <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>·</span>
                            <span style={{ marginLeft: 8 }}>{pagination.total?.toLocaleString()} patients</span>
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="btn-ghost" style={{ padding: '6px 12px' }}>
                                <ChevronLeft size={15} />
                            </button>
                            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages} className="btn-ghost" style={{ padding: '6px 12px' }}>
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
