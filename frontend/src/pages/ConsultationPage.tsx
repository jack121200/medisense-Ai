import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { consultationApi, labApi } from '../api/hospitalApi';
import { Plus, Trash2, FlaskConical, Pill, Brain, CheckCircle, ChevronLeft, Save, Activity, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const SYMPTOM_OPTIONS = ['Fever', 'Cough', 'Chest Pain', 'Fatigue', 'Headache', 'Vomiting', 'Nausea', 'Diarrhea',
    'Shortness of Breath', 'Body Pain', 'Chills', 'Sore Throat', 'Loss of Appetite', 'Dizziness', 'Swelling', 'Rash'];

const LAB_TEST_OPTIONS = [
    { value: 'BLOOD_TEST', label: 'Blood Test', price: 700 },
    { value: 'URINE_TEST', label: 'Urine Test', price: 300 },
    { value: 'XRAY', label: 'X-Ray', price: 800 },
    { value: 'ECG', label: 'ECG', price: 500 },
    { value: 'CT_SCAN', label: 'CT Scan', price: 3000 },
    { value: 'MRI', label: 'MRI', price: 4500 },
    { value: 'ULTRASOUND', label: 'Ultrasound', price: 1200 },
    { value: 'STOOL_TEST', label: 'Stool Test', price: 250 },
];

// Disease prediction based on symptoms (client-side AI logic)
function predictDiseases(symptoms: string[]) {
    const rules: Record<string, { diseases: { name: string; prob: number }[] }> = {
        'Fever,Headache,Vomiting': { diseases: [{ name: 'Dengue', prob: 65 }, { name: 'Viral Fever', prob: 25 }, { name: 'Malaria', prob: 10 }] },
        'Fever,Cough,Sore Throat': { diseases: [{ name: 'Influenza', prob: 60 }, { name: 'COVID-19', prob: 25 }, { name: 'Common Cold', prob: 15 }] },
        'Chest Pain,Shortness of Breath,Fatigue': { diseases: [{ name: 'Cardiac Issue', prob: 55 }, { name: 'Pneumonia', prob: 30 }, { name: 'Anxiety', prob: 15 }] },
        'Vomiting,Diarrhea,Fatigue': { diseases: [{ name: 'Gastroenteritis', prob: 70 }, { name: 'Food Poisoning', prob: 20 }, { name: 'Cholera', prob: 10 }] },
    };
    const sSet = symptoms.join(',');
    // Find best match
    let best = null;
    let bestOverlap = 0;
    for (const [key, val] of Object.entries(rules)) {
        const ruleSymptoms = key.split(',');
        const overlap = ruleSymptoms.filter(s => symptoms.includes(s)).length;
        if (overlap > bestOverlap) { bestOverlap = overlap; best = val; }
    }
    if (bestOverlap < 2) {
        // Generic fallback
        const generic = [
            { name: 'Viral Infection', prob: 40 + Math.floor(Math.random() * 20) },
            { name: 'Bacterial Infection', prob: 30 + Math.floor(Math.random() * 10) },
            { name: 'Stress/Fatigue', prob: 15 + Math.floor(Math.random() * 10) },
        ];
        const total = generic.reduce((s, g) => s + g.prob, 0);
        return generic.map(g => ({ ...g, prob: Math.round(g.prob / total * 100) }));
    }
    return best!.diseases;
}

export default function ConsultationPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [consultation, setConsultation] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Form state
    const [symptoms, setSymptoms] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [aiPredictions, setAiPredictions] = useState<any[]>([]);
    const [predicting, setPredicting] = useState(false);

    // Prescription
    const [rxItems, setRxItems] = useState<any[]>([{ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
    const [rxNotes, setRxNotes] = useState('');
    const [savingRx, setSavingRx] = useState(false);

    // Lab tests
    const [labTests, setLabTests] = useState<string[]>([]);
    const [orderingLab, setOrderingLab] = useState(false);

    // Billing
    const [closing, setClosing] = useState(false);
    const [invoice, setInvoice] = useState<any>(null);

    const [activeTab, setActiveTab] = useState<'symptoms' | 'prescription' | 'lab' | 'bill'>('symptoms');

    useEffect(() => { loadConsultation(); }, [id]);

    async function loadConsultation() {
        if (!id) return;
        try {
            setLoading(true);
            const res = await consultationApi.getById(id);
            const c = res.data.data;
            setConsultation(c);
            setSymptoms(c.symptoms || []);
            setNotes(c.notes || '');
            setDiagnosis(c.diagnosis || '');
            if (c.aiDiseasePred) setAiPredictions(c.aiDiseasePred);
            if (c.prescription?.items) {
                setRxItems(c.prescription.items.length > 0 ? c.prescription.items : [{ medicineName: '', dosage: '', frequency: '', duration: '' }]);
                setRxNotes(c.prescription.notes || '');
            }
            if (c.invoice) setInvoice(c.invoice);
        } catch { toast.error('Could not load consultation'); } finally { setLoading(false); }
    }

    function toggleSymptom(s: string) {
        setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    }

    async function runAI() {
        if (symptoms.length < 2) return toast.error('Add at least 2 symptoms for AI prediction');
        setPredicting(true);
        await new Promise(r => setTimeout(r, 1200)); // simulate processing
        const preds = predictDiseases(symptoms);
        setAiPredictions(preds);
        await consultationApi.update(id!, { symptoms, aiDiseasePred: preds });
        setPredicting(false);
        toast.success('AI disease prediction complete');
    }

    async function saveSymptoms() {
        try {
            await consultationApi.update(id!, { symptoms, notes, diagnosis });
            toast.success('Saved');
        } catch { toast.error('Failed to save'); }
    }

    async function savePrescription() {
        const validItems = rxItems.filter(i => i.medicineName.trim());
        if (validItems.length === 0) return toast.error('Add at least one medicine');
        try {
            setSavingRx(true);
            await consultationApi.savePrescription(id!, {
                patientId: consultation.patientId,
                doctorId: user!.id,
                notes: rxNotes,
                items: validItems,
            });
            toast.success('Prescription saved');
            loadConsultation();
        } catch { toast.error('Failed to save prescription'); } finally { setSavingRx(false); }
    }

    async function orderLabTests() {
        if (labTests.length === 0) return toast.error('Select at least one test');
        try {
            setOrderingLab(true);
            for (const testType of labTests) {
                await labApi.createRequest({ patientId: consultation.patientId, consultationId: id, testType, orderedByDocId: user!.id });
            }
            toast.success(`${labTests.length} lab test(s) ordered`);
            setLabTests([]);
            loadConsultation();
        } catch { toast.error('Failed to order tests'); } finally { setOrderingLab(false); }
    }

    async function closeAndBill() {
        try {
            setClosing(true);
            await consultationApi.update(id!, { symptoms, notes, diagnosis });
            const res = await consultationApi.closeAndBill(id!, consultation.patientId);
            setInvoice(res.data.data);
            toast.success('Consultation closed — Bill generated!');
            loadConsultation();
            setActiveTab('bill');
        } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to close'); } finally { setClosing(false); }
    }

    function downloadPrescriptionPDF() {
        const p = consultation?.patient;
        const age = p?.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600000)) : '—';
        const validRx = rxItems.filter(i => i.medicineName?.trim());
        if (validRx.length === 0) { toast.error('No medicines in prescription to print'); return; }
        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (!printWindow) { toast.error('Please allow popups for PDF download'); return; }
        const labList = consultation?.labTestRequests?.map((t: any) => `<li>${t.testType.replace(/_/g, ' ')} — <span style="color:#888">${t.status}</span></li>`).join('') || '';
        printWindow.document.write(`
            <!DOCTYPE html><html><head><title>Prescription — ${p?.firstName} ${p?.lastName}</title>
            <style>
                body { font-family: 'Arial', sans-serif; padding: 40px; color: #111; max-width: 720px; margin: 0 auto; }
                h1 { font-size: 22px; margin: 0; } .sub { color: #666; font-size: 13px; }
                .header { border-bottom: 2px solid #0096AA; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
                .section { margin-bottom: 20px; } .section h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #0096AA; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; font-size: 13px; } th { text-align: left; padding: 8px; background: #f5f5f5; font-size: 11px; text-transform: uppercase; } td { padding: 8px; border-bottom: 1px solid #eee; }
                .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; background: #e8f8f5; color: #006655; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; display: flex; justify-content: space-between; }
                .sig { text-align: right; } .sig .line { border-top: 1px solid #333; width: 180px; margin-top: 40px; padding-top: 4px; font-size: 11px; }
                @media print { body { padding: 20px; } }
            </style></head><body>
            <div class="header">
                <div>
                    <h1>🏥 MediSense AI</h1>
                    <div class="sub">Digital Prescription</div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:13px;font-weight:bold">Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div class="sub">Dr. ${consultation?.doctor?.firstName || ''} ${consultation?.doctor?.lastName || ''}</div>
                    ${consultation?.doctor?.specialization ? `<div class="sub">${consultation.doctor.specialization}</div>` : ''}
                </div>
            </div>
            <div class="section">
                <h3>Patient Details</h3>
                <table><tbody>
                    <tr><td><b>Name:</b></td><td>${p?.firstName} ${p?.lastName}</td><td><b>Patient ID:</b></td><td>${p?.patientCode || '—'}</td></tr>
                    <tr><td><b>Age / Gender:</b></td><td>${age} yrs / ${p?.gender || '—'}</td><td><b>Blood Group:</b></td><td>${p?.bloodGroup?.replace('_','') || '—'}</td></tr>
                    ${p?.phone ? `<tr><td><b>Phone:</b></td><td>${p.phone}</td><td></td><td></td></tr>` : ''}
                </tbody></table>
            </div>
            ${symptoms.length > 0 ? `<div class="section"><h3>Symptoms</h3><p>${symptoms.join(', ')}</p></div>` : ''}
            ${diagnosis ? `<div class="section"><h3>Diagnosis</h3><p><b>${diagnosis}</b></p></div>` : ''}
            <div class="section">
                <h3>Prescription (Rx)</h3>
                <table><thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>
                    ${validRx.map((rx: any, i: number) => `<tr><td>${i+1}</td><td><b>${rx.medicineName}</b></td><td>${rx.dosage||'—'}</td><td>${rx.frequency||'—'}</td><td>${rx.duration||'—'}</td><td>${rx.instructions||''}</td></tr>`).join('')}
                </tbody></table>
                ${rxNotes ? `<p style="font-size:12px;color:#666;margin-top:10px"><i>Notes: ${rxNotes}</i></p>` : ''}
            </div>
            ${labList ? `<div class="section"><h3>Lab Tests Ordered</h3><ul style="font-size:13px">${labList}</ul></div>` : ''}
            <div class="footer">
                <div><p style="font-size:11px;color:#888">⚠️ This prescription is generated digitally via MediSense AI.<br/>This is not valid without the doctor's physical signature.</p></div>
                <div class="sig"><div class="line">Dr. ${consultation?.doctor?.firstName || ''} ${consultation?.doctor?.lastName || ''}<br>Signature & Stamp</div></div>
            </div>
            </body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    }

    if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading consultation...</div>;
    if (!consultation) return null;

    const p = consultation.patient;
    const isCompleted = consultation.status === 'COMPLETED';

    const tab = (label: string, key: typeof activeTab, icon: React.ReactNode) => (
        <button onClick={() => setActiveTab(key)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: activeTab === key ? 'rgba(194, 91, 60, 0.15)' : 'transparent',
            color: activeTab === key ? 'var(--accent-primary)' : 'var(--text-secondary)',
            transition: 'all 0.15s',
        }}>
            {icon} {label}
        </button>
    );

    return (
        <div style={{ padding: '28px 40px', maxWidth: 1100, margin: '0 auto' }}>
            {/* Back */}
            <button onClick={() => navigate('/doctor-dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
                <ChevronLeft size={16} /> Back to Dashboard
            </button>

            {/* Patient Header */}
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #00E5FF22, #FF2CF522)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>{p?.firstName} {p?.lastName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{p?.patientCode} · {p?.phone}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {isCompleted ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--risk-low)', background: '#00FF8720', padding: '6px 14px', borderRadius: 20, border: '1px solid #00FF8730' }}>✓ COMPLETED</span>
                    ) : (
                        <button onClick={closeAndBill} disabled={closing} style={{
                            padding: '10px 20px', background: 'linear-gradient(135deg, var(--risk-low), #00A858)',
                            border: 'none', borderRadius: 10, color: 'var(--bg-primary)', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                        }}>
                            {closing ? 'Closing...' : '✓ Close & Generate Bill'}
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
                {/* Main Panel */}
                <div>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface-1)', padding: 6, borderRadius: 14, border: '1px solid var(--surface-border)' }}>
                        {tab('Symptoms & Diagnosis', 'symptoms', <Activity size={14} />)}
                        {tab('Prescription', 'prescription', <Pill size={14} />)}
                        {tab('Lab Tests', 'lab', <FlaskConical size={14} />)}
                        {tab('Bill', 'bill', <CheckCircle size={14} />)}
                    </div>

                    {/* SYMPTOMS TAB */}
                    {activeTab === 'symptoms' && (
                        <div>
                            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>Select Symptoms</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                                    {SYMPTOM_OPTIONS.map(s => (
                                        <button key={s} onClick={() => !isCompleted && toggleSymptom(s)} style={{
                                            padding: '6px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                            background: symptoms.includes(s) ? 'rgba(194, 91, 60, 0.15)' : 'var(--surface-2)',
                                            border: `1px solid ${symptoms.includes(s) ? '#00E5FF44' : 'var(--surface-border-md)'}`,
                                            color: symptoms.includes(s) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            transition: 'all 0.15s',
                                        }}>{s}</button>
                                    ))}
                                </div>

                                {/* AI Disease Prediction */}
                                {!isCompleted && (
                                    <button onClick={runAI} disabled={predicting || symptoms.length < 2} style={{
                                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                                        background: 'linear-gradient(135deg, #FF2CF5, #AA00AA)', border: 'none',
                                        borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: symptoms.length < 2 ? 0.5 : 1,
                                    }}>
                                        <Brain size={16} /> {predicting ? 'AI Analyzing...' : '🤖 Run Disease Prediction AI'}
                                    </button>
                                )}
                                {aiPredictions.length > 0 && (
                                    <div style={{ marginTop: 16, background: 'rgba(255,44,245,0.05)', border: '1px solid rgba(255,44,245,0.15)', borderRadius: 12, padding: 16 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#FF2CF5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>🧠 AI Disease Prediction</div>
                                        {aiPredictions.map(pred => (
                                            <div key={pred.name} style={{ marginBottom: 10 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{pred.name}</span>
                                                    <span style={{ fontSize: 13, fontWeight: 900, color: pred.prob > 50 ? '#FF2CF5' : pred.prob > 25 ? 'var(--risk-medium)' : 'var(--risk-low)' }}>{pred.prob}%</span>
                                                </div>
                                                <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 4 }}>
                                                    <div style={{ height: '100%', borderRadius: 4, width: `${pred.prob}%`, background: pred.prob > 50 ? '#FF2CF5' : pred.prob > 25 ? 'var(--risk-medium)' : 'var(--risk-low)' }} />
                                                </div>
                                            </div>
                                        ))}
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>⚠️ AI suggestion only — Doctor makes the final diagnosis</div>
                                    </div>
                                )}
                            </div>

                            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: 24 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>Notes & Diagnosis</div>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={isCompleted} rows={3} placeholder="Clinical notes..." className="form-input" style={{ marginBottom: 16, resize: 'vertical' }} />
                                <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} disabled={isCompleted} placeholder="Final diagnosis..." className="form-input" style={{ marginBottom: 16 }} />
                                {!isCompleted && (
                                    <button onClick={saveSymptoms} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(194, 91, 60, 0.1)', border: '1px solid rgba(194, 91, 60, 0.25)', borderRadius: 10, color: 'var(--accent-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                        <Save size={14} /> Save
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* PRESCRIPTION TAB */}
                    {activeTab === 'prescription' && (
                        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Digital Prescription</div>
                                {!isCompleted && (
                                    <button onClick={() => setRxItems([...rxItems, { medicineName: '', dosage: '', frequency: '', duration: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(62, 142, 126, 0.1)', border: '1px solid rgba(62, 142, 126, 0.25)', borderRadius: 8, color: 'var(--risk-low)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                        <Plus size={13} /> Add Medicine
                                    </button>
                                )}
                            </div>
                            {rxItems.map((item, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, marginBottom: 12, alignItems: 'start' }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>MEDICINE</div>
                                        <input value={item.medicineName} disabled={isCompleted} onChange={e => { const n = [...rxItems]; n[idx].medicineName = e.target.value; setRxItems(n); }} placeholder="e.g. Paracetamol" className="form-input" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>DOSAGE</div>
                                        <input value={item.dosage} disabled={isCompleted} onChange={e => { const n = [...rxItems]; n[idx].dosage = e.target.value; setRxItems(n); }} placeholder="500mg" className="form-input" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>FREQUENCY</div>
                                        <select value={item.frequency} disabled={isCompleted} onChange={e => { const n = [...rxItems]; n[idx].frequency = e.target.value; setRxItems(n); }} className="form-input">
                                            <option value="">Select</option>
                                            {['Once daily', 'Twice daily', '3 times daily', '4 times daily', 'As needed', 'Weekly'].map(f => <option key={f}>{f}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>DURATION</div>
                                        <input value={item.duration} disabled={isCompleted} onChange={e => { const n = [...rxItems]; n[idx].duration = e.target.value; setRxItems(n); }} placeholder="5 days" className="form-input" />
                                    </div>
                                    {!isCompleted && (
                                        <button onClick={() => setRxItems(rxItems.filter((_, i) => i !== idx))} style={{ marginTop: 24, padding: 8, background: 'rgba(179, 64, 46, 0.1)', border: '1px solid rgba(179, 64, 46, 0.2)', borderRadius: 8, color: 'var(--risk-critical)', cursor: 'pointer' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <textarea value={rxNotes} disabled={isCompleted} onChange={e => setRxNotes(e.target.value)} rows={2} placeholder="Additional notes for pharmacist..." className="form-input" style={{ marginTop: 8, marginBottom: 16, resize: 'vertical' }} />
                            {!isCompleted && (
                                <button onClick={savePrescription} disabled={savingRx} style={{ padding: '11px 24px', background: 'linear-gradient(135deg, var(--accent-primary), #0096AA)', border: 'none', borderRadius: 10, color: 'var(--bg-primary)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                                    <Pill size={14} style={{ display: 'inline', marginRight: 6 }} />
                                    {savingRx ? 'Saving...' : 'Save Prescription'}
                                </button>
                            )}
                            <button onClick={downloadPrescriptionPDF} style={{ padding: '11px 18px', background: 'rgba(194, 91, 60, 0.08)', border: '1px solid rgba(194, 91, 60, 0.25)', borderRadius: 10, color: 'var(--accent-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Download size={14} /> Download PDF
                            </button>
                        </div>
                    )}

                    {/* LAB TEST TAB */}
                    {activeTab === 'lab' && (
                        <div>
                            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>Order Lab Tests</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
                                    {LAB_TEST_OPTIONS.map(t => (
                                        <label key={t.value} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                                            background: labTests.includes(t.value) ? 'rgba(204, 107, 61, 0.1)' : 'var(--surface-2)',
                                            border: `1px solid ${labTests.includes(t.value) ? 'rgba(204, 107, 61, 0.3)' : 'var(--surface-border)'}`,
                                            borderRadius: 12, cursor: 'pointer',
                                        }}>
                                            <input type="checkbox" checked={labTests.includes(t.value)} disabled={isCompleted}
                                                onChange={() => setLabTests(prev => prev.includes(t.value) ? prev.filter(x => x !== t.value) : [...prev, t.value])}
                                                style={{ accentColor: 'var(--risk-high)' }} />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{t.label}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>₹{t.price.toLocaleString()}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                {!isCompleted && (
                                    <button onClick={orderLabTests} disabled={orderingLab || labTests.length === 0} style={{ padding: '11px 24px', background: 'linear-gradient(135deg, var(--risk-high), #CC4400)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: labTests.length === 0 ? 0.5 : 1 }}>
                                        <FlaskConical size={14} style={{ display: 'inline', marginRight: 6 }} />
                                        {orderingLab ? 'Ordering...' : `Order ${labTests.length > 0 ? labTests.length : ''} Test(s)`}
                                    </button>
                                )}
                            </div>
                            {/* Ordered tests */}
                            {consultation.labTestRequests?.length > 0 && (
                                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: 24 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 14 }}>Ordered Tests ({consultation.labTestRequests.length})</div>
                                    {consultation.labTestRequests.map((t: any) => {
                                        const statusColors: Record<string, string> = { PENDING: 'var(--risk-medium)', ACCEPTED: 'var(--accent-primary)', SAMPLE_COLLECTED: 'var(--risk-high)', COMPLETED: 'var(--risk-low)' };
                                        const sc = statusColors[t.status] || 'var(--text-muted)';
                                        return (
                                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--surface-border)' }}>
                                                <div>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{t.testType.replace('_', ' ')}</span>
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{t.testId}</span>
                                                </div>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: sc, background: `${sc}15`, padding: '3px 10px', borderRadius: 20 }}>{t.status}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* BILL TAB */}
                    {activeTab === 'bill' && (
                        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: 28 }}>
                            {invoice || consultation.invoice ? (
                                (() => {
                                    const inv = invoice || consultation.invoice;
                                    return (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                                                <div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>INVOICE NUMBER</div>
                                                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent-primary)' }}>{inv.invoiceNumber}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>STATUS</div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: inv.isPaid ? 'var(--risk-low)' : 'var(--risk-medium)' }}>{inv.isPaid ? `✓ PAID (${inv.paymentMethod})` : '⏳ UNPAID'}</div>
                                                </div>
                                            </div>
                                            <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 16, marginBottom: 16 }}>
                                                {inv.items?.map((item: any) => (
                                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
                                                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.description}</span>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>₹{item.amount.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid var(--surface-border-md)' }}>
                                                <span style={{ fontWeight: 900, fontSize: 16, color: 'var(--text-primary)' }}>Total</span>
                                                <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--accent-primary)' }}>₹{inv.totalAmount?.toLocaleString()}</span>
                                            </div>
                                            {!inv.isPaid && (
                                                <div style={{ marginTop: 20 }}>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Mark as Paid at Reception</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>The receptionist can mark payment via the <strong style={{ color: 'var(--accent-primary)' }}>Billing</strong> page.</div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()
                            ) : (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
                                    No bill generated yet. Close the consultation to generate the bill automatically.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar: Patient Info */}
                <div>
                    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Patient Profile</div>
                        {[
                            { label: 'Blood Group', val: p?.bloodGroup?.replace('_', ' ') },
                            { label: 'Risk Level', val: p?.currentRiskLevel, color: 'var(--risk-critical)' },
                            { label: 'Diabetes', val: p?.hasDiabetes ? 'Yes' : 'No' },
                            { label: 'Hypertension', val: p?.hasHypertension ? 'Yes' : 'No' },
                            { label: 'Heart Disease', val: p?.hasHeartDisease ? 'Yes' : 'No' },
                        ].map(f => (
                            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--surface-border)' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.label}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: (f as any).color || 'var(--text-primary)' }}>{f.val || '—'}</span>
                            </div>
                        ))}
                    </div>
                    {/* Previous prescriptions */}
                    {p?.prescriptions?.length > 0 && (
                        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 16, padding: 20 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Previous Prescriptions</div>
                            {p.prescriptions.slice(0, 3).map((rx: any) => (
                                <div key={rx.id} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 0', borderBottom: '1px solid var(--surface-border)' }}>
                                    {new Date(rx.createdAt).toLocaleDateString()} — {rx.items?.length || 0} medicines
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

