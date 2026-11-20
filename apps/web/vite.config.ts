import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command, mode }) => ({
    appType: mode === 'prototype' ? 'mpa' : 'spa',
    plugins: [
        react(),
        tailwindcss(),
        ...(mode === 'prototype'
            ? [
                  {
                      name: 'administrative-preview',
                      configureServer(server: import('vite').ViteDevServer) {
                          server.middlewares.use((req, res, next) => {
                              const pathname = req.url?.split('?')[0];
                              if (pathname === '/__preview/confirmations' && req.method === 'GET') {
                                  res.setHeader('Content-Type', 'text/html; charset=utf-8');
                                  res.setHeader('Cache-Control', 'no-store');
                                  res.setHeader('Referrer-Policy', 'no-referrer');
                                  res.setHeader('Content-Security-Policy', "frame-ancestors http://localhost:8093 http://127.0.0.1:8093; object-src 'none'; base-uri 'none'");
                                  res.end('<!doctype html><meta charset="utf-8"><script type="module" src="/src/prototype/confirmation-relay.ts"></script>');
                                  return;
                              }
                              if (pathname && /^\/(?:visao-geral|categorias|atendimento(?:\/[^/]+)?)?\/?$/.test(pathname)) req.url = '/prototipo.html';
                              next();
                          });
                      },
                  },
              ]
            : []),
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), ...(command === 'serve' && { '@mycity/contracts': fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url)) }) } },
    server: { port: 8090, strictPort: true, proxy: mode === 'prototype' ? {} : { '/api': { target: process.env.MYCITY_API_PROXY ?? 'http://127.0.0.1:3000', xfwd: true } } },
    test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] },
}));
