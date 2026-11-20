import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import { createDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/modules/identity/password.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', '127.0.0.1', 'test-db'].includes(url.hostname)) throw new Error('Use o banco isolado.');
const database = createDatabase(url.href);
const cpf = '00000000079';
const password = 'session-test-only';
const origin = 'https://demo.example';
const app = createApp(database, { webOrigin: origin });
const login = (transport: string) => request(app).post('/api/v1/sessions').send({ cpf, password, transport });
beforeAll(async () => {
    await database.user.create({ data: { cpf, loginEnabled: true, password: await hashPassword(password), role: 'CITIZEN' } });
});
afterAll(async () => {
    await database.user.deleteMany({ where: { cpf } });
    await database.$disconnect();
});
it('entrega token Android, expira após 24 horas e revoga ao sair', async () => {
    const start = Date.now();
    const response = await login('bearer').expect(201);
    const { user, token, expiresAt } = response.body.data;
    expect(user).toEqual({ id: expect.any(String), role: 'CITIZEN' });
    expect(Date.parse(expiresAt)).toBeGreaterThanOrEqual(start + 86400000);
    expect(Date.parse(expiresAt)).toBeLessThanOrEqual(Date.now() + 86400000);
    const auth = { Authorization: 'Bearer ' + token };
    await request(app).get('/api/v1/me').set(auth).expect('X-Session-Expires-At', expiresAt).expect(200, { data: user });
    await request(app).delete('/api/v1/sessions/current').set(auth).expect(204);
    await request(app).get('/api/v1/me').set(auth).expect(401);
    const next = await login('bearer').expect(201);
    await database.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
    await request(app)
        .get('/api/v1/me')
        .set('Authorization', 'Bearer ' + next.body.data.token)
        .expect(401);
});
it('uma sessão só continua válida para a credencial que autorizou sua emissão', async () => {
    const response = await login('bearer').expect(201);
    const original = await database.user.findUniqueOrThrow({ where: { cpf } });
    try {
        await database.user.update({ where: { cpf }, data: { password: await hashPassword('nova-credencial-local') } });
        await request(app)
            .get('/api/v1/me')
            .set('Authorization', 'Bearer ' + response.body.data.token)
            .expect(401);
    } finally {
        await database.user.update({ where: { cpf }, data: { password: original.password } });
    }
});
it('exige rotação explícita antes de habilitar credenciais antigas', async () => {
    await database.user.update({ where: { cpf }, data: { loginEnabled: false } });
    try {
        await login('bearer').expect(401);
    } finally {
        await database.user.update({ where: { cpf }, data: { loginEnabled: true } });
    }
});
it('restringe cookie à origem web e impede troca de transporte', async () => {
    await login('cookie').expect(403);
    const result = await login('cookie').set('Origin', origin).set('X-MyCity-Client', 'web').expect(201);
    const cookie = result.get('set-cookie')![0]!;
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(cookie).toContain(flag);
    expect(result.body.data.token).toBeUndefined();
    const pair = cookie.split(';')[0]!;
    await request(app).get('/api/v1/me').set('Cookie', pair).expect(200);
    await request(app)
        .get('/api/v1/me')
        .set('Authorization', 'Bearer ' + pair.split('=')[1])
        .expect(401);
    await request(app).delete('/api/v1/sessions/current').set('Cookie', pair).set('Origin', 'https://outro.example').set('X-MyCity-Client', 'web').expect(403);
    await request(app).delete('/api/v1/sessions/current').set('Cookie', pair).set('Origin', origin).set('X-MyCity-Client', 'web').expect(204);
    await request(app).get('/api/v1/me').set('Cookie', pair).expect(401);
});
it('contém tentativas repetidas antes de verificar outra senha', async () => {
    const limited = createApp(database, { webOrigin: origin });
    for (let i = 0; i < 5; i++) await request(limited).post('/api/v1/sessions').send({ cpf, password: 'errada', transport: 'bearer' }).expect(401);
    const res = await request(limited).post('/api/v1/sessions').send({ cpf, password, transport: 'bearer' }).expect(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
});
