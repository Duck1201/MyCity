import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createDatabase } from '../src/database.js';
import { createReportsRouter } from '../src/modules/reports/index.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco local de teste.');
const db = createDatabase(url.toString());
const citizen = { id: randomUUID(), role: 'CITIZEN' as const };
const manager = { id: randomUUID(), role: 'MANAGER' as const };
const other = { id: randomUUID(), role: 'CITIZEN' as const };
function app(actor: typeof citizen | typeof manager) {
    return express()
        .use((_req, res, next) => {
            res.locals.user = actor;
            next();
        })
        .use('/reports', createReportsRouter(db, 'unused'));
}
async function fixture(authorId = citizen.id) {
    return db.report.create({ data: { authorId, clientRequestId: randomUUID(), requestHash: 'a'.repeat(64), category: 'TREE', description: 'Galho na calçada', latitude: 0, longitude: 0, locationSource: 'GPS', showIdentity: false, events: { create: { actorId: authorId, type: 'CREATED', toStatus: 'SENT' } } } });
}
beforeAll(async () => {
    await db.user.createMany({
        data: [
            { ...citizen, cpf: '00000000091' },
            { ...manager, cpf: '00000000092' },
            { ...other, cpf: '00000000093' },
        ].map((u) => ({ ...u, password: 'unused' })),
    });
});
afterAll(async () => {
    await db.report.deleteMany({ where: { authorId: { in: [citizen.id, other.id] } } });
    await db.user.deleteMany({ where: { id: { in: [citizen.id, manager.id, other.id] } } });
    await db.$disconnect();
});

it('inicia atendimento, registra o histórico e avisa somente o autor', async () => {
    const report = await fixture();
    const result = await request(app(manager))
        .post('/reports/' + report.id + '/transitions')
        .send({ targetStatus: 'UNDER_REVIEW', expectedVersion: 1 })
        .expect(200);
    expect(result.body.data).toMatchObject({ id: report.id, status: 'UNDER_REVIEW', version: 2 });
    const history = await request(app(citizen))
        .get('/reports/' + report.id + '/history')
        .expect(200);
    expect(history.body.data).toEqual([expect.objectContaining({ type: 'CREATED', actorRole: 'CITIZEN', toStatus: 'SENT' }), expect.objectContaining({ type: 'STATUS_CHANGED', actorRole: 'MANAGER', fromStatus: 'SENT', toStatus: 'UNDER_REVIEW' })]);
    expect(JSON.stringify(history.body)).not.toContain(citizen.id);
    const notifications = await db.notification.findMany({ where: { reportId: report.id } });
    expect(notifications).toEqual([expect.objectContaining({ eventId: history.body.data[1].id, recipientId: citizen.id, status: 'UNDER_REVIEW', readAt: null })]);
});
it('limita a listagem de minhas denúncias ao autor com paginação', async () => {
    const a = await fixture(),
        b = await fixture(),
        foreign = await fixture(other.id);
    await db.report.update({ where: { id: a.id }, data: { createdAt: new Date('2099-01-01') } });
    await db.report.update({ where: { id: b.id }, data: { createdAt: new Date('2099-01-02') } });
    const first = await request(app(citizen)).get('/reports?scope=mine&limit=1').expect(200);
    expect(first.body.data[0].id).toBe(b.id);
    const next = await request(app(citizen))
        .get('/reports?scope=mine&limit=1&cursor=' + first.body.page.nextCursor)
        .expect(200);
    expect(next.body.data[0].id).toBe(a.id);
    await request(app(citizen))
        .get('/reports?scope=mine&cursor=' + foreign.id)
        .expect(400);
    await request(app(other))
        .get('/reports?scope=mine&authorId=' + citizen.id)
        .expect(400);
});

it.each(['RESOLVED', 'REJECTED', 'CANCELED'] as const)('publica resposta idempotente em %s sem alterar versão ou emitir aviso', async (status) => {
    const report = await fixture();
    await db.report.update({ where: { id: report.id }, data: { status, version: 4 } });
    const url = '/reports/' + report.id + '/replies';
    const body = { text: '  ' + 'x'.repeat(2000) + '  ', clientRequestId: randomUUID() };
    const replies = await Promise.all([request(app(manager)).post(url).send(body), request(app(manager)).post(url).send(body)]);
    expect(replies.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(replies[0]!.body.data).toEqual(replies[1]!.body.data);
    expect(replies[0]!.body.data).toMatchObject({ type: 'REPLY', actorRole: 'MANAGER', text: body.text.trim() });
    await request(app(manager))
        .post(url)
        .send({ ...body, text: 'Diferente' })
        .expect(409);
    await request(app(citizen)).post(url).send(body).expect(403);
    await request(app(manager))
        .post(url)
        .send({ ...body, text: '  ' })
        .expect(422);
    await request(app(manager))
        .post(url)
        .send({ ...body, text: 'x'.repeat(2001) })
        .expect(422);
    expect(await db.notification.count({ where: { reportId: report.id } })).toBe(0);
    const detail = await request(app(manager))
        .get('/reports/' + report.id)
        .expect(200);
    expect(detail.body.data).toMatchObject({ status, version: 4, allowedActions: ['UNDER_REVIEW', 'REPLY'] });
    await request(app(other))
        .get('/reports/' + report.id + '/history')
        .expect(status === 'CANCELED' ? 404 : 200);
});

it('recusa salto e avanço por cidadão, e serializa conflitos sem duplicar efeitos', async () => {
    const report = await fixture();
    const url = '/reports/' + report.id + '/transitions';
    const input = { targetStatus: 'UNDER_REVIEW', expectedVersion: 1 };
    await request(app(citizen)).post(url).send(input).expect(403);
    const jump = await request(app(manager))
        .post(url)
        .send({ ...input, targetStatus: 'RESOLVED' })
        .expect(409);
    expect(jump.body.error.code).toBe('INVALID_TRANSITION');
    const concurrent = await Promise.all([request(app(manager)).post(url).send(input), request(app(manager)).post(url).send(input)]);
    expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(concurrent.find((r) => r.status === 409)!.body.error.code).toBe('VERSION_CONFLICT');
    const reject = { expectedVersion: 2, targetStatus: 'REJECTED' };
    for (const reason of ['', '  ', 'X'.repeat(2001)])
        await request(app(manager))
            .post(url)
            .send({ ...reject, reason })
            .expect(422);
    await request(app(manager))
        .post(url)
        .send({ ...reject, reason: '   Fora da competência municipal. ' })
        .expect(200);
    const mine = await request(app(citizen))
        .get('/reports/' + report.id)
        .expect(200);
    expect(mine.body.data).toMatchObject({ status: 'REJECTED', version: 3, allowedActions: [], rejectionReason: 'Fora da competência municipal.' });
    const managed = await request(app(manager))
        .get('/reports/' + report.id)
        .expect(200);
    expect(managed.body.data.rejectionReason).toBe('Fora da competência municipal.');
    const history = await request(app(citizen))
        .get('/reports/' + report.id + '/history?limit=2')
        .expect(200);
    const rest = await request(app(citizen))
        .get('/reports/' + report.id + '/history?limit=1&cursor=' + history.body.page.nextCursor)
        .expect(200);
    expect(history.body.data.map((e: { type: string }) => e.type)).toEqual(['CREATED', 'STATUS_CHANGED']);
    expect(rest.body.data).toEqual([expect.objectContaining({ fromStatus: 'UNDER_REVIEW', toStatus: 'REJECTED', text: 'Fora da competência municipal.' })]);
    expect(rest.body.page.nextCursor).toBeNull();
    const recent = await request(app(manager))
        .get('/reports/' + report.id + '/history?order=newest&limit=1')
        .expect(200);
    expect(recent.body.data).toEqual(rest.body.data);
    const older = await request(app(manager))
        .get('/reports/' + report.id + '/history')
        .query({ order: 'newest', limit: 2, cursor: recent.body.page.nextCursor })
        .expect(200);
    expect(older.body.data).toEqual([...history.body.data].reverse());
    expect(older.body.page.nextCursor).toBeNull();
    await request(app(manager))
        .get('/reports/' + report.id + '/history?order=invalid')
        .expect(400);
    expect(await db.notification.count({ where: { reportId: report.id } })).toBe(2);
    const reopened = await request(app(manager)).post(url).send({ targetStatus: 'UNDER_REVIEW', expectedVersion: 3 }).expect(200);
    expect(reopened.body.data).toMatchObject({ status: 'UNDER_REVIEW', version: 4 });
    expect(reopened.body.data).not.toHaveProperty('rejectionReason');
    const complete = await request(app(citizen))
        .get('/reports/' + report.id + '/history')
        .expect(200);
    expect(complete.body.data.slice(-2)).toEqual([expect.objectContaining({ fromStatus: 'UNDER_REVIEW', toStatus: 'REJECTED', text: 'Fora da competência municipal.' }), expect.objectContaining({ fromStatus: 'REJECTED', toStatus: 'UNDER_REVIEW' })]);
});

it('faz rollback da mudança e do histórico se o banco recusar a notificação', async () => {
    const report = await fixture();
    // A constraint scoped to this isolated fixture forces the real database write to fail.
    const constraint = 'rollback_' + randomUUID().replaceAll('-', '');
    await db.$executeRawUnsafe('ALTER TABLE notifications ADD CONSTRAINT "' + constraint + '" CHECK (report_id <> \'' + report.id + "')");
    try {
        await request(app(manager))
            .post('/reports/' + report.id + '/transitions')
            .send({ targetStatus: 'UNDER_REVIEW', expectedVersion: 1 })
            .expect(500);
        expect(await db.report.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({ status: 'SENT', version: 1 });
        expect(await db.reportEvent.count({ where: { reportId: report.id } })).toBe(1);
        expect(await db.notification.count({ where: { reportId: report.id } })).toBe(0);
    } finally {
        await db.$executeRawUnsafe('ALTER TABLE notifications DROP CONSTRAINT "' + constraint + '"');
    }
});

it('confirma e retira uma única vez por cidadão, mesmo com reenvios concorrentes', async () => {
    const report = await fixture();
    const path = '/reports/' + report.id + '/confirmation';
    for (const actor of [citizen, manager]) await request(app(actor)).put(path).expect(403);
    const operations = await Promise.all([request(app(other)).put(path), request(app(other)).put(path)]);
    for (const response of operations) {
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ confirmed: true, confirmationCount: 1 });
    }
    for (let i = 0; i < 2; i++)
        await request(app(other))
            .delete(path)
            .expect(200, { data: { confirmed: false, confirmationCount: 0 } });
});

it('somente o autor cancela, com versão atual; cancelamento e avanço não podem vencer juntos', async () => {
    const report = await fixture();
    const path = '/reports/' + report.id;
    await request(app(manager))
        .post(path + '/transitions')
        .send({ targetStatus: 'UNDER_REVIEW', expectedVersion: 1 })
        .expect(200);
    for (const actor of [other, manager])
        await request(app(actor))
            .post(path + '/cancellation')
            .send({ expectedVersion: 2 })
            .expect(403);
    await request(app(citizen))
        .post(path + '/cancellation')
        .send({ expectedVersion: 1 })
        .expect(409);
    const [cancel, advance] = await Promise.all([
        request(app(citizen))
            .post(path + '/cancellation')
            .send({ expectedVersion: 2 }),
        request(app(manager))
            .post(path + '/transitions')
            .send({ targetStatus: 'IN_PROGRESS', expectedVersion: 2 }),
    ]);
    expect([cancel.status, advance.status].sort()).toEqual([200, 409]);
    expect(await db.notification.count({ where: { reportId: report.id } })).toBe(2);
    expect(await db.reportEvent.count({ where: { reportId: report.id } })).toBe(3);
    const status = cancel.status === 200 ? 'CANCELED' : 'IN_PROGRESS';
    expect(await db.report.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({ status, version: 3 });
    await request(app(citizen))
        .post(path + '/cancellation')
        .send({ expectedVersion: 3 })
        .expect(409);
});

it('cancelamento em Enviado preserva protocolo e emite histórico e aviso ao autor', async () => {
    const report = await fixture();
    const path = '/reports/' + report.id;
    await request(app(citizen))
        .post(path + '/cancellation')
        .send({ expectedVersion: 1 })
        .expect(200);
    expect((await request(app(citizen)).get(path).expect(200)).body.data).toMatchObject({ id: report.id, status: 'CANCELED', version: 2 });
    const event = await db.reportEvent.findFirstOrThrow({ where: { reportId: report.id, type: 'STATUS_CHANGED' } });
    expect(event).toMatchObject({ actorId: citizen.id, fromStatus: 'SENT', toStatus: 'CANCELED' });
    expect(await db.notification.findMany({ where: { reportId: report.id } })).toEqual([expect.objectContaining({ recipientId: citizen.id, eventId: event.id, status: 'CANCELED' })]);
    await request(app(other)).get(path).expect(404);
});

it.each(['RESOLVED', 'REJECTED', 'CANCELED'] as const)('preserva confirmações recebidas quando o caso fica %s', async (status) => {
    const report = await fixture();
    const path = '/reports/' + report.id + '/confirmation';
    await request(app(other)).put(path).expect(200);
    await db.report.update({ where: { id: report.id }, data: { status } });
    // A canceled report is hidden from other citizens, including previous participants.
    const expected = status === 'CANCELED' ? 404 : 409;
    await request(app(other)).delete(path).expect(expected);
    await request(app(other)).put(path).expect(expected);
    expect(await db.reportConfirmation.count({ where: { reportId: report.id, userId: other.id } })).toBe(1);
    const detail = await request(app(manager))
        .get('/reports/' + report.id)
        .expect(200);
    expect(detail.body.data.confirmationCount).toBe(1);
});

it('serializa confirmação e encerramento sem mudar a contagem após o estado final', async () => {
    const report = await fixture();
    const path = '/reports/' + report.id;
    await request(app(manager))
        .post(path + '/transitions')
        .send({ expectedVersion: 1, targetStatus: 'UNDER_REVIEW' })
        .expect(200);
    const [confirmation, closure] = await Promise.all([
        request(app(other)).put(path + '/confirmation'),
        request(app(manager))
            .post(path + '/transitions')
            .send({ expectedVersion: 2, targetStatus: 'REJECTED', reason: 'Duplicada.' }),
    ]);
    expect(closure.status).toBe(200);
    expect([200, 409]).toContain(confirmation.status);
    const count = confirmation.status === 200 ? 1 : 0;
    expect(closure.body.data.confirmationCount).toBe(count);
    await request(app(other))
        .delete(path + '/confirmation')
        .expect(409);
    const detail = await request(app(other)).get(path).expect(200);
    expect(detail.body.data).toMatchObject({ status: 'REJECTED', confirmationCount: count, confirmedByMe: count === 1, allowedActions: [] });
});

it('mantém o cancelamento do autor no histórico e devolve a ocorrência à consulta pública somente ao reabrir', async () => {
    const report = await fixture();
    const path = '/reports/' + report.id;
    await request(app(citizen))
        .post(path + '/cancellation')
        .send({ expectedVersion: 1 })
        .expect(200);
    await request(app(other)).get(path).expect(404);
    const current = await request(app(manager)).get(path).expect(200);
    expect(current.body.data.allowedActions).toEqual(['UNDER_REVIEW', 'REPLY']);
    const reopen = { expectedVersion: 2, targetStatus: 'UNDER_REVIEW' };
    await request(app(citizen))
        .post(path + '/transitions')
        .send(reopen)
        .expect(403);
    await request(app(manager))
        .post(path + '/transitions')
        .send(reopen)
        .expect(200);
    const visible = await request(app(other)).get(path).expect(200);
    expect(visible.body.data).toMatchObject({ id: report.id, status: 'UNDER_REVIEW', version: 3, allowedActions: ['CONFIRM'] });
    const history = await request(app(other))
        .get(path + '/history')
        .expect(200);
    expect(history.body.data.slice(1)).toEqual([expect.objectContaining({ type: 'STATUS_CHANGED', actorRole: 'CITIZEN', fromStatus: 'SENT', toStatus: 'CANCELED' }), expect.objectContaining({ type: 'STATUS_CHANGED', actorRole: 'MANAGER', fromStatus: 'CANCELED', toStatus: 'UNDER_REVIEW' })]);
});

it('só desfaz o último avanço, mesmo com resposta posterior, e bloqueia recuo após reabertura ou sem histórico', async () => {
    const report = await fixture();
    const path = '/reports/' + report.id;
    const change = (targetStatus: string, expectedVersion: number) =>
        request(app(manager))
            .post(path + '/transitions')
            .send({ targetStatus, expectedVersion });
    await change('UNDER_REVIEW', 1).expect(200);
    await change('IN_PROGRESS', 2).expect(200);
    await request(app(manager))
        .post(path + '/replies')
        .send({ text: 'Equipe deslocada.', clientRequestId: randomUUID() })
        .expect(201);
    const allowed = await request(app(manager)).get(path).expect(200);
    expect(allowed.body.data.allowedActions).toContain('UNDER_REVIEW');
    const undone = await change('UNDER_REVIEW', 3).expect(200);
    expect(undone.body.data.allowedActions).not.toContain('SENT');
    const invalid = await change('SENT', 4).expect(409);
    expect(invalid.body.error.code).toBe('INVALID_TRANSITION');
    expect((await request(app(manager)).get(path)).body.data.version).toBe(4);
    expect(await db.notification.count({ where: { reportId: report.id } })).toBe(3);
    expect(await db.reportEvent.count({ where: { reportId: report.id, type: 'STATUS_CHANGED' } })).toBe(3);
    await change('IN_PROGRESS', 4).expect(200);
    await change('RESOLVED', 5).expect(200);
    const reopened = await change('UNDER_REVIEW', 6).expect(200);
    expect(reopened.body.data.allowedActions).not.toContain('SENT');
    await change('SENT', 7).expect(409);
    const legacy = await fixture();
    await db.report.update({ where: { id: legacy.id }, data: { status: 'IN_PROGRESS' } });
    expect((await request(app(manager)).get('/reports/' + legacy.id)).body.data.allowedActions).not.toContain('UNDER_REVIEW');
    await request(app(manager))
        .post('/reports/' + legacy.id + '/transitions')
        .send({ targetStatus: 'UNDER_REVIEW', expectedVersion: 1 })
        .expect(409);
});

it.each(['RESOLVED', 'REJECTED', 'CANCELED'] as const)('conta 30 dias a partir do encerramento em %s e cancela o prazo na reabertura antecipada', async (targetStatus) => {
    const report = await fixture();
    const from = targetStatus === 'RESOLVED' ? 'IN_PROGRESS' : 'UNDER_REVIEW';
    await db.report.update({ where: { id: report.id }, data: { status: from } });
    const endpoint = '/reports/' + report.id + '/transitions';
    const cancel = (expectedVersion: number) =>
        request(app(citizen))
            .post('/reports/' + report.id + '/cancellation')
            .send({ expectedVersion })
            .expect(200);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        vi.setSystemTime(new Date('2099-01-20T12:00:00Z'));
        if (targetStatus === 'CANCELED') await cancel(1);
        else
            await request(app(manager))
                .post(endpoint)
                .send({ targetStatus, expectedVersion: 1, ...(targetStatus === 'REJECTED' && { reason: 'Teste' }) })
                .expect(200);
        const deadline = new Date('2099-02-19T12:00:00Z');
        const read = () => db.report.findUniqueOrThrow({ where: { id: report.id } });
        expect((await read()).photosExpireAt).toEqual(deadline);
        await request(app(manager))
            .post('/reports/' + report.id + '/replies')
            .send({ text: 'Resposta', clientRequestId: randomUUID() })
            .expect(201);
        expect((await read()).photosExpireAt).toEqual(deadline);
        await request(app(manager)).post(endpoint).send({ targetStatus: 'UNDER_REVIEW', expectedVersion: 2 }).expect(200);
        expect((await read()).photosExpireAt).toBeNull();
        vi.setSystemTime(new Date('2099-02-01T12:00:00Z'));
        await cancel(3);
        const secondDeadline = new Date('2099-03-03T12:00:00Z');
        expect((await read()).photosExpireAt).toEqual(secondDeadline);
        vi.setSystemTime(secondDeadline);
        await request(app(manager)).post(endpoint).send({ targetStatus: 'UNDER_REVIEW', expectedVersion: 4 }).expect(200);
        expect((await read()).photosExpireAt).toEqual(secondDeadline);
        await cancel(5);
        expect((await read()).photosExpireAt).toEqual(secondDeadline);
    } finally {
        vi.useRealTimers();
    }
});
