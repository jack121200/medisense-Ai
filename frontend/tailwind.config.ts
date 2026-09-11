/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            // Every color here resolves to the CSS variables defined in
            // src/index.css rather than restating hex values. This file
            // previously carried its own (cyan/navy) palette that silently
            // disagreed with index.css's — one source of truth means a
            // theme change can never again land in only half the app.
            colors: {
                'bg-primary': 'var(--bg-primary)',
                'bg-secondary': 'var(--bg-secondary)',
                'bg-tertiary': 'var(--bg-tertiary)',
                'surface-1': 'var(--surface-1)',
                'surface-2': 'var(--surface-2)',
                'surface-border': 'var(--surface-border)',
                'accent-primary': 'var(--accent-primary)',
                'accent-secondary': 'var(--accent-magenta)',
                'risk-critical': 'var(--risk-critical)',
                'risk-high': 'var(--risk-high)',
                'risk-medium': 'var(--risk-medium)',
                'risk-low': 'var(--risk-low)',
                'alert-emergency': 'var(--risk-critical)',
                'alert-warning': 'var(--risk-medium)',
                'text-primary': 'var(--text-primary)',
                'text-secondary': 'var(--text-secondary)',
                'text-muted': 'var(--text-muted)',
                'vitals-heart': 'var(--vitals-heart)',
                'vitals-oxygen': 'var(--vitals-oxygen)',
                'vitals-bp': 'var(--vitals-bp)',
                'vitals-temp': 'var(--vitals-temp)',
                'vitals-glucose': 'var(--vitals-glucose)',
                // Generic status names — the risk-*/alert-* tokens above are
                // domain-specific to clinical severity, but a shared
                // component (Button, Badge, Toast) needs a vocabulary that
                // isn't cardiology-specific. Aliases onto the same palette,
                // so a status color and a risk color painted at the same
                // semantic level always match.
                success: 'var(--risk-low)',
                warning: 'var(--risk-medium)',
                danger: 'var(--risk-critical)',
                info: 'var(--accent-primary)',
            },
            fontFamily: {
                display: ['"Bricolage Grotesque"', 'Onest', 'system-ui', 'sans-serif'],
                body: ['Onest', 'system-ui', 'sans-serif'],
                mono: ['"Spline Sans Mono"', 'ui-monospace', 'monospace'],
            },
            // Named type scale — every component below (and every page as
            // it migrates off inline styles) should reach for one of these
            // instead of a one-off px value, so text sizing stays
            // consistent across ~20 pages instead of drifting per-file.
            fontSize: {
                display: ['2.25rem', { lineHeight: '1.15', fontWeight: '800' }],
                h1: ['1.75rem', { lineHeight: '1.2', fontWeight: '800' }],
                h2: ['1.375rem', { lineHeight: '1.25', fontWeight: '700' }],
                h3: ['1.125rem', { lineHeight: '1.3', fontWeight: '700' }],
                h4: ['0.9375rem', { lineHeight: '1.35', fontWeight: '700' }],
                'body-lg': ['1rem', { lineHeight: '1.6' }],
                body: ['0.875rem', { lineHeight: '1.6' }],
                'body-sm': ['0.8125rem', { lineHeight: '1.55' }],
                caption: ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.06em' }],
            },
            // Semantic spacing — named intents on top of Tailwind's numeric
            // scale, so a page reaches for "the gap between cards" rather
            // than re-deciding a px value every time.
            spacing: {
                'section-gap': '1.75rem',
                'card-padding': '1.5rem',
                'form-gap': '0.875rem',
            },
            borderRadius: {
                sm: '6px',
                md: '10px',
                lg: '16px',
                xl: '24px',
            },
            animation: {
                pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'slide-in': 'slideIn 0.3s ease-out',
                'fade-in': 'fadeIn 0.4s ease-out',
                glow: 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                slideIn: {
                    '0%': { transform: 'translateX(-20px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                glow: {
                    '0%': { boxShadow: '0 0 10px rgba(35,83,71,0.15)' },
                    '100%': { boxShadow: '0 0 25px rgba(35,83,71,0.35)' },
                },
            },
            boxShadow: {
                card: 'var(--shadow-sm)',
                elevated: 'var(--shadow-md)',
                'glow-accent': 'var(--glow-cyan)',
                'glow-red': 'var(--glow-red)',
            },
        },
    },
    plugins: [],
};
