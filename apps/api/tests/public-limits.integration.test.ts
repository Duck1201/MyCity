import { afterAll, afterEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';

const database = createDatabase(process.env.DATABASE_URL!);
afterAll(() => database.$disconnect());
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

it('limita readiness antes de consultar o banco e isola origem, rota e janela', async () => {
    const count = vi.spyOn(database.user, 'count');
    vi.useFakeTimers({ toFake: ['Date'] });
    const app = createApp(database, { proxyHops: 2 });
    const ready = (client: string) =>
        request(app)
            .get('/api/v1/health/ready')
            .set('X-Forwarded-For', client + ', 192.0.2.10');
    for (let i = 0; i < 30; i++) await ready('192.0.2.1').expect(200);
    const blocked = await ready('192.0.2.1').expect(429);
    expect(blocked.headers['retry-after']).toBe('60');
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(count).toHaveBeenCalledTimes(30);
    await ready('192.0.2.2').expect(200);
    await request(app).get('/api/v1/health/live').set('X-Forwarded-For', '192.0.2.1, 192.0.2.10').expect(200);
    vi.advanceTimersByTime(59_001);
    await ready('192.0.2.1').expect('Retry-After', '1').expect(429);
    vi.advanceTimersByTime(999);
    await ready('192.0.2.1').expect(200);
});

it('inclui HEAD na cota de liveness e usa o IP do socket em acesso direto', async () => {
    const app = createApp(database);
    for (let i = 0; i < 60; i++) await request(app).get('/api/v1/health/live').expect(200);
    await request(app).head('/api/v1/health/live').set('X-Forwarded-For', '192.0.2.1').expect(429);
});

it('limita o login antes da análise do JSON', async () => {
    const app = createApp(database);
    const malformed = () => request(app).post('/api/v1/sessions').set('Content-Type', 'application/json').send('{');
    for (let i = 0; i < 30; i++) await malformed().expect(400);
    await malformed().expect(429);
});

it('soma o schema, a interface e seus assets na mesma cota', async () => {
    const app = createApp(database, { environment: 'development', enableDocs: true });
    await request(app).get('/api/docs/').expect(200);
    await request(app).get('/api/docs/swagger-ui.css').expect(200);
    for (let i = 2; i < 120; i++) await request(app).head('/api/openapi.json').expect(200);
    await request(app).get('/api/docs/swagger-ui-init.js').expect(429);
});
