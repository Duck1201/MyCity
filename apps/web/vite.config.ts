import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command }) => ({
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), ...(command === 'serve' && { '@mycity/contracts': fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url)) }) } },
    server: { port: 8090, strictPort: true, proxy: { '/api': { target: process.env.MYCITY_API_PROXY ?? 'http://127.0.0.1:3000', xfwd: true } } },
    test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] },
}));
