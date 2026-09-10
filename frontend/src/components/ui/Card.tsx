import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    elevated?: boolean;
    hoverGlow?: 'accent' | 'critical' | 'success' | 'none';
}

/** Wraps the existing .glass-card / .glass-card-elevated tokens. */
export function Card({ elevated, hoverGlow = 'none', className, style, children, ...rest }: CardProps) {
    const glowClass = hoverGlow !== 'none' ? `card-hover-${hoverGlow}` : '';
    return (
        <div
            className={[elevated ? 'glass-card-elevated' : 'glass-card', glowClass, className].filter(Boolean).join(' ')}
            style={{ padding: 24, ...style }}
            {...rest}
        >
            {children}
        </div>
    );
}
