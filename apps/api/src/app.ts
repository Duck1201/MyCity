import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { createSessionRoutes } from './modules/identity/sessions.js';
import { createWeatherAlertsRouter } from './modules/alerts/index.js';
import { createNotificationsRouter } from './modules/notifications/index.js';
import { createCategoriesRouter, createReportsRouter } from './modules/reports/index.js';
import type { Database } from './database.js';
import { createHealthRouter } from './health.js';
import { mountDocumentation } from './documentation.js';
import { documentationEnabled, type DocumentationOptions } from './documentation-policy.js';

export function createApp(database: Database, options: DocumentationOptions & { webOrigin?: string; proxyHops?: number; uploadDir?: string } = {}) {
    const app = express();
    app.set('trust proxy', options.proxyHops ?? 0);
    app.disable('x-powered-by');
    if (documentationEnabled(options)) mountDocumentation(app);
    app.use(createHealthRouter(database));
    app.use('/api/v1', (_req, res, next) => {
        res.locals.requestId = randomUUID();
        res.set('Cache-Control', 'no-store');
        next();
    });
    const sessions = createSessionRoutes(database, options.webOrigin ?? 'http://localhost:8090');
    app.use(sessions.router);
    app.use('/api/v1/weather-alerts', sessions.authenticate, createWeatherAlertsRouter());
    app.use('/api/v1/categories', sessions.authenticate, createCategoriesRouter(database));
    app.use('/api/v1/reports', sessions.authenticate, createReportsRouter(database, options.uploadDir ?? './uploads'));
    app.use('/api/v1/notifications', sessions.authenticate, createNotificationsRouter(database));
    const handleError: ErrorRequestHandler = (err, _req, res, next) => {
        if (res.headersSent) return next(err);
        const status = err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500;
        res.status(status).json({ error: { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 400 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR', message: 'Não foi possível processar a solicitação.' }, requestId: res.locals.requestId });
    };
    app.use(handleError);
    app.use((_req, res) => {
        res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
        });
    });
    return app;
}
