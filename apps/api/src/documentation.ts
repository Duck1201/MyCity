import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import document from './openapi.json' with { type: 'json' };

export function mountDocumentation(app: Express) {
    app.use(['/api/docs', '/api/openapi.json'], (_req, res, next) => {
        res.set({
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        });
        next();
    });
    app.get('/api/openapi.json', (_req, res) => res.json(document));
    const options = {
        customSiteTitle: 'MyCity — API',
        swaggerOptions: { validatorUrl: null, persistAuthorization: false, supportedSubmitMethods: ['get'] },
    };
    app.use('/api/docs', swaggerUi.serveFiles(document, options), swaggerUi.setup(document, options));
}
