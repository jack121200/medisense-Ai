import React from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    icon?: React.ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
};

/**
 * Wraps the existing .btn-primary/.btn-ghost/.btn-danger classes (already
 * defined in index.css with real design tokens behind them) in a typed,
 * accessible component — previously every page hand-rolled its own button
 * markup with inline styles, with no consistent disabled/loading/focus
 * handling and no accessible name for icon-only buttons.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', size = 'md', loading, icon, disabled, children, className, style, ...rest }, ref) => {
        return (
            <button
                ref={ref}
                type={rest.type ?? 'button'}
                className={[VARIANT_CLASS[variant], className].filter(Boolean).join(' ')}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                style={{
                    fontSize: size === 'sm' ? 12 : undefined,
                    padding: size === 'sm' ? '6px 14px' : undefined,
                    outlineOffset: 2,
                    ...style,
                }}
                {...rest}
            >
                {loading ? (
                    <span
                        aria-hidden="true"
                        style={{
                            width: 14, height: 14, borderRadius: '50%',
                            border: '2px solid currentColor', borderTopColor: 'transparent',
                            animation: 'spin 0.7s linear infinite', display: 'inline-block',
                        }}
                    />
                ) : icon}
                {children}
            </button>
        );
    }
);
Button.displayName = 'Button';
