import React, { useState, useEffect } from 'react';
import { mlApi } from '../api/ml.api';
import { Sliders, ShieldAlert, Cpu, Sparkles, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

const DRUGS = ["Ramipril", "Metoprolol", "Amlodipine", "Atorvastatin"];

export default function FuzzyDosingCard() {
    const [bp, setBp] = useState<number>(156);
    const [creatinine, setCreatinine] = useState<number>(1.9);
    const [age, setAge] = useState<number>(64);
    const [drug, setDrug] = useState<string>("Ramipril");

    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const calculateFuzzyDose = async () => {
        setLoading(true);
        try {
            const res = await mlApi.runFuzzyDosing({
                systolic_bp: bp,
                serum_creatinine: creatinine,
                age,
                drug_name: drug,
            });
            setResult(res.data.data);
        } catch {
            toast.error('Failed to run Mamdani Fuzzy Controller');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        calculateFuzzyDose();
    }, [bp, creatinine, age, drug]);

    return (
        <div style={{
            background: 'var(--surface-1)',
            border: '1px solid rgba(184, 145, 47, 0.25)',
            borderRadius: 20,
            padding: 24,
            marginBottom: 24,
            fontFamily: 'var(--font-body)',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(184, 145, 47, 0.2), rgba(204, 107, 61, 0.05))',
                        border: '1px solid rgba(184, 145, 47, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Cpu size={22} color="var(--risk-medium)" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                Mamdani Fuzzy Logic Controller — Drug Dosing & Triage
                            </h2>
                            <span style={{
                                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 12,
                                background: 'rgba(184, 145, 47, 0.15)', color: 'var(--risk-medium)', border: '1px solid rgba(184, 145, 47, 0.3)'
                            }}>
                                UNIT III — MAMDANI FIS
                            </span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                            Continuous membership fuzzification & Centroid Defuzzification for renal & cardiac dose safety.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    {DRUGS.map(d => (
                        <button
                            key={d}
                            onClick={() => setDrug(d)}
                            style={{
                                padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                                border: drug === d ? '1px solid var(--risk-medium)' : '1px solid var(--surface-border)',
                                background: drug === d ? 'rgba(184, 145, 47, 0.15)' : 'var(--surface-2)',
                                color: drug === d ? 'var(--risk-medium)' : 'var(--text-secondary)',
                                cursor: 'pointer'
                            }}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Grid */}
            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                    {/* Dose Output */}
                    <div style={{
                        background: 'rgba(184, 145, 47, 0.06)', border: '1px solid rgba(184, 145, 47, 0.3)',
                        borderRadius: 14, padding: 18
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--risk-medium)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            💊 Centroid Defuzzified Dose
                        </div>
                        <div className="font-mono" style={{ fontSize: 30, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>
                            {result.recommended_dose_label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                            Standard Full Dose: <strong>{result.standard_full_dose}</strong> ({result.dosage_reduction_pct}% reduction)
                        </div>
                    </div>

                    {/* Triage Priority Score */}
                    <div style={{
                        background: 'var(--surface-1)', border: `1px solid ${result.triage_color}40`,
                        borderRadius: 14, padding: 18
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            🚨 Dynamic Triage Score
                        </div>
                        <div className="font-mono" style={{ fontSize: 30, fontWeight: 900, color: result.triage_color, marginTop: 4 }}>
                            {result.triage_score} <span style={{ fontSize: 14 }}>/ 100</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: result.triage_color, marginTop: 4 }}>
                            Priority: {result.triage_label}
                        </div>
                    </div>

                    {/* Defuzzification Method */}
                    <div style={{
                        background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                        borderRadius: 14, padding: 18
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Defuzzification Integral
                        </div>
                        <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-primary)', marginTop: 4 }}>
                            {result.defuzzified_factor}x <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>scaling</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                            Method: <strong>{result.defuzzification_method}</strong>
                        </div>
                    </div>
                </div>
            )}

            {/* Sliders */}
            <div style={{
                background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                borderRadius: 14, padding: 16, marginBottom: 20
            }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    🎛️ FUZZY INPUT VARIABLES (REAL-TIME SLIDERS):
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                            <span>Systolic BP</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{bp} mmHg</strong>
                        </div>
                        <input type="range" min={80} max={220} value={bp} onChange={e => setBp(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--risk-medium)' }} />
                        <div style={{ fontSize: 10, color: 'var(--risk-medium)', marginTop: 2 }}>
                            Membership Level: {result?.fuzzified_memberships?.bp_level || '—'}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                            <span>Serum Creatinine (Kidney)</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{creatinine} mg/dL</strong>
                        </div>
                        <input type="range" min={0.6} max={4.5} step={0.1} value={creatinine} onChange={e => setCreatinine(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--risk-medium)' }} />
                        <div style={{ fontSize: 10, color: 'var(--risk-high)', marginTop: 2 }}>
                            Membership Level: {result?.fuzzified_memberships?.creatinine_level || '—'}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                            <span>Age</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{age} yrs</strong>
                        </div>
                        <input type="range" min={18} max={90} value={age} onChange={e => setAge(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--risk-medium)' }} />
                        <div style={{ fontSize: 10, color: 'var(--vitals-bp)', marginTop: 2 }}>
                            Membership Level: {result?.fuzzified_memberships?.age_group || '—'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mamdani Active Fired Rules Trace */}
            {result?.active_rules_fired?.length > 0 && (
                <div style={{
                    background: 'rgba(90, 65, 45, 0.10)', border: '1px solid var(--surface-border)',
                    borderRadius: 14, padding: 16
                }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
                        📋 Mamdani Active Fuzzy Rules Trace (Max-Min Firing Strength $\alpha$)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.active_rules_fired.map((r: any) => (
                            <div key={r.rule_id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px', borderRadius: 8, background: 'var(--surface-1)',
                                border: '1px solid var(--surface-border)', fontSize: 12
                            }}>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                    Rule #{r.rule_id}: {r.rule_text}
                                </div>
                                <div style={{ color: 'var(--risk-medium)', fontWeight: 800, fontFamily: 'monospace' }}>
                                    Firing $\alpha$ = {r.firing_strength_alpha}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
