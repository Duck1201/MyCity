import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import { createDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/modules/identity/password.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', '127.0.0.1', 'test-db'].includes(url.hostname)) throw new Error('Use o banco isolado.');
const database = createDatabase(url.href);
const cpf = '00000000078';
const password = 'http-cache-test-only';
const origin = 'https://demo.example';
const app = createApp(database, { webOrigin: origin });
const web = { Origin: origin, 'X-MyCity-Client': 'web' };
const signIn = async () => {
    const response = await request(app).post('/api/v1/sessions').set(web).send({ cpf, password, transport: 'cookie' }).expect(201);
    expect(response.headers['cache-control']).toBe('no-store');
    return response.get('set-cookie')![0]!.split(';')[0]!;
};
beforeAll(async () => {
    await database.user.create({ data: { cpf, loginEnabled: true, password: await hashPassword(password), role: 'CITIZEN' } });
});
afterAll(async () => {
    await database.user.deleteMany({ where: { cpf } });
    await database.$disconnect();
});

it('revalida as leituras autenticadas com ETag e responde 304 quando nada mudou', async () => {
    const cookie = await signIn();
    // Only reads that depend on this user alone: other suites write reports and categories in parallel.
    for (const path of ['/api/v1/me', '/api/v1/notifications']) {
        const first = await request(app).get(path).set('Cookie', cookie).expect(200);
        expect(first.headers['cache-control']).toBe('private, no-cache');
        expect(first.headers.etag).toBeTruthy();
        expect(first.headers['x-mycity-server-time']).toMatch(/^\d{13}$/);
        const again = await request(app).get(path).set('Cookie', cookie).set('If-None-Match', first.headers.etag!).expect(304);
        expect(again.text ?? '').toBe('');
        expect(Number(again.headers['x-mycity-server-time'])).toBeGreaterThanOrEqual(Number(first.headers['x-mycity-server-time']));
        await request(app).get(path).set('Cookie', cookie).set('If-None-Match', 'W/"outro"').expect(200);
    }
});

it('mantém o ETag para o app sem deixar o cache HTTP do aparelho guardar a resposta', async () => {
    const login = await request(app).post('/api/v1/sessions').send({ cpf, password, transport: 'bearer' }).expect(201);
    const bearer = 'Bearer ' + login.body.data.token;
    const first = await request(app).get('/api/v1/me').set('Authorization', bearer).expect(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.headers.etag).toBeTruthy();
    const again = await request(app).get('/api/v1/me').set('Authorization', bearer).set('If-None-Match', first.headers.etag!).expect(304);
    expect(again.headers['cache-control']).toBe('no-store');
});

it('não guarda escritas nem erros no cache do navegador', async () => {
    const cookie = await signIn();
    const missing = await request(app)
        .get('/api/v1/reports/' + randomUUID())
        .set('Cookie', cookie)
        .expect(404);
    expect(missing.headers['cache-control']).toBe('no-store');
    const invalid = await request(app).get('/api/v1/reports?scope=mine&limit=0').set('Cookie', cookie).expect(400);
    expect(invalid.headers['cache-control']).toBe('no-store');
    const anonymous = await request(app).get('/api/v1/me').expect(401);
    expect(anonymous.headers['cache-control']).toBe('no-store');
});

it('apaga o cache do navegador ao sair e quando uma sessão apresentada não vale mais', async () => {
    const cookie = await signIn();
    const logout = await request(app).delete('/api/v1/sessions/current').set('Cookie', cookie).set(web).expect(204);
    expect(logout.headers['clear-site-data']).toBe('"cache"');
    expect(logout.headers['cache-control']).toBe('no-store');
    const expired = await request(app).get('/api/v1/reports/overview').set('Cookie', cookie).expect(401);
    expect(expired.headers['clear-site-data']).toBe('"cache"');
    // Someone who never signed in has nothing to clear; keep the static assets cached.
    const anonymous = await request(app).get('/api/v1/me').expect(401);
    expect(anonymous.headers['clear-site-data']).toBeUndefined();
    const wrongPassword = await request(app).post('/api/v1/sessions').set(web).send({ cpf, password: 'errada', transport: 'cookie' }).expect(401);
    expect(wrongPassword.headers['clear-site-data']).toBeUndefined();
});
