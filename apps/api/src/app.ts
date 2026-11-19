import express from 'express';
import type { Database } from './database.js';

export function createApp(database: Database) {
    const app = express();
    app.disable('x-powered-by');
    app.get('/api/v1/health/live', (_req, res) => {
        res.json({ data: { status: 'alive' } });
    });
    app.get('/api/v1/health/ready', async (_req, res) => {
        res.set('Cache-Control', 'no-store');
        try {
            await database.user.count();
            res.json({ data: { status: 'ready' } });
        } catch {
            res.status(503).json({
                error: {
                    code: 'UNAVAILABLE',
                    message: 'Serviço temporariamente indisponível.',
                },
            });
        }
    });
    app.use((_req, res) => {
        res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
        });
    });
    return app;
}
