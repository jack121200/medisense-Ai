import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('error', (err, _req, res) => {
                        if (!res.headersSent) {
                            res.writeHead(503, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, message: 'Backend service offline. Please start Docker or backend server.' }));
                        }
                    });
                },
            },
            '/socket.io': {
                target: 'http://localhost:5000',
                ws: true,
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('error', () => {
                        // Suppress socket error noise when server is offline
                    });
                },
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    charts: ['recharts'],
                    ui: ['framer-motion', 'lucide-react'],
                },
            },
        },
    },
});
