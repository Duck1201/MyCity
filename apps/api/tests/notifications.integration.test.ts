import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { hashPassword } from '../src/modules/identity/password.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco isolado.');
const db = createDatabase(url.href);
const app = createApp(db);
const accounts = [
    { cpf: '00000000071', role: 'CITIZEN' as const, id: randomUUID() },
    { cpf: '00000000072', role: 'CITIZEN' as const, id: randomUUID() },
    { cpf: '00000000073', role: 'MANAGER' as const, id: randomUUID() },
] as const;
const tokens: string[] = [];
beforeAll(async () => {
    for (const user of accounts) {
        const secret = randomUUID();
        await db.user.create({ data: { ...user, password: await hashPassword(secret), loginEnabled: true } });
        const response = await request(app).post('/api/v1/sessions').send({ cpf: user.cpf, password: secret, transport: 'bearer' }).expect(201);
        tokens.push('Bearer ' + response.body.data.token);
    }
});
afterAll(async () => {
    await db.report.deleteMany({ where: { authorId: { in: accounts.map((a) => a.id) } } });
    await db.user.deleteMany({ where: { id: { in: accounts.map((a) => a.id) } } });
    await db.$disconnect();
});
it('entrega caixa vazia ao cidadão e exige sessão e papel', async () => {
    await request(app).get('/api/v1/notifications').expect(401);
    await request(app).get('/api/v1/notifications').set('Authorization', tokens[2]!).expect(403);
    await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', tokens[0]!)
        .expect(200, { data: [], page: { nextCursor: null } });
});

it('avisa apenas o autor em cada mudança e mantém a primeira leitura mesmo após duas aberturas', async () => {
    const report = await db.report.create({ data: { category: 'LEAK', description: 'Vazamento na rua', latitude: -20, longitude: -40, locationSource: 'GPS', authorId: accounts[0].id, clientRequestId: randomUUID(), requestHash: 'a'.repeat(64), showIdentity: false } });
    const change = (targetStatus: string, expectedVersion: number) =>
        request(app)
            .post('/api/v1/reports/' + report.id + '/transitions')
            .set('Authorization', tokens[2]!)
            .send({ targetStatus, expectedVersion });
    await change('UNDER_REVIEW', 1).expect(200);
    await change('IN_PROGRESS', 2).expect(200);
    const list = (index: number, query: Record<string, string> = {}) => request(app).get('/api/v1/notifications').set('Authorization', tokens[index]!).query(query);
    const first = await list(0, { limit: '1' }).expect(200);
    const item = first.body.data[0];
    expect(item).toEqual({ id: expect.any(String), reportId: report.id, reportEventId: expect.any(String), type: 'STATUS_CHANGED', fromStatus: 'UNDER_REVIEW', status: 'IN_PROGRESS', createdAt: expect.any(String), readAt: null });
    const history = await request(app)
        .get('/api/v1/reports/' + report.id + '/history')
        .set('Authorization', tokens[0]!)
        .expect(200);
    const event = history.body.data.find((row: { id: string }) => row.id === item.reportEventId);
    expect(item.createdAt).toBe(event.createdAt);
    const second = await list(0, { limit: '1', cursor: first.body.page.nextCursor }).expect(200);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.data[0].status).toBe('UNDER_REVIEW');
    expect(second.body.page.nextCursor).toBeNull();
    await list(1).expect(200, { data: [], page: { nextCursor: null } });
    await list(1, { cursor: item.id }).expect(400);
    const read = (index: number) =>
        request(app)
            .put('/api/v1/notifications/' + item.id + '/read')
            .set('Authorization', tokens[index]!);
    await read(1).expect(404);
    await read(2).expect(403);
    const reads = await Promise.all([read(0).expect(200), read(0).expect(200)]);
    expect(reads[0]!.body.data.readAt).toEqual(expect.any(String));
    expect(reads[1]!.body.data).toEqual(reads[0]!.body.data);
    expect((await list(0, { unreadOnly: 'true' })).body.data.map((n: { id: string }) => n.id)).toEqual([second.body.data[0].id]);
    expect((await list(0)).body.data[0].readAt).toEqual(reads[0]!.body.data.readAt);
});

it('desfaz etapas, reabre e resolve novamente com histórico causal e avisos correspondentes ao autor', async () => {
    const category = await db.reportCategoryDefinition.create({ data: { name: 'Iluminação ' + randomUUID(), nameKey: randomUUID() } });
    try {
        const record = await db.report.create({ data: { category: category.id, description: 'Iluminação na via', latitude: -20, longitude: -42, locationSource: 'MANUAL', authorId: accounts[0].id, clientRequestId: randomUUID(), requestHash: randomUUID(), showIdentity: false } });
        const base = '/api/v1/reports/' + record.id;
        const requestChange = (targetStatus: string, expectedVersion: number) =>
            request(app)
                .post(base + '/transitions')
                .set('Authorization', tokens[2]!)
                .send({ targetStatus, expectedVersion });
        const list = (scope: string) => request(app).get('/api/v1/reports').query({ scope, category: category.id }).set('Authorization', tokens[0]!);
        const steps = ['UNDER_REVIEW', 'SENT', 'UNDER_REVIEW', 'IN_PROGRESS', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED'];
        for (const [i, target] of steps.entries()) {
            const result = await requestChange(target, i + 1).expect(200);
            expect(result.body.data).toMatchObject({ status: target, version: i + 2 });
        }
        await request(app)
            .put(base + '/confirmation')
            .set('Authorization', tokens[1]!)
            .expect(409);
        expect((await list('resolved').expect(200)).body.data.map((row: { id: string }) => row.id)).toEqual([record.id]);
        const responses = await Promise.all([requestChange('UNDER_REVIEW', 8), requestChange('UNDER_REVIEW', 8)]);
        expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(responses.find((r) => r.status === 409)!.body.error.code).toBe('VERSION_CONFLICT');
        const stillOpen = await list('feed').expect(200);
        expect(stillOpen.body.data).toEqual([expect.objectContaining({ id: record.id, status: 'UNDER_REVIEW' })]);
        expect((await list('resolved').expect(200)).body.data).toEqual([]);
        await request(app)
            .put(base + '/confirmation')
            .set('Authorization', tokens[1]!)
            .expect(200);
        const second = await db.report.create({ data: { category: category.id, description: 'Luminária na praça', latitude: -20, longitude: -42, locationSource: 'MANUAL', authorId: accounts[0].id, clientRequestId: randomUUID(), requestHash: randomUUID(), status: 'IN_PROGRESS', showIdentity: false } });
        await request(app)
            .post('/api/v1/reports/' + second.id + '/transitions')
            .set('Authorization', tokens[2]!)
            .send({ targetStatus: 'RESOLVED', expectedVersion: 1 })
            .expect(200);
        await requestChange('IN_PROGRESS', 9).expect(200);
        await requestChange('RESOLVED', 10).expect(200);
        const history = (
            await request(app)
                .get(base + '/history')
                .set('Authorization', tokens[0]!)
                .expect(200)
        ).body.data as { id: string; fromStatus: string; toStatus: string; createdAt: string }[];
        const expected = [...steps, 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED'];
        expect(history.map((h) => h.toStatus)).toEqual(expected);
        expect(history.map((h) => h.fromStatus)).toEqual(['SENT', ...expected.slice(0, -1)]);
        const notices = (await request(app).get('/api/v1/notifications').query({ limit: 100 }).set('Authorization', tokens[0]!).expect(200)).body.data.filter((n: { reportId: string }) => n.reportId === record.id);
        expect(notices).toEqual([...history].reverse().map((h) => expect.objectContaining({ reportEventId: h.id, fromStatus: h.fromStatus, status: h.toStatus, createdAt: h.createdAt })));
        expect((await list('resolved').expect(200)).body.data).toEqual([expect.objectContaining({ id: record.id, status: 'RESOLVED', confirmationCount: 1 }), expect.objectContaining({ id: second.id, status: 'RESOLVED' })]);
    } finally {
        await db.report.deleteMany({ where: { category: category.id } });
        await db.reportCategoryDefinition.delete({ where: { id: category.id } });
    }
});
