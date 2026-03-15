/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        './src/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
                question: ['"Plus Jakarta Sans"', 'sans-serif'],
            },
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            boxShadow: {
                // Subtle layered shadows for card depth — not too bright
                'soft': '0 2px 8px -1px rgba(0,0,0,0.06), 0 1px 3px -1px rgba(0,0,0,0.04)',
                'medium': '0 6px 18px -3px rgba(0,0,0,0.09), 0 2px 6px -2px rgba(0,0,0,0.05)',
                'heavy': '0 14px 30px -6px rgba(0,0,0,0.13), 0 4px 10px -3px rgba(0,0,0,0.07)',
                'inset': 'inset 0 2px 5px 0 rgba(0,0,0,0.04)',
                // Card overlay: a very faint bottom shadow that dims background
                'card': '0 1px 4px 0 rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.07)',
                'card-hover': '0 4px 12px -2px rgba(0,0,0,0.10), 0 8px 24px -8px rgba(0,0,0,0.09)',
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
