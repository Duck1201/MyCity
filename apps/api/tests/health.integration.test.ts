import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';

const database = createDatabase(process.env.DATABASE_URL!);
const app = createApp(database);
const unavailable = createDatabase('postgresql://test:test@127.0.0.1:1/mycity_test');
const offlineApp = createApp(unavailable);

afterAll(async () => {
    await Promise.all([database.$disconnect(), unavailable.$disconnect()]);
});

describe('saúde da API por HTTP e PostgreSQL real', () => {
    it('informa readiness quando banco e migrações estão disponíveis', async () => {
        const response = await request(app).get('/api/v1/health/ready');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ data: { status: 'ready' } });
    });

    it('mantém liveness quando o banco está indisponível', async () => {
        const response = await request(offlineApp).get('/api/v1/health/live');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ data: { status: 'alive' } });
    });

    it('retorna 503 sem expor credenciais ou stack quando banco falha', async () => {
        const response = await request(offlineApp).get('/api/v1/health/ready');
        expect(response.status).toBe(503);
        expect(response.body).toEqual({
            error: {
                code: 'UNAVAILABLE',
                message: 'Serviço temporariamente indisponível.',
            },
        });
    });

    it('responde em JSON a uma rota desconhecida', async () => {
        const response = await request(app).get('/api/v1/unknown');
        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
    });
});
