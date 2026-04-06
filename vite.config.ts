import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
    // In production build, strip GEMINI API keys from the bundle
    // They are only needed for local dev; production uses server-side proxy
    const envOverrides = mode === 'production' ? {
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
        'import.meta.env.VITE_GEMINI_API_KEY_1': JSON.stringify(''),
        'import.meta.env.VITE_GEMINI_API_KEY_2': JSON.stringify(''),
        'import.meta.env.VITE_GEMINI_API_KEY_3': JSON.stringify(''),
    } : {};

    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        define: envOverrides,
        test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.ts'],
            include: ['src/**/*.{test,spec}.{ts,tsx}'],
        },
        build: {
            outDir: 'dist',
            sourcemap: false,
            rollupOptions: {
                output: {
                    manualChunks: {
                        vendor: ['react', 'react-dom', 'react-router-dom'],
                        firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/database'],
                    },
                },
            },
        },
        server: {
            port: 5173,
            open: true,
            proxy: {
                '/api': {
                    target: 'http://localhost:5173',
                    changeOrigin: true,
                    secure: false,
                }
            }
        },
    };
})

