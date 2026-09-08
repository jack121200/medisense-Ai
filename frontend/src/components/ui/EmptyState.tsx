import React from 'react';

export interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-lg)' }}>
            {icon && <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>{icon}</div>}
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: description ? 6 : 0 }}>{title}</div>
            {description && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{description}</div>}
            {action && <div style={{ marginTop: 18 }}>{action}</div>}
        </div>
    );
}
