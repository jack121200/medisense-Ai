import React, { useState, useEffect } from 'react';
import { mlApi } from '../api/ml.api';
import { Brain, Network, HelpCircle, Activity, Sparkles, CheckCircle2, ChevronRight, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    patientData?: {
        age?: number;
        resting_blood_pressure?: number;
        cholestoral?: number;
        fasting_blood_sugar?: number;
        chest_pain_present?: boolean;
        ecg_abnormal?: boolean;
    };
}

export default function BayesianUncertaintyCard({ patientData }: Props) {
    const [age, setAge] = useState<number>(patientData?.age || 62);
    const [bp, setBp] = useState<number>(patientData?.resting_blood_pressure || 158);
    const [chol, setChol] = useState<number>(patientData?.cholestoral || 265);
    const [fbs, setFbs] = useState<number>(patientData?.fasting_blood_sugar || 138);
    const [angina, setAngina] = useState<boolean>(patientData?.chest_pain_present ?? true);
    const [ecg, setEcg] = useState<boolean>(patientData?.ecg_abnormal ?? true);

    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [completedTests, setCompletedTests] = useState<string[]>([]);

    const runInference = async (testsCompleted = completedTests) => {
        setLoading(true);
        try {
            const res = await mlApi.runBayesianInference({
                age,
                resting_blood_pressure: bp,
                cholestoral: chol,
                fasting_blood_sugar: fbs,
                chest_pain_present: angina,
                ecg_abnormal: ecg,
                known_tests_completed: testsCompleted,
            });
            setResult(res.data.data);
        } catch {
            toast.error('Failed to execute Bayesian inference');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        runInference();
    }, [age, bp, chol, fbs, angina, ecg]);

    const toggleTestCompleted = (testId: string) => {
        const next = completedTests.includes(testId)
            ? completedTests.filter(id => id !== testId)
            : [...completedTests, testId];
        setCompletedTests(next);
        runInference(next);
    };

    const bestTest = result?.next_best_test_recommendation;

    return (
        <div style={{
            background: 'var(--surface-1)',
            border: '1px solid rgba(13, 92, 126, 0.2)',
            borderRadius: 20,
            padding: 24,
            marginBottom: 24,
            fontFamily: 'var(--font-body)',
        }}>
            {/* Title Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(13, 92, 126, 0.2), rgba(13, 92, 126, 0.05))',
                        border: '1px solid rgba(13, 92, 126, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Network size={22} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                Bayesian Decision & Epistemic Uncertainty Engine
                            </h2>
                            <span style={{
                                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 12,
                                background: 'rgba(13, 92, 126, 0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(13, 92, 126, 0.3)'
                            }}>
                                UNIT I — BAYESIAN DAG
                            </span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                            Calculates Joint Posterior Distribution P(CAD | Evidence), Model Uncertainty Entropy & Value of Information (VOI).
                        </p>
                    </div>
                </div>

                <button onClick={() => runInference()} disabled={loading} className="btn-ghost" style={{ fontSize: 12 }}>
                    <Sparkles size={14} color="var(--accent-primary)" /> {loading ? 'Computing Bayes...' : 'Recalculate'}
                </button>
            </div>

            {/* Top Stats Grid */}
            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                    {/* Stat 1: Posterior Probability */}
                    <div style={{
                        background: 'var(--surface-1)', border: `1px solid ${result.color}35`,
                        borderRadius: 14, padding: 18, position: 'relative', overflow: 'hidden'
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Posterior P(Disease | Evidence)
                        </div>
                        <div className="font-mono" style={{ fontSize: 32, fontWeight: 900, color: result.color, marginTop: 4 }}>
                            {result.posterior_probability_pct}%
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className={`risk-badge ${result.risk_level.toLowerCase()}`}>{result.risk_level} RISK</span>
                            <span>(Bayes Likelihood Ratio)</span>
                        </div>
                    </div>

                    {/* Stat 2: Epistemic Uncertainty & Credible Interval */}
                    <div style={{
                        background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                        borderRadius: 14, padding: 18
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Epistemic Uncertainty (Entropy)
                        </div>
                        <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--risk-medium-text)', marginTop: 4 }}>
                            ±{result.credible_interval_95.margin_pct}% <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>margin</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                            95% Bayesian Interval: <strong style={{ color: 'var(--text-primary)' }}>[{result.credible_interval_95.lower_pct}% – {result.credible_interval_95.upper_pct}%]</strong>
                        </div>
                    </div>

                    {/* Stat 3: Next Best Diagnostic Test (VOI) */}
                    <div style={{
                        background: 'rgba(13, 92, 126, 0.06)', border: '1px solid rgba(13, 92, 126, 0.25)',
                        borderRadius: 14, padding: 18
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            💡 Next Best Test (Max VOI)
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bestTest ? bestTest.name : 'All Key Tests Completed'}
                        </div>
                        {bestTest && (
                            <div style={{ fontSize: 11, color: 'var(--risk-low-text)', marginTop: 4, fontWeight: 700 }}>
                                📉 Reduces Uncertainty by {bestTest.expected_entropy_reduction_pct}%
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Interactive Clinical Evidence Sliders */}
            <div style={{
                background: 'var(--surface-1)', border: '1px solid var(--surface-border)',
                borderRadius: 14, padding: 16, marginBottom: 20
            }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    ⚙️ ADJUST CLINICAL EVIDENCE PARAMETERS:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                            Age: <strong style={{ color: 'var(--text-primary)' }}>{age} yrs</strong>
                        </label>
                        <input type="range" min={20} max={90} value={age} onChange={e => setAge(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                            Resting BP: <strong style={{ color: 'var(--text-primary)' }}>{bp} mmHg</strong>
                        </label>
                        <input type="range" min={90} max={200} value={bp} onChange={e => setBp(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                            Cholesterol: <strong style={{ color: 'var(--text-primary)' }}>{chol} mg/dL</strong>
                        </label>
                        <input type="range" min={120} max={380} value={chol} onChange={e => setChol(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                            Fasting Blood Sugar: <strong style={{ color: 'var(--text-primary)' }}>{fbs} mg/dL</strong>
                        </label>
                        <input type="range" min={70} max={250} value={fbs} onChange={e => setFbs(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 20, marginTop: 12, borderTop: '1px solid var(--surface-border)', paddingTop: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
                        <input type="checkbox" checked={angina} onChange={e => setAngina(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                        Anginal Chest Pain Present
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
                        <input type="checkbox" checked={ecg} onChange={e => setEcg(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                        ST-T ECG Wave Abnormality
                    </label>
                </div>
            </div>

            {/* Value of Information (VOI) Diagnostic Test Ranking Table */}
            {result?.all_voi_rankings?.length > 0 && (
                <div style={{
                    background: 'rgba(13, 45, 62, 0.10)', border: '1px solid var(--surface-border)',
                    borderRadius: 14, padding: 16
                }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>📊 Value of Information (VOI) Ranking — Optimal Diagnostic Strategy</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ranked by Entropy Reduction ($\Delta H$)</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.all_voi_rankings.map((test: any, idx: number) => {
                            const isCompleted = completedTests.includes(test.id);
                            return (
                                <div key={test.id} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px 14px', borderRadius: 10,
                                    background: idx === 0 && !isCompleted ? 'rgba(13, 92, 126, 0.08)' : 'var(--surface-2)',
                                    border: idx === 0 && !isCompleted ? '1px solid rgba(13, 92, 126, 0.25)' : '1px solid var(--surface-border)',
                                    opacity: isCompleted ? 0.5 : 1,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{
                                            width: 24, height: 24, borderRadius: '50%',
                                            background: idx === 0 ? 'var(--accent-primary)' : 'var(--surface-2)',
                                            color: idx === 0 ? '#000' : 'var(--text-primary)',
                                            fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {test.name}
                                                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>({test.category})</span>
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{test.desc}</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--risk-low-text)' }}>
                                                -{test.expected_entropy_reduction_pct}% Uncertainty
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                                Est. Cost: ₹{test.cost_inr}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => toggleTestCompleted(test.id)}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                                border: 'none', cursor: 'pointer',
                                                background: isCompleted ? 'var(--surface-2)' : 'linear-gradient(90deg, var(--accent-primary), var(--accent-primary))',
                                                color: isCompleted ? 'var(--text-secondary)' : '#000'
                                            }}
                                        >
                                            {isCompleted ? 'Completed ✓' : 'Mark Completed'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
