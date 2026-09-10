import React from 'react';

export function Spinner({ size = 24, label = 'Loading' }: { size?: number; label?: string }) {
    return (
        <span
            role="status"
            aria-label={label}
            style={{
                display: 'inline-block', width: size, height: size, borderRadius: '50%',
                border: '2.5px solid rgba(122, 92, 66, 0.18)', borderTopColor: 'var(--accent-primary)',
                animation: 'spin 0.8s linear infinite',
            }}
        />
    );
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '80px 0' }}>
            <Spinner size={32} label={label} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
        </div>
    );
}
