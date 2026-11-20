import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/modules/identity/password.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', '127.0.0.1', 'test-db'].includes(url.hostname)) throw Error('Use o banco isolado.');
const db = createDatabase(url.href);
const app = createApp(db);
const cpf = '00000000854';
let auth: string;
let userId: string;
beforeAll(async () => {
    const password = randomUUID();
    const user = await db.user.create({ data: { cpf, password: await hashPassword(password), role: 'CITIZEN', loginEnabled: true } });
    userId = user.id;
    const login = await request(app).post('/api/v1/sessions').send({ cpf, password, transport: 'bearer' }).expect(201);
    auth = 'Bearer ' + login.body.data.token;
});
afterAll(async () => {
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
});
const root = '/api/v1/weather-alerts';
it('exige sessão antes de consultar lista ou detalhe', async () => {
    for (const path of [root, root + '/demo-flood']) await request(app).get(path).expect(401);
});
it('oferece três cenários fixos por gravidade e mantém os avisos pessoais separados', async () => {
    const get = (path: string) => request(app).get(path).set('Authorization', auth);
    const list = await get(root).expect(200);
    expect(list.body.page.nextCursor).toBeNull();
    expect(list.body.data.map((a: { level: string }) => a.level)).toEqual(['EMERGENCY', 'ALERT', 'ATTENTION']);
    const scenarioTime = Date.parse('2026-11-25T15:00:00Z');
    for (const item of list.body.data) {
        expect(item).toEqual({ id: expect.any(String), title: expect.any(String), message: expect.any(String), regionLabel: expect.any(String), level: expect.any(String), issuedAt: expect.any(String), expiresAt: expect.any(String), simulated: true });
        expect(Date.parse(item.issuedAt)).toBeLessThanOrEqual(scenarioTime);
        expect(Date.parse(item.expiresAt)).toBeGreaterThan(scenarioTime);
        await get(root + '/' + item.id).expect(200, { data: item });
    }
    await get('/api/v1/notifications').expect(200, { data: [], page: { nextCursor: null } });
    await get(root).expect(200, list.body);
});
it('pagina sem repetir cenários e distingue cursor inválido de ID ausente', async () => {
    const get = (path: string) => request(app).get(path).set('Authorization', auth);
    const first = await get(root + '?limit=2').expect(200);
    expect(first.body.data).toHaveLength(2);
    const last = await get(root + '?cursor=' + first.body.page.nextCursor + '&limit=2').expect(200);
    expect(last.body.data).toHaveLength(1);
    expect(last.body.data[0].level).toBe('ATTENTION');
    expect(last.body.page.nextCursor).toBeNull();
    await get(root + '?cursor=' + last.body.data[0].id).expect(200, { data: [], page: { nextCursor: null } });
    for (const query of ['cursor=desconhecido', 'limit=0', 'limit=101', 'region=Centro']) await get(root + '?' + query).expect(400);
    await get(root + '/desconhecido').expect(404);
    await request(app).post(root).set('Authorization', auth).send({ level: 'ALERT' }).expect(404);
});
