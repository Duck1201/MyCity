import { publicRateLimit } from './public-limits.js';
import { Router } from 'express';
import type { Database } from './database.js';

export function createHealthRouter(database: Database) {
    const router = Router();
    router.get('/api/v1/health/live', publicRateLimit(60), (_req, res) => {
        /* #swagger.tags = ['Saúde']
           #swagger.summary = 'Verificar se o processo está ativo'
           #swagger.responses[200] = { description: 'Processo ativo; não consulta o banco.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Liveness' } } } }
        */
        res.json({ data: { status: 'alive' } });
    });
    router.get('/api/v1/health/ready', publicRateLimit(30), async (_req, res) => {
        /* #swagger.tags = ['Saúde']
           #swagger.summary = 'Verificar disponibilidade do banco e da migração'
           #swagger.responses[200] = { description: 'API pronta.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Readiness' } } } }
           #swagger.responses[503] = { description: 'Dependência indisponível; sem detalhes internos.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Unavailable' } } } }
        */
        res.set('Cache-Control', 'no-store');
        try {
            await database.user.count();
            res.json({ data: { status: 'ready' } });
        } catch {
            res.status(503).json({ error: { code: 'UNAVAILABLE', message: 'Serviço temporariamente indisponível.' } });
        }
    });
    return router;
}
