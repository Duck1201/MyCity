import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, afterEach, beforeEach, beforeAll, expect, it } from 'vitest';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createReportsRouter, provisionReportExample } from '../src/modules/reports/index.js';
import { provisionDemoReports } from '../prisma/demo-reports.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco de teste isolado.');
// The demo intentionally populates every category. Its own schema keeps those
// rows out of concurrent feed/count tests in the same PostgreSQL test database.
const schema = 'seed_' + randomUUID().replaceAll('-', '');
const connection = { connectionString: url.href, options: '-c search_path=' + schema };
const db = new PrismaClient({ adapter: new PrismaPg(connection, { schema }) });
const ddl = new pg.Client(connection);
let directory: string;
beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mycity-demo-seed-'));
});
const actors = { citizenA: randomUUID(), citizenB: randomUUID(), manager: randomUUID() };
const authors = [actors.citizenA, actors.citizenB];
const where = { authorId: { in: authors } };
const seed = () => provisionDemoReports(db, directory, actors);
function client(id: string, role: 'MANAGER' | 'CITIZEN') {
    return request(
        express()
            .use((_req, res, next) => {
                res.locals.user = { id, role };
                next();
            })
            .use('/reports', createReportsRouter(db, directory)),
    );
}
beforeAll(async () => {
    await ddl.connect();
    await ddl.query('CREATE SCHEMA ' + schema);
    const migrations = new URL('../prisma/migrations/', import.meta.url);
    const dirs = (await readdir(migrations, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    for (const dir of dirs) await ddl.query(await readFile(new URL(dir + '/migration.sql', migrations), 'utf8'));
    for (const [index, id] of Object.values(actors).entries()) {
        await db.user.create({ data: { id, cpf: '0000000084' + index, role: id === actors.manager ? 'MANAGER' : 'CITIZEN', password: 'unused', profile: { create: { name: 'Pessoa de exemplo', photoUrl: 'fixture' } } } });
    }
});
afterEach(async () => {
    await db.report.deleteMany({ where });
    await rm(directory, { recursive: true, force: true });
});
afterAll(async () => {
    await db.$disconnect();
    await ddl.query('ROLLBACK');
    await ddl.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    await ddl.end();
});

it('prepara os seis exemplos completos uma vez e preserva atendimento e retiradas de confirmação após reexecuções', async () => {
    await Promise.all([seed(), seed()]);
    const reports = await db.report.findMany({ where, include: { photos: true, confirmations: true, events: true, notifications: true } });
    expect(reports.map((r) => r.category).sort()).toEqual(['DEBRIS', 'LEAK', 'LIGHTING', 'POTHOLE', 'TREE', 'WASTE']);
    expect(reports.map((r) => r.status).sort()).toEqual(['CANCELED', 'IN_PROGRESS', 'REJECTED', 'RESOLVED', 'SENT', 'UNDER_REVIEW']);
    expect(new Set(reports.map((r) => r.authorId))).toEqual(new Set(authors));
    expect((await readdir(directory)).sort()).toEqual(reports.map((r) => r.id).sort());
    for (const r of reports) {
        expect(r.photos).toHaveLength(1);
        const detail = await client(actors.manager, 'MANAGER')
            .get('/reports/' + r.id)
            .expect(200);
        expect(detail.body.data).toMatchObject({ category: r.category, status: r.status, showIdentity: r.showIdentity });
        const picture = await client(actors.manager, 'MANAGER')
            .get('/reports/' + r.id + '/photos/' + r.photos[0]!.id)
            .expect(200);
        const metadata = await sharp(picture.body).metadata();
        expect(metadata.format).toBe('jpeg');
        // The detail view displays photos at up to 265 CSS pixels high.
        expect(metadata.height).toBeGreaterThanOrEqual(530);
        expect(r.events.filter((e) => e.type === 'CREATED')).toHaveLength(1);
        const changes = r.events.filter((e) => e.type === 'STATUS_CHANGED');
        expect(r.notifications.map((n) => n.eventId).sort()).toEqual(changes.map((e) => e.id).sort());
        expect(r.notifications.every((n) => n.recipientId === r.authorId)).toBe(true);
        expect(r.version).toBe(changes.length + 1);
    }
    const active = reports.find((r) => r.status === 'UNDER_REVIEW')!;
    expect(active.confirmations).toHaveLength(1);
    const other = active.confirmations[0]!.userId;
    expect(other).not.toBe(active.authorId);
    await client(other, 'CITIZEN')
        .delete('/reports/' + active.id + '/confirmation')
        .expect(200);
    await client(actors.manager, 'MANAGER')
        .post('/reports/' + active.id + '/transitions')
        .send({ targetStatus: 'IN_PROGRESS', expectedVersion: active.version })
        .expect(200);
    const snapshot = () => db.report.findMany({ where, orderBy: { id: 'asc' }, include: { photos: { orderBy: { id: 'asc' } }, events: { orderBy: { id: 'asc' } }, notifications: { orderBy: { id: 'asc' } }, confirmations: { orderBy: { userId: 'asc' } } } });
    const before = await snapshot();
    await seed();
    expect(await snapshot()).toEqual(before);
    expect((await readdir(directory)).sort()).toEqual(reports.map((r) => r.id).sort());
});

it('preserva a denúncia já provisionada quando a fotografia distribuída com o seed muda', async () => {
    const oldPhoto = await sharp({ create: { width: 74, height: 55, channels: 3, background: '#667788' } })
        .jpeg()
        .toBuffer();
    const key = 'mycity-demo-v1-pothole';
    const earlier = await provisionReportExample(db, directory, {
        authorId: actors.citizenA,
        managerId: actors.manager,
        confirmerId: actors.citizenB,
        metadata: { category: 'POTHOLE', clientRequestId: key, description: 'Buraco junto à faixa de pedestres na esquina.', showIdentity: true, location: { latitude: -20.7528, longitude: -42.8814, source: 'MANUAL' } },
        photos: [oldPhoto],
        transitions: ['UNDER_REVIEW'],
    });
    expect(await seed()).toBe(5);
    const preserved = await client(actors.manager, 'MANAGER')
        .get('/reports/' + earlier.data.id)
        .expect(200);
    expect(preserved.body.data.photos).toEqual(earlier.data.photos);
    expect(await db.report.count({ where })).toBe(6);
});

it('retoma o seed após falha numa notificação sem publicar denúncia incompleta nem duplicar exemplos anteriores', async () => {
    const constraint = 'seed_rollback_' + randomUUID().replaceAll('-', '');
    await db.$executeRawUnsafe(`ALTER TABLE notifications ADD CONSTRAINT "${constraint}" CHECK (recipient_id <> '${actors.citizenB}' OR status <> 'resolved')`);
    try {
        await expect(seed()).rejects.toThrow();
    } finally {
        await db.$executeRawUnsafe(`ALTER TABLE notifications DROP CONSTRAINT "${constraint}"`);
    }
    const partial = await db.report.findMany({ where, select: { id: true, category: true } });
    expect(partial.map((r) => r.category).sort()).toEqual(['DEBRIS', 'LIGHTING', 'POTHOLE']);
    expect((await readdir(directory)).sort()).toEqual(partial.map((r) => r.id).sort());
    expect(await seed()).toBe(3);
    expect(await db.report.findMany({ where: { id: { in: partial.map((r) => r.id) } }, select: { id: true, category: true }, orderBy: { category: 'asc' } })).toEqual(partial.sort((a, b) => a.category.localeCompare(b.category)));
    expect(await db.report.count({ where })).toBe(6);
});

it('reconstitui categorias iniciais ausentes sem redefinir grupos existentes', async () => {
    await db.reportCategoryDefinition.delete({ where: { id: 'WASTE' } });
    await db.reportCategoryDefinition.update({ where: { id: 'TREE' }, data: { name: 'Poda de galhos', nameKey: 'poda de galhos' } });
    const custom = await db.reportCategoryDefinition.create({ data: { name: 'Sinalização', nameKey: 'sinalizacao' } });
    await seed();
    expect(await db.reportCategoryDefinition.findUniqueOrThrow({ where: { id: 'WASTE' } })).toMatchObject({ name: 'Lixo não coletado', nameKey: 'lixo nao coletado', position: 1 });
    expect(await db.reportCategoryDefinition.findUniqueOrThrow({ where: { id: 'TREE' } })).toMatchObject({ name: 'Poda de galhos' });
    expect(await db.reportCategoryDefinition.findUniqueOrThrow({ where: { id: custom.id } })).toEqual(custom);
});

it('consolida todas as situações, categorias e as três prioridades para o gestor', async () => {
    const path = '/reports/overview';
    await client(actors.citizenA, 'CITIZEN').get(path).expect(403);
    const empty = (await client(actors.manager, 'MANAGER').get(path).expect(200)).body.data;
    expect(empty.oldest).toBeNull();
    expect(empty.priorities).toEqual([]);
    expect(Object.values(empty.counts)).toEqual([0, 0, 0, 0, 0, 0]);
    await seed();
    const archived = await db.reportCategoryDefinition.create({ data: { name: 'Ciclovia de teste', nameKey: 'ciclovia de teste', archived: true } });
    const overview = (await client(actors.manager, 'MANAGER').get(path).expect(200)).body.data;
    expect(overview.counts).toEqual({ SENT: 1, UNDER_REVIEW: 1, IN_PROGRESS: 1, RESOLVED: 1, REJECTED: 1, CANCELED: 1 });
    expect(overview.categories).toContainEqual(expect.objectContaining({ id: archived.id, archived: true, count: 0 }));
    expect(overview.categories).toContainEqual(expect.objectContaining({ id: 'POTHOLE', count: 1 }));
    const queue = (await client(actors.manager, 'MANAGER').get('/reports?scope=management&limit=3').expect(200)).body.data as { id: string; createdAt: string; coverPhoto: { contentPath: string } }[];
    expect(overview.priorities.map((r: { id: string }) => r.id)).toEqual(queue.map((r) => r.id));
    expect(overview.priorities[0].photoPath).toBe(queue[0]!.coverPhoto.contentPath);
    expect(overview.priorities[0]).not.toHaveProperty('author');
    const oldest = queue.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0]!;
    expect(overview.oldest).toEqual({ id: oldest.id, createdAt: oldest.createdAt });
    await db.reportCategoryDefinition.delete({ where: { id: archived.id } });
});
