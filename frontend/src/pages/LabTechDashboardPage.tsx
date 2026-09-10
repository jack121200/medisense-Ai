import React, { useEffect, useState } from 'react';
import { labApi } from '../api/hospitalApi';
import { FlaskConical, CheckCircle, Clock, Upload, AlertTriangle, FileText, Microscope } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axiosInstance';

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'var(--risk-medium)', ACCEPTED: 'var(--accent-primary)', SAMPLE_COLLECTED: 'var(--risk-high)', COMPLETED: 'var(--risk-low)', CANCELLED: 'var(--risk-critical)',
};

const RESULT_FIELDS = [
    { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', ref: '12–17' },
    { key: 'wbc', label: 'WBC', unit: '×10³/μL', ref: '4–11' },
    { key: 'platelets', label: 'Platelets', unit: '×10³/μL', ref: '150–400' },
    { key: 'rbc', label: 'RBC', unit: '×10⁶/μL', ref: '4.5–5.5' },
    { key: 'glucose', label: 'Glucose (Fasting)', unit: 'mg/dL', ref: '70–100' },
    { key: 'cholesterol', label: 'Cholesterol', unit: 'mg/dL', ref: '<200' },
    { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', ref: '0.6–1.2' },
];

type UploadMode = 'numeric' | 'pdf';

export default function LabTechDashboardPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);
    const [uploadMode, setUploadMode] = useState<UploadMode>('pdf');
    const [resultForm, setResultForm] = useState<Record<string, string>>({});
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [filter, setFilter] = useState('all');

    useEffect(() => { loadRequests(); }, []);

    async function loadRequests() {
        try {
            setLoading(true);
            const res = await labApi.getPending();
            setRequests(res.data.data || []);
        } catch { } finally { setLoading(false); }
    }

    async function accept(req: any) {
        try { await labApi.accept(req.id); toast.success(`${req.testId} accepted`); loadRequests(); }
        catch { toast.error('Failed'); }
    }

    async function markSample(req: any) {
        try { await labApi.markSampleCollected(req.id); toast.success('Sample marked collected'); loadRequests(); }
        catch { toast.error('Failed'); }
    }

    async function uploadPdfResult() {
        if (!selected || !pdfFile) return toast.error('Select a PDF file');
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        try {
            setUploading(true);
            await api.post(`/lab/${selected.id}/upload-pdf`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('✅ PDF report uploaded! Patient and doctor have been notified.');
            setSelected(null); setPdfFile(null);
            loadRequests();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Upload failed');
        } finally { setUploading(false); }
    }

    async function uploadNumericResult() {
        if (!selected) return;
        const data: Record<string, number> = {};
        for (const [k, v] of Object.entries(resultForm)) { if (v !== '') data[k] = parseFloat(v); }
        if (!Object.keys(data).length) return toast.error('Enter at least one result value');
        try {
            setUploading(true);
            await labApi.uploadResult(selected.id, data);
            toast.success('✅ Results uploaded. Doctor has been notified.');
            setSelected(null); setResultForm({}); loadRequests();
        } catch { toast.error('Upload failed'); } finally { setUploading(false); }
    }


    const filtered = filter === 'all' ? requests : requests.filter((r: any) => r.status === filter);
    const stats = { pending: requests.filter((r: any) => r.status === 'PENDING').length, accepted: requests.filter((r: any) => r.status === 'ACCEPTED').length, sample: requests.filter((r: any) => r.status === 'SAMPLE_COLLECTED').length };

    return (
        <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, color: 'var(--risk-high)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>LAB TECHNICIAN — CBC UPLOAD</div>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Microscope size={28} color="var(--risk-high)" /> CBC Report Upload Queue
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Upload CBC lab reports for patients. Reports are automatically forwarded to the assigned cardiologist.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
                {[{ label: 'Pending', val: stats.pending, color: 'var(--risk-medium)' }, { label: 'Accepted', val: stats.accepted, color: 'var(--accent-primary)' }, { label: 'Sample Collected', val: stats.sample, color: 'var(--risk-high)' }].map(s => (
                    <div key={s.label} style={{ background: 'var(--surface-1)', border: `1px solid ${s.color}22`, borderRadius: 16, padding: '20px 22px' }}>
                        <div style={{ fontSize: 32, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{s.val}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['all', 'PENDING', 'ACCEPTED', 'SAMPLE_COLLECTED'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter === f ? 'rgba(13, 92, 126, 0.15)' : 'var(--surface-2)', border: `1px solid ${filter === f ? '#00E5FF40' : 'var(--surface-border-md)'}`, color: filter === f ? 'var(--accent-primary)' : 'var(--surface-border-md)' }}>{f === 'all' ? 'All' : f.replace('_', ' ')}</button>
                ))}
            </div>

            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <FlaskConical size={16} style={{ color: 'var(--risk-high)' }} />
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Test Queue ({filtered.length})</span>
                </div>
                {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
                    : filtered.length === 0 ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}><CheckCircle size={36} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />No tests in this category</div>
                        : filtered.map((req: any) => {
                            const sc = STATUS_COLORS[req.status] || 'var(--text-muted)';
                            return (<div key={req.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{req.testType?.replace('_', ' ')}</span>
                                            <span style={{ fontSize: 11, color: 'var(--risk-high)', fontWeight: 700 }}>{req.testId}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {req.patient?.firstName} {req.patient?.lastName} · {req.patient?.patientCode}
                                            {' · '}<Clock size={10} style={{ display: 'inline' }} /> {new Date(req.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: sc, background: `${sc}15`, padding: '4px 12px', borderRadius: 20 }}>{req.status.replace('_', ' ')}</span>
                                        {req.status === 'PENDING' && <button onClick={() => accept(req)} style={{ padding: '7px 14px', background: 'rgba(13, 92, 126, 0.1)', border: '1px solid rgba(13, 92, 126, 0.25)', borderRadius: 8, color: 'var(--accent-primary)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Accept</button>}
                                        {req.status === 'ACCEPTED' && <button onClick={() => markSample(req)} style={{ padding: '7px 14px', background: 'rgba(232, 131, 58, 0.1)', border: '1px solid rgba(232, 131, 58, 0.25)', borderRadius: 8, color: 'var(--risk-high)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Mark Sample Collected</button>}
                                        {req.status === 'SAMPLE_COLLECTED' && <button onClick={() => setSelected(req)} style={{ padding: '7px 14px', background: 'rgba(24, 155, 130, 0.1)', border: '1px solid rgba(24, 155, 130, 0.25)', borderRadius: 8, color: 'var(--risk-low)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={12} /> Upload Results</button>}
                                    </div>
                                </div>
                            </div>);
                        })}
            </div>

            {selected && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(13, 45, 62, 0.16)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border-md)', borderRadius: 20, padding: 32, width: 540, maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 11, color: 'var(--risk-high)', marginBottom: 6, fontWeight: 700 }}>UPLOAD RESULTS — {selected.testId}</div>
                            <h3 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text-primary)', margin: 0 }}>{selected.testType?.replace(/_/g, ' ')} — {selected.patient?.firstName} {selected.patient?.lastName}</h3>
                        </div>

                        {/* Mode toggle */}
                        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-1)', padding: 4, borderRadius: 12, marginBottom: 20 }}>
                            <button onClick={() => setUploadMode('pdf')} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: uploadMode === 'pdf' ? 'rgba(24, 155, 130, 0.15)' : 'transparent', color: uploadMode === 'pdf' ? 'var(--risk-low)' : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                <FileText size={14} /> Upload PDF
                            </button>
                            <button onClick={() => setUploadMode('numeric')} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: uploadMode === 'numeric' ? 'rgba(232, 131, 58, 0.15)' : 'transparent', color: uploadMode === 'numeric' ? 'var(--risk-high)' : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                <Upload size={14} /> Enter Values
                            </button>
                        </div>

                        {/* PDF Mode */}
                        {uploadMode === 'pdf' && (
                            <div>
                                <div style={{ border: '2px dashed rgba(24, 155, 130, 0.25)', borderRadius: 14, padding: 32, textAlign: 'center', marginBottom: 16, background: pdfFile ? 'rgba(24, 155, 130, 0.05)' : 'transparent', cursor: 'pointer' }}
                                    onClick={() => document.getElementById('lab-pdf-input')?.click()}>
                                    <FileText size={32} style={{ color: pdfFile ? 'var(--risk-low)' : 'var(--text-muted)', margin: '0 auto 10px', display: 'block' }} />
                                    {pdfFile
                                        ? <div style={{ fontWeight: 700, color: 'var(--risk-low)', fontSize: 14 }}>✅ {pdfFile.name}</div>
                                        : <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Click to select PDF report file<br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>from outside (scanned/lab system export)</span></div>}
                                </div>
                                <input id="lab-pdf-input" type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => { setSelected(null); setPdfFile(null); }} style={{ flex: 1, padding: 12, border: '1px solid var(--surface-border-md)', background: 'transparent', color: 'var(--text-primary)', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                                    <button onClick={uploadPdfResult} disabled={uploading || !pdfFile} style={{ flex: 2, padding: 12, background: pdfFile ? 'linear-gradient(135deg, var(--risk-low), #00A858)' : 'rgba(24, 155, 130, 0.25)', border: 'none', borderRadius: 10, color: 'var(--bg-primary)', fontWeight: 800, cursor: pdfFile ? 'pointer' : 'not-allowed', fontSize: 14 }}>
                                        {uploading ? '⏳ Uploading...' : '📄 Upload PDF Report'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Numeric mode */}
                        {uploadMode === 'numeric' && (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                                    {RESULT_FIELDS.map(f => (
                                        <div key={f.key}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{f.label} ({f.unit}) Ref: {f.ref}</div>
                                            <input type="number" step="0.1" value={resultForm[f.key] || ''} onChange={e => setResultForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder="Value"
                                                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--surface-border-md)', background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ background: 'rgba(232, 131, 58, 0.08)', border: '1px solid rgba(232, 131, 58, 0.2)', borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', gap: 8 }}>
                                    <AlertTriangle size={14} style={{ color: 'var(--risk-high)', flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AI will automatically flag abnormal values on upload.</span>
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => { setSelected(null); setResultForm({}); }} style={{ flex: 1, padding: 12, border: '1px solid var(--surface-border-md)', background: 'transparent', color: 'var(--text-primary)', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                                    <button onClick={uploadNumericResult} disabled={uploading} style={{ flex: 2, padding: 12, background: 'linear-gradient(135deg, var(--risk-high), var(--risk-critical))', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{uploading ? '🧬 Analyzing...' : '🧪 Upload & Analyze'}</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
