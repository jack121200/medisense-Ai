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
            },
            fontFamily: {
                display: ['"DM Sans"', 'sans-serif'],
                body: ['Inter', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
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
