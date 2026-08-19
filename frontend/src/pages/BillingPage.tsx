import React, { useEffect, useState } from 'react';
import { billingApi } from '../api/hospitalApi';
import { Receipt, CheckCircle, Clock, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BillingPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
    const [selected, setSelected] = useState<any>(null);
    const [payMethod, setPayMethod] = useState('CASH');
    const [paying, setPaying] = useState(false);
    const [revenue, setRevenue] = useState({ revenue: 0, paidCount: 0 });

    useEffect(() => { loadAll(); }, []);

    async function loadAll() {
        try {
            setLoading(true);
            const [invRes, revRes] = await Promise.all([billingApi.list(), billingApi.revenueToday()]);
            setInvoices(invRes.data.data || []);
            setRevenue(revRes.data.data || { revenue: 0, paidCount: 0 });
        } catch { } finally { setLoading(false); }
    }

    async function markPaid() {
        if (!selected) return;
        try {
            setPaying(true);
            await billingApi.markPaid(selected.id, payMethod);
            toast.success(`Payment recorded — ${payMethod}`);
            setSelected(null);
            loadAll();
        } catch (e: any) { toast.error(e.response?.data?.message || 'Payment failed'); } finally { setPaying(false); }
    }

    const filtered = filter === 'all' ? invoices : invoices.filter((i: any) => filter === 'paid' ? i.isPaid : !i.isPaid);
    const unpaidTotal = invoices.filter((i: any) => !i.isPaid).reduce((s: number, i: any) => s + i.totalAmount, 0);

    return (
        <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, color: '#00FF87', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>RECEPTIONIST / ADMIN</div>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>Billing & Payments</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,135,0.2)', borderRadius: 16, padding: '20px 22px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>TODAY'S REVENUE</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#00FF87', fontFamily: 'monospace' }}>₹{revenue.revenue.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{revenue.paidCount} payments today</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,209,102,0.2)', borderRadius: 16, padding: '20px 22px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>PENDING COLLECTION</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#FFD166', fontFamily: 'monospace' }}>₹{unpaidTotal.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{invoices.filter((i: any) => !i.isPaid).length} unpaid bills</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 16, padding: '20px 22px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>TOTAL INVOICES</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#00E5FF', fontFamily: 'monospace' }}>{invoices.length}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{invoices.filter((i: any) => i.isPaid).length} paid</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {(['all', 'unpaid', 'paid'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 18px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter === f ? 'rgba(0,255,135,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filter === f ? 'rgba(0,255,135,0.3)' : 'rgba(255,255,255,0.1)'}`, color: filter === f ? '#00FF87' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{f}</button>
                ))}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Receipt size={16} style={{ color: '#00FF87' }} />
                    <span style={{ fontWeight: 800, color: '#fff' }}>Invoices ({filtered.length})</span>
                </div>
                {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading...</div>
                    : filtered.length === 0 ? <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}><Receipt size={36} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />No invoices found</div>
                        : filtered.map((inv: any) => (
                            <div key={inv.id} style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                        <span style={{ fontWeight: 800, color: '#fff' }}>{inv.invoiceNumber}</span>
                                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{inv.patient?.firstName} {inv.patient?.lastName} · {inv.patient?.patientCode}</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'flex', gap: 12 }}>
                                        <span><Clock size={10} style={{ display: 'inline' }} /> {new Date(inv.createdAt).toLocaleDateString('en-IN')}</span>
                                        <span>{inv.items?.length} items</span>
                                        {inv.paymentMethod && <span>paid via {inv.paymentMethod}</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>₹{inv.totalAmount?.toLocaleString()}</span>
                                    {inv.isPaid
                                        ? <span style={{ fontSize: 11, fontWeight: 700, color: '#00FF87', background: '#00FF8715', padding: '4px 12px', borderRadius: 20, border: '1px solid #00FF8730', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} /> PAID</span>
                                        : <button onClick={() => { setSelected(inv); setPayMethod('CASH'); }} style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #00E5FF, #0096AA)', border: 'none', borderRadius: 10, color: '#050709', fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><CreditCard size={12} /> Collect Payment</button>
                                    }
                                </div>
                            </div>
                        ))}
            </div>

            {selected && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32, width: 420 }}>
                        <h3 style={{ fontWeight: 900, fontSize: 18, color: '#fff', marginBottom: 4 }}>Collect Payment</h3>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>{selected.invoiceNumber} — {selected.patient?.firstName} {selected.patient?.lastName}</div>
                        <div style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>TOTAL AMOUNT</div>
                            <div style={{ fontSize: 32, fontWeight: 900, color: '#00E5FF' }}>₹{selected.totalAmount?.toLocaleString()}</div>
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10, fontWeight: 700 }}>PAYMENT METHOD</div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                {['CASH', 'UPI', 'CARD'].map(m => (
                                    <button key={m} onClick={() => setPayMethod(m)} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: payMethod === m ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${payMethod === m ? '#00E5FF44' : 'rgba(255,255,255,0.1)'}`, color: payMethod === m ? '#00E5FF' : 'rgba(255,255,255,0.6)' }}>{m}</button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setSelected(null)} style={{ flex: 1, padding: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                            <button onClick={markPaid} disabled={paying} style={{ flex: 2, padding: 12, background: 'linear-gradient(135deg, #00FF87, #00A858)', border: 'none', borderRadius: 10, color: '#050709', fontWeight: 800, cursor: 'pointer' }}>{paying ? 'Processing...' : '✓ Confirm Payment'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
