import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createDatabase } from '../src/database.js';
import { backfillThumbnails, reconcileReportFiles } from '../prisma/report-files.js';

it('inventaria resíduos antigos e remove somente o ID confirmado pelo operador', async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco local de teste.');
    const db = createDatabase(url.toString());
    const root = await mkdtemp(join(tmpdir(), 'mycity-reconciliation-'));
    const userId = randomUUID();
    const orphan = randomUUID(),
        published = randomUUID(),
        recent = randomUUID(),
        unknown = randomUUID();
    try {
        await db.user.create({ data: { id: userId, cpf: '00000000081', role: 'CITIZEN', password: 'fixture' } });
        await db.report.create({ data: { id: published, authorId: userId, category: 'TREE', clientRequestId: 'maintenance', requestHash: '0'.repeat(64), description: 'Árvore', latitude: 0, longitude: 0, locationSource: 'GPS', showIdentity: false } });
        const yesterday = new Date(Date.now() - 2 * 86400_000);
        for (const id of [orphan, published, recent, unknown]) {
            const folder = join(root, id);
            await mkdir(folder);
            await writeFile(join(folder, id === unknown ? 'other-file' : randomUUID() + '.jpg'), 'fixture');
            if (id !== recent) await utimes(folder, yesterday, yesterday);
        }
        expect(await reconcileReportFiles(db, root)).toEqual([orphan]);
        await expect(reconcileReportFiles(db, root, published)).rejects.toThrow();
        await expect(reconcileReportFiles(db, root, '../escape')).rejects.toThrow();
        await reconcileReportFiles(db, root, orphan);
        expect((await readdir(root)).sort()).toEqual([published, recent, unknown].sort());
    } finally {
        await db.report.deleteMany({ where: { id: published } });
        await db.user.deleteMany({ where: { id: userId } });
        await db.$disconnect();
        await rm(root, { recursive: true, force: true });
    }
});

it('trata como resíduo uma pasta órfã com foto e miniatura', async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco local de teste.');
    const db = createDatabase(url.toString());
    const root = await mkdtemp(join(tmpdir(), 'mycity-reconciliation-thumbs-'));
    const orphan = randomUUID(),
        photoId = randomUUID();
    try {
        const folder = join(root, orphan);
        await mkdir(folder);
        await writeFile(join(folder, photoId + '.jpg'), 'fixture');
        await writeFile(join(folder, photoId + '.thumb.jpg'), 'fixture');
        const yesterday = new Date(Date.now() - 2 * 86400_000);
        await utimes(folder, yesterday, yesterday);
        expect(await reconcileReportFiles(db, root)).toEqual([orphan]);
        await reconcileReportFiles(db, root, orphan);
        expect(await readdir(root)).toEqual([]);
    } finally {
        await db.$disconnect();
        await rm(root, { recursive: true, force: true });
    }
});

it('gera só as miniaturas que faltam e repete sem efeito', async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco local de teste.');
    const db = createDatabase(url.toString());
    const root = await mkdtemp(join(tmpdir(), 'mycity-thumb-backfill-'));
    const userId = randomUUID(),
        reportId = randomUUID();
    const [legacy, ready, lost] = [randomUUID(), randomUUID(), randomUUID()];
    try {
        await db.user.create({ data: { id: userId, cpf: '00000000080', role: 'CITIZEN', password: 'fixture' } });
        const photo = { width: 800, height: 600, byteSize: 1 };
        await db.report.create({
            data: {
                id: reportId,
                authorId: userId,
                category: 'TREE',
                clientRequestId: 'backfill',
                requestHash: '0'.repeat(64),
                description: 'Árvore',
                latitude: 0,
                longitude: 0,
                locationSource: 'GPS',
                showIdentity: false,
                photos: { create: [legacy, ready, lost].map((id, position) => ({ id, position, ...photo })) },
            },
        });
        const folder = join(root, reportId);
        await mkdir(folder);
        const original = await sharp({ create: { width: 800, height: 600, channels: 3, background: 'green' } })
            .jpeg()
            .toBuffer();
        await writeFile(join(folder, legacy + '.jpg'), original);
        await writeFile(join(folder, ready + '.jpg'), original);
        await writeFile(join(folder, ready + '.thumb.jpg'), 'existente');
        expect(await backfillThumbnails(db, root)).toEqual({ created: 1, missingOriginals: 1 });
        expect(await sharp(await readFile(join(folder, legacy + '.thumb.jpg'))).metadata()).toMatchObject({ format: 'jpeg', width: 320, height: 240 });
        expect(await readFile(join(folder, ready + '.thumb.jpg'), 'utf8')).toBe('existente');
        expect(await backfillThumbnails(db, root)).toEqual({ created: 0, missingOriginals: 1 });
    } finally {
        await db.report.deleteMany({ where: { id: reportId } });
        await db.user.deleteMany({ where: { id: userId } });
        await db.$disconnect();
        await rm(root, { recursive: true, force: true });
    }
});
