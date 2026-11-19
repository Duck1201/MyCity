import express from 'express';
import type { Database } from './database.js';
import { createHealthRouter } from './health.js';
import { mountDocumentation } from './documentation.js';
import { documentationEnabled, type DocumentationOptions } from './documentation-policy.js';

export function createApp(database: Database, options: DocumentationOptions = {}) {
    const app = express();
    app.disable('x-powered-by');
    if (documentationEnabled(options)) mountDocumentation(app);
    app.use(createHealthRouter(database));
    app.use((_req, res) => {
        res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
        });
    });
    return app;
}
