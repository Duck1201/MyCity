import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ReportStatus } from '@mycity/contracts';
import { createDatabase } from '../src/database.js';
import { createReportsRouter } from '../src/modules/reports/index.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', '127.0.0.1', 'test-db'].includes(url.hostname)) throw new Error('Use o banco de teste isolado.');
const db = createDatabase(url.href);
const author = { id: randomUUID(), role: 'CITIZEN' as const };
const other = { id: randomUUID(), role: 'CITIZEN' as const };
const manager = { id: randomUUID(), role: 'MANAGER' as const };
const app = (actor: typeof author | typeof manager) =>
    express()
        .use((_req, res, next) => {
            res.locals.user = actor;
            next();
        })
        .use('/reports', createReportsRouter(db, 'unused'));
const day = (day: number) => new Date(Date.UTC(2035, 0, day));
const states: ReportStatus[] = ['SENT', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELED'];
const ids = Object.fromEntries(states.map((s) => [s, randomUUID()])) as Record<ReportStatus, string>;
beforeAll(async () => {
    await db.user.createMany({ data: [author, other, manager].map((actor, index) => ({ ...actor, cpf: '0000000030' + index, password: 'unused' })) });
    await db.report.createMany({ data: states.map((status, i) => ({ status, id: ids[status], authorId: author.id, category: 'DEBRIS', latitude: -20 - i, longitude: -41, locationSource: 'GPS', description: 'Entulho', showIdentity: false, requestHash: 'a'.repeat(64), clientRequestId: randomUUID(), createdAt: day(i + 1) })) });
});
afterAll(async () => {
    await db.report.deleteMany({ where: { authorId: author.id } });
    await db.user.deleteMany({ where: { id: { in: [author.id, other.id, manager.id] } } });
    await db.$disconnect();
});

it('pagina o feed e os marcadores dentro da área, filtrando categoria e estado antes da paginação', async () => {
    const feed = await request(app(other)).get('/reports').query({ scope: 'feed', category: 'DEBRIS', limit: 2 }).expect(200);
    expect(feed.body.data.map((r: { id: string }) => r.id)).toEqual([ids.IN_PROGRESS, ids.UNDER_REVIEW]);
    const last = await request(app(other)).get('/reports').query({ scope: 'feed', category: 'DEBRIS', limit: 2, cursor: feed.body.page.nextCursor }).expect(200);
    expect(last.body.data.map((r: { id: string }) => r.id)).toEqual([ids.SENT]);
    expect(last.body.page.nextCursor).toBeNull();
    const map = await request(app(other)).get('/reports/map').query({ bbox: '-41,-21,-40,-20', category: 'DEBRIS', limit: '1' }).expect(200);
    expect(map.body.data).toEqual([{ id: ids.UNDER_REVIEW, latitude: -21, longitude: -41, status: 'UNDER_REVIEW', category: 'DEBRIS', categoryName: 'Entulho irregular', confirmationCount: 0 }]);
    const next = await request(app(other)).get('/reports/map').query({ bbox: '-41,-21,-40,-20', category: 'DEBRIS', limit: '1', cursor: map.body.page.nextCursor }).expect(200);
    expect(next.body.data[0].id).toBe(ids.SENT);
    await request(app(other)).get('/reports/map?bbox=0,0, ,1').expect(400);
    await request(app(other)).get('/reports/map?bbox=10,0,1,50').expect(400);
    await request(app(other)).get('/reports/map?bbox=1,1,2,95').expect(400);
    await request(app(other))
        .get('/reports/map?status=CANCELED')
        .expect(200, { data: [], page: { nextCursor: null } });
    await request(app(other)).get('/reports').query({ scope: 'feed', cursor: ids.CANCELED }).expect(400);
});

it('disponibiliza o detalhe e o histórico dos estados visíveis e mantém o cancelado privado', async () => {
    for (const status of states) {
        const id = ids[status];
        const detail = await request(app(other))
            .get('/reports/' + id)
            .expect(status === 'CANCELED' ? 404 : 200);
        if (status !== 'CANCELED') {
            expect(detail.body.data.author).toBeUndefined();
            expect(detail.body.data.allowedActions).toEqual(['SENT', 'UNDER_REVIEW', 'IN_PROGRESS'].includes(status) ? ['CONFIRM'] : []);
        }
        await request(app(other))
            .get('/reports/' + id + '/history')
            .expect(status === 'CANCELED' ? 404 : 200);
        await request(app(manager))
            .get('/reports/' + id)
            .expect(200);
        const own = await request(app(author))
            .get('/reports/' + id)
            .expect(200);
        expect(own.body.data.allowedActions).toEqual(['SENT', 'UNDER_REVIEW'].includes(status) ? ['CANCEL'] : []);
    }
    const resolved = await request(app(other)).get('/reports').query({ scope: 'feed', category: 'DEBRIS', status: 'RESOLVED' }).expect(200);
    expect(resolved.body.data.map((r: { id: string }) => r.id)).toEqual([ids.RESOLVED]);
    for (const status of ['REJECTED', 'CANCELED']) {
        await request(app(other))
            .get('/reports')
            .query({ scope: 'feed', category: 'DEBRIS', status })
            .expect(200, { data: [], page: { nextCursor: null } });
    }
    const mine = await request(app(author)).get('/reports').query({ scope: 'mine', category: 'DEBRIS' }).expect(200);
    expect(mine.body.data.map((r: { id: string }) => r.id)).toEqual([...states].reverse().map((status) => ids[status]));
});
it('prioriza confirmações nos pendentes, desempata pela mais antiga e conta todos os estados sem paginar', async () => {
    await db.reportConfirmation.create({ data: { userId: other.id, reportId: ids.IN_PROGRESS } });
    const result = await request(app(manager)).get('/reports').query({ scope: 'management', category: 'DEBRIS', limit: 2 }).expect(200);
    expect(result.body.data.map((r: { id: string }) => r.id)).toEqual([ids.IN_PROGRESS, ids.SENT]);
    const next = await request(app(manager)).get('/reports').query({ scope: 'management', category: 'DEBRIS', limit: 2, cursor: result.body.page.nextCursor }).expect(200);
    expect(next.body.data.map((r: { id: string }) => r.id)).toEqual([ids.UNDER_REVIEW, ids.CANCELED]);
    expect(result.body.data[0]).toMatchObject({ confirmationCount: 1, confirmedByMe: false });
    const personal = await request(app(other))
        .get('/reports/' + ids.IN_PROGRESS)
        .expect(200);
    expect(personal.body.data).toMatchObject({ confirmationCount: 1, confirmedByMe: true, allowedActions: ['WITHDRAW'] });
    const summary = await request(app(manager)).get('/reports/summary?category=DEBRIS').expect(200);
    expect(summary.body.data).toEqual(Object.fromEntries(states.map((s) => [s, 1])));
    await request(app(other)).get('/reports/summary').expect(403);
    await request(app(manager)).get('/reports/summary?limit=1').expect(400);
});
it('ordena o histórico de resolvidas pela resolução mesmo quando a criação mais antiga terminou depois', async ({ onTestFinished }) => {
    const additional = await db.report.create({ data: { authorId: author.id, category: 'DEBRIS', latitude: 0, longitude: 0, status: 'RESOLVED', locationSource: 'GPS', description: 'Entulho antigo', showIdentity: false, requestHash: 'a'.repeat(64), createdAt: day(1), clientRequestId: randomUUID() } });
    onTestFinished(async () => {
        await db.report.delete({ where: { id: additional.id } });
    });
    await db.reportEvent.createMany({
        data: [
            { reportId: ids.RESOLVED, createdAt: day(7) },
            { reportId: additional.id, createdAt: day(8) },
        ].map((r) => ({ ...r, actorId: manager.id, type: 'STATUS_CHANGED', fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED' })),
    });
    const page = await request(app(other)).get('/reports').query({ scope: 'resolved', category: 'DEBRIS', limit: 1 }).expect(200);
    expect(page.body.data[0].id).toBe(additional.id);
    const next = await request(app(other)).get('/reports').query({ scope: 'resolved', category: 'DEBRIS', limit: 1, cursor: page.body.page.nextCursor }).expect(200);
    expect(next.body.data[0].id).toBe(ids.RESOLVED);
    expect(next.body.page.nextCursor).toBeNull();
});

it('consulta a fila e exporta todos os resultados da mesma busca, período e ordenação', async () => {
    const filters = { category: 'DEBRIS', q: 'entulho -41', status: 'pending', de: '2034-12-31', ate: '2035-01-02', ordem: 'recentes' };
    const list = await request(app(manager))
        .get('/reports/queue')
        .query({ ...filters, limit: 1, pagina: 2 })
        .expect(200);
    expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([ids.UNDER_REVIEW]);
    expect(list.body).toMatchObject({ total: 3, page: 2, counts: { SENT: 1, IN_PROGRESS: 1, UNDER_REVIEW: 1, RESOLVED: 0 } });
    const csv = await request(app(manager))
        .get('/reports/queue.csv')
        .query(filters)
        .expect('Content-Type', /text\/csv/)
        .expect(200);
    expect(
        csv.text
            .split('\r\n')
            .slice(1)
            .map((line) => line.split(';')[0]),
    ).toEqual([ids.IN_PROGRESS, ids.UNDER_REVIEW, ids.SENT].map((id) => '"' + id + '"'));
    const matched = await request(app(manager)).get('/reports/queue').query({ q: ids.SENT }).expect(200);
    expect(matched.body.total).toBe(1);
    for (const endpoint of ['queue', 'queue.csv']) {
        await request(app(other))
            .get('/reports/' + endpoint)
            .expect(403);
        await request(app(manager))
            .get('/reports/' + endpoint)
            .query({ de: '2035-02-31' })
            .expect(400);
        await request(app(manager))
            .get('/reports/' + endpoint)
            .query({ de: '2035-02-02', ate: '2035-02-01' })
            .expect(400);
    }
});
