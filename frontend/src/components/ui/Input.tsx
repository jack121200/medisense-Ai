import React, { useId } from 'react';

interface BaseFieldProps {
    label?: string;
    error?: string;
    hint?: string;
    required?: boolean;
}

export type InputProps = BaseFieldProps & React.InputHTMLAttributes<HTMLInputElement>;
export type TextareaProps = BaseFieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export type SelectProps = BaseFieldProps & React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode };

/**
 * Shared label/error/hint chrome so every form field gets a real <label>
 * (for) association, aria-invalid, and aria-describedby linking the error
 * message to the field — none of which existed on the app's hand-rolled
 * inputs before (labels were plain <label> tags with no htmlFor).
 */
function FieldChrome({
    id, label, error, hint, required, children,
}: BaseFieldProps & { id: string; children: React.ReactNode }) {
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {label && (
                <label htmlFor={id} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {label} {required && <span style={{ color: 'var(--risk-critical-text)' }} aria-hidden="true">*</span>}
                </label>
            )}
            {children}
            {hint && !error && <span id={hintId} style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{hint}</span>}
            {error && <span id={errorId} role="alert" style={{ fontSize: 11.5, color: 'var(--risk-critical-text)' }}>{error}</span>}
        </div>
    );
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, hint, required, id, className, ...rest }, ref) => {
        const autoId = useId();
        const fieldId = id ?? autoId;
        return (
            <FieldChrome id={fieldId} label={label} error={error} hint={hint} required={required}>
                <input
                    ref={ref}
                    id={fieldId}
                    className={['form-input', className].filter(Boolean).join(' ')}
                    required={required}
                    aria-invalid={!!error || undefined}
                    aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
                    {...rest}
                />
            </FieldChrome>
        );
    }
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, hint, required, id, className, ...rest }, ref) => {
        const autoId = useId();
        const fieldId = id ?? autoId;
        return (
            <FieldChrome id={fieldId} label={label} error={error} hint={hint} required={required}>
                <textarea
                    ref={ref}
                    id={fieldId}
                    className={['form-input', className].filter(Boolean).join(' ')}
                    required={required}
                    aria-invalid={!!error || undefined}
                    aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
                    style={{ resize: 'vertical', ...rest.style }}
                    {...rest}
                />
            </FieldChrome>
        );
    }
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, hint, required, id, className, children, ...rest }, ref) => {
        const autoId = useId();
        const fieldId = id ?? autoId;
        return (
            <FieldChrome id={fieldId} label={label} error={error} hint={hint} required={required}>
                <select
                    ref={ref}
                    id={fieldId}
                    className={['form-input', className].filter(Boolean).join(' ')}
                    required={required}
                    aria-invalid={!!error || undefined}
                    aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
                    {...rest}
                >
                    {children}
                </select>
            </FieldChrome>
        );
    }
);
Select.displayName = 'Select';
