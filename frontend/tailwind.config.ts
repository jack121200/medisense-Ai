/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                // Exact palette from spec
                'bg-primary': '#0A0E1A',
                'bg-secondary': '#0F1629',
                'bg-tertiary': '#151E35',
                'surface-1': '#1A2340',
                'surface-2': '#1F2B4D',
                'surface-border': '#2A3A5C',
                'accent-primary': '#00B4D8',
                'accent-secondary': '#48CAE4',
                'risk-critical': '#FF2D55',
                'risk-high': '#FF6B35',
                'risk-medium': '#FFD166',
                'risk-low': '#06D6A0',
                'alert-emergency': '#FF2D55',
                'alert-warning': '#FFD166',
                'text-primary': '#F0F4FF',
                'text-secondary': '#8E9DC4',
                'text-muted': '#4A5680',
                'vitals-heart': '#FF4B6E',
                'vitals-oxygen': '#00B4D8',
                'vitals-bp': '#A855F7',
                'vitals-temp': '#F97316',
                'vitals-glucose': '#22C55E',
                // Generic status names — the design tokens above (risk-*,
                // alert-*) are domain-specific to clinical severity, but a
                // shared component (Button, Badge, Toast) needs a
                // vocabulary that isn't cardiology-specific. These are
                // aliases onto the same palette, not new colors, so a
                // status color and a risk color painted at the same
                // semantic level always match.
                success: '#06D6A0',
                warning: '#FFD166',
                danger: '#FF2D55',
                info: '#00B4D8',
            },
            fontFamily: {
                display: ['"DM Sans"', 'sans-serif'],
                body: ['Inter', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
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
                    '0%': { boxShadow: '0 0 10px rgba(0,180,216,0.2)' },
                    '100%': { boxShadow: '0 0 25px rgba(0,180,216,0.5)' },
                },
            },
            boxShadow: {
                card: '0 4px 24px rgba(0,0,0,0.4)',
                elevated: '0 8px 40px rgba(0,0,0,0.6)',
                'glow-blue': '0 0 20px rgba(0,180,216,0.3)',
                'glow-red': '0 0 20px rgba(255,45,85,0.3)',
            },
        },
    },
    plugins: [],
};
