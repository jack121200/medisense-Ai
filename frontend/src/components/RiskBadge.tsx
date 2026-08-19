import React, { useEffect, useState } from 'react';
import { mlApi } from '../api/ml.api';
import { Heart, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface RiskResult {
    risk: 'HIGH' | 'MEDIUM' | 'LOW';
    probability: number;
    color: string;
    has_disease: boolean;
    recommendations: string[];
}

interface Props {
    /** Patient health data from their profile */
    patientData?: {
        age?: number;        // 1-13 age category
        gender?: string;     // Male/Female
        bmi?: number;
        highBP?: boolean;
        highChol?: boolean;
        smoker?: boolean;
        diabetes?: boolean;
        physActivity?: boolean;
        stroke?: boolean;
        genHlth?: number;    // 1-5
    };
    compact?: boolean;
}

const RISK_CONFIG = {
    HIGH:   { icon: AlertTriangle, bg: '#FF2D5510', border: '#FF2D5530', text: '#FF2D55' },
    MEDIUM: { icon: TrendingUp,    bg: '#FFD16610', border: '#FFD16630', text: '#FFD166' },
    LOW:    { icon: CheckCircle,   bg: '#00FF8710', border: '#00FF8730', text: '#00FF87' },
};

export default function RiskBadge({ patientData, compact = false }: Props) {
    const [result, setResult] = useState<RiskResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (patientData) analyze();
    }, [JSON.stringify(patientData)]);

    async function analyze() {
        if (!patientData) return;
        setLoading(true);
        setError(false);
        try {
            // Map patient profile fields to the 21 model features
            const ageCategory = patientData.age
                ? Math.min(Math.max(Math.round((patientData.age - 18) / 5) + 1, 1), 13)
                : 5; // default 40-44

            const payload = {
                HighBP:            patientData.highBP ? 1 : 0,
                HighChol:          patientData.highChol ? 1 : 0,
                CholCheck:         1,  // assume checked
                BMI:               patientData.bmi || 25,
                Smoker:            patientData.smoker ? 1 : 0,
                Stroke:            patientData.stroke ? 1 : 0,
                Diabetes:          patientData.diabetes ? 2 : 0,
                PhysActivity:      patientData.physActivity ? 1 : 0,
                Fruits:            1,
                Veggies:           1,
                HvyAlcoholConsump: 0,
                AnyHealthcare:     1,
                NoDocbcCost:       0,
                GenHlth:           patientData.genHlth || 3,
                MentHlth:          0,
                PhysHlth:          0,
                DiffWalk:          0,
                Sex:               patientData.gender === 'Male' ? 1 : 0,
                Age:               ageCategory,
                Education:         4,  // some college
                Income:            5,
            };
            const res = await mlApi.predictRisk(payload);
            setResult(res.data.data);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 20, fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: '"Inter", system-ui, sans-serif' }}>
                <Heart size={12} style={{ animation: 'pulse 1.5s ease-in-out infinite' }} /> Calculating risk...
            </div>
        );
    }

    if (error || !result) {
        return compact ? null : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: '"Inter", system-ui, sans-serif' }}>
                <Heart size={11} /> Risk N/A
            </div>
        );
    }

    const cfg = RISK_CONFIG[result.risk];
    const Icon = cfg.icon;

    if (compact) {
        return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, fontSize: 11, fontWeight: 700, color: cfg.text, cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif' }}
                onClick={() => setExpanded(!expanded)} title={`Heart Risk: ${result.risk} (${result.probability}%)`}>
                <Icon size={11} /> {result.risk} {result.probability}%
            </div>
        );
    }

    return (
        <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 16, padding: 18, fontFamily: '"Inter", system-ui, sans-serif' }}>
            {/* Main risk display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: expanded ? 16 : 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cfg.text}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={22} style={{ color: cfg.text }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 2 }}>HEART DISEASE RISK</div>
                    <div style={{ fontWeight: 900, color: cfg.text, fontSize: 20 }}>{result.risk} RISK</div>
                    {/* Probability bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                            <div style={{ width: `${result.probability}%`, height: '100%', borderRadius: 2, background: cfg.text, transition: 'width 0.6s ease' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.text }}>{result.probability}%</span>
                    </div>
                </div>
                <button onClick={() => setExpanded(!expanded)}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 11, padding: '4px 8px' }}>
                    {expanded ? 'Less ▲' : 'More ▼'}
                </button>
            </div>

            {/* Expanded recommendations */}
            {expanded && result.recommendations.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>Recommendations</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {result.recommendations.map((rec, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.65)', alignItems: 'flex-start' }}>
                                <span style={{ color: cfg.text, flexShrink: 0, marginTop: 1 }}>•</span>
                                <span>{rec}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
