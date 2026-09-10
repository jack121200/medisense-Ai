import React from 'react';

type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_COLORS: Record<StatusTone, { color: string; bg: string }> = {
    success: { color: 'var(--risk-low)', bg: 'var(--risk-low-bg)' },
    warning: { color: 'var(--risk-medium)', bg: 'var(--risk-medium-bg)' },
    danger: { color: 'var(--risk-critical)', bg: 'var(--risk-critical-bg)' },
    info: { color: 'var(--accent-primary)', bg: 'var(--accent-glow)' },
    neutral: { color: 'var(--text-secondary)', bg: 'rgba(122, 92, 66, 0.08)' },
};

/** Clinical risk badge — reuses the existing .risk-badge classes. */
export function RiskBadge({ level, children }: { level: RiskLevel; children: React.ReactNode }) {
    return <span className={`risk-badge ${level}`}>{children}</span>;
}

/** Generic status badge (not clinical-severity-specific) for things like request/order state. */
export function StatusBadge({ tone = 'neutral', children }: { tone?: StatusTone; children: React.ReactNode }) {
    const { color, bg } = STATUS_COLORS[tone];
    return (
        <span
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 9999,
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                color, background: bg, border: '1px solid transparent',
            }}
        >
            {children}
        </span>
    );
}
