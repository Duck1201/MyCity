import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/modules/identity/password.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco isolado.');
const db = createDatabase(url.href);
const dir = await mkdtemp(join(tmpdir(), 'mycity-first-report-'));
const origin = 'https://demo.example';
const app = createApp(db, { uploadDir: dir, webOrigin: origin });
const citizen = { id: randomUUID(), cpf: '00000000075', role: 'CITIZEN' as const };
const neighbor = { id: randomUUID(), cpf: '00000000788', role: 'CITIZEN' as const };
const manager = { id: randomUUID(), cpf: '00000000076', role: 'MANAGER' as const };
const password = 'test-only-credential';
const category = randomUUID();
beforeAll(async () => {
    await db.reportCategoryDefinition.create({ data: { id: category, name: 'Iluminação de teste ' + category, nameKey: category } });
    for (const account of [citizen, neighbor, manager]) await db.user.create({ data: { ...account, loginEnabled: true, password: await hashPassword(password + account.role) } });
});
afterAll(async () => {
    await db.report.deleteMany({ where: { authorId: citizen.id } });
    await db.reportCategoryDefinition.deleteMany({ where: { id: category } });
    await db.user.deleteMany({ where: { id: { in: [citizen.id, neighbor.id, manager.id] } } });
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true });
});
it('publica via sessão Android e recupera pela sessão web, com foto privada e reenvio único', async () => {
    const mobile = await request(app)
        .post('/api/v1/sessions')
        .send({ cpf: citizen.cpf, password: password + citizen.role, transport: 'bearer' })
        .expect(201);
    const web = await request(app)
        .post('/api/v1/sessions')
        .set('Origin', origin)
        .set('X-MyCity-Client', 'web')
        .send({ cpf: manager.cpf, password: password + manager.role, transport: 'cookie' })
        .expect(201);
    const cookie = web.get('set-cookie')![0]!.split(';')[0]!;
    const auth = { Authorization: 'Bearer ' + mobile.body.data.token };
    const metadata = { clientRequestId: randomUUID(), category, description: 'Iluminação na praça', location: { source: 'MANUAL', latitude: -20, longitude: -40 }, showIdentity: false };
    const jpeg = await sharp({ create: { width: 16, height: 12, channels: 3, background: 'blue' } })
        .jpeg()
        .toBuffer();
    const upload = () => request(app).post('/api/v1/reports').set(auth).field('metadata', JSON.stringify(metadata)).attach('photos', jpeg, 'foto.jpg');
    await request(app).post('/api/v1/reports').attach('photos', jpeg, 'foto.jpg').expect(401);
    await request(app).post('/api/v1/reports').set('Cookie', cookie).set('Origin', origin).set('X-MyCity-Client', 'web').attach('photos', jpeg, 'foto.jpg').expect(403);
    const anotherSession = await request(app)
        .post('/api/v1/sessions')
        .send({ cpf: citizen.cpf, password: password + citizen.role, transport: 'bearer' })
        .expect(201);
    const revoked = 'Bearer ' + anotherSession.body.data.token;
    await request(app).delete('/api/v1/sessions/current').set('Authorization', revoked).expect(204);
    for (const authorization of ['Bearer invalid', revoked]) {
        await request(app).post('/api/v1/reports').set('Authorization', authorization).field('metadata', JSON.stringify(metadata)).attach('photos', jpeg, 'foto.jpg').expect(401);
    }
    expect(await db.report.count({ where: { authorId: citizen.id } })).toBe(0);
    expect(await readdir(dir)).toEqual([]);
    await request(app).get('/api/v1/reports?scope=management').set(auth).expect(403);
    const results = await Promise.all([upload(), upload()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    const report = results[0]!.body.data;
    expect(results[1]!.body.data.id).toBe(report.id);
    const page = await request(app).get('/api/v1/reports').query({ scope: 'management', category }).set('Cookie', cookie).expect(200);
    expect(page.body.data.map((row: { id: string }) => row.id)).toEqual([report.id]);
    expect(await db.report.count({ where: { authorId: citizen.id, clientRequestId: metadata.clientRequestId } })).toBe(1);
    const detail = await request(app)
        .get('/api/v1/reports/' + report.id)
        .set('Cookie', cookie)
        .expect(200);
    expect(detail.body.data).toMatchObject({ description: metadata.description, location: metadata.location, status: 'SENT' });
    expect(detail.body.data.author).toBeUndefined();
    const path = detail.body.data.photos[0].contentPath;
    await request(app).get(path).expect(401);
    await request(app)
        .get(path)
        .set('Cookie', cookie)
        .expect('Content-Type', /image\/jpeg/)
        .expect(200);
    const neighborSession = await request(app)
        .post('/api/v1/sessions')
        .send({ cpf: neighbor.cpf, password: password + neighbor.role, transport: 'bearer' })
        .expect(201);
    const voterAuth = { Authorization: 'Bearer ' + neighborSession.body.data.token };
    const confirmUrl = '/api/v1/reports/' + report.id + '/confirmation';
    for (const operation of ['put', 'put', 'delete'] as const) {
        const confirmed = operation === 'put';
        const vote = await request(app)[operation](confirmUrl).set(voterAuth).expect(200);
        expect(vote.body.data).toMatchObject({ confirmed, confirmationCount: Number(confirmed) });
        const management = await request(app).get('/api/v1/reports').query({ scope: 'management', category }).set('Cookie', cookie).expect(200);
        expect(management.body.data).toContainEqual(expect.objectContaining({ id: report.id, confirmationCount: Number(confirmed) }));
    }
    const base = '/api/v1/reports/' + report.id;
    const canceled = await request(app)
        .post(base + '/cancellation')
        .set(auth)
        .send({ expectedVersion: report.version })
        .expect(200);
    await request(app).get(path).set(voterAuth).expect(404);
    await request(app)
        .post(base + '/transitions')
        .set('Cookie', cookie)
        .set('Origin', origin)
        .set('X-MyCity-Client', 'web')
        .send({ targetStatus: 'UNDER_REVIEW', expectedVersion: canceled.body.data.version })
        .expect(404);
    await request(app)
        .post(base + '/reopening')
        .set(auth)
        .send({ expectedVersion: canceled.body.data.version })
        .expect(200);
    const reopened = await request(app).get(base).set(voterAuth).expect(200);
    expect(reopened.body.data.status).toBe('SENT');
    expect(reopened.body.data.author).toBeUndefined();
    expect(reopened.body.data.photos[0].contentPath).toBe(path);
    await request(app)
        .get(path)
        .set(voterAuth)
        .expect('Content-Type', /image\/jpeg/)
        .expect(200);
    await db.session.updateMany({ where: { userId: citizen.id }, data: { expiresAt: new Date(0) } });
    await upload().expect(401);
});
