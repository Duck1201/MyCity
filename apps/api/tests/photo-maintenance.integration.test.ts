import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { purgeExpiredPhotos } from '../src/modules/reports/index.js';
import { createDatabase } from '../src/database.js';
import { backfillThumbnails, reconcileReportFiles, reconcileUnlinkedPhotos } from '../prisma/report-files.js';

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

it('reconcilia somente arquivos antigos sem vínculo em pastas de denúncias existentes', async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco local de teste.');
    const db = createDatabase(url.toString());
    const root = await mkdtemp(join(tmpdir(), 'mycity-edit-orphans-'));
    const userId = randomUUID(),
        reportId = randomUUID(),
        live = randomUUID(),
        orphan = randomUUID(),
        recent = randomUUID();
    const folder = join(root, reportId);
    try {
        await mkdir(folder);
        await db.user.create({ data: { id: userId, cpf: '00000000079', role: 'CITIZEN', password: 'fixture' } });
        await db.report.create({ data: { id: reportId, authorId: userId, category: 'TREE', clientRequestId: 'edition', requestHash: '0'.repeat(64), description: 'Árvore', latitude: 0, longitude: 0, locationSource: 'GPS', showIdentity: false, photos: { create: { id: live, width: 10, height: 10, byteSize: 50, position: 0 } } } });
        const old = new Date(Date.now() - 2 * 86400_000);
        for (const id of [live, orphan, recent])
            for (const suffix of ['.jpg', '.thumb.jpg']) {
                const file = join(folder, id + suffix);
                await writeFile(file, 'fixture');
                if (id !== recent) await utimes(file, old, old);
            }
        const stale = [reportId + '/' + orphan + '.jpg', reportId + '/' + orphan + '.thumb.jpg'];
        expect(await reconcileUnlinkedPhotos(db, root)).toEqual(stale);
        await expect(reconcileUnlinkedPhotos(db, root, reportId + '/' + live + '.jpg')).rejects.toThrow();
        await expect(reconcileUnlinkedPhotos(db, root, '../escape')).rejects.toThrow();
        for (const file of stale) await reconcileUnlinkedPhotos(db, root, file);
        expect((await readdir(folder)).sort()).toEqual([live + '.jpg', live + '.thumb.jpg', recent + '.jpg', recent + '.thumb.jpg'].sort());
    } finally {
        await db.report.deleteMany({ where: { id: reportId } });
        await db.user.deleteMany({ where: { id: userId } });
        await db.$disconnect();
        await rm(root, { recursive: true, force: true });
    }
});

it('gera só as miniaturas que faltam e repete sem efeito', async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco local de teste.');
    url.searchParams.set('options', '-c timezone=America/Sao_Paulo');
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
        await db.report.update({ where: { id: reportId }, data: { photosExpireAt: new Date(Date.now() - 60_000) } });
        await rm(join(folder, legacy + '.thumb.jpg'));
        expect(await backfillThumbnails(db, root)).toEqual({ created: 0, missingOriginals: 0 });
        expect(await readdir(folder)).not.toContain(legacy + '.thumb.jpg');
    } finally {
        await db.report.deleteMany({ where: { id: reportId } });
        await db.user.deleteMany({ where: { id: userId } });
        await db.$disconnect();
        await rm(root, { recursive: true, force: true });
    }
});

it('retoma a remoção após volume ausente ou falha na miniatura e preserva o acervo sem prazo', async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco local de teste.');
    const db = createDatabase(url.toString());
    const root = await mkdtemp(join(tmpdir(), 'mycity-expire-'));
    const userId = randomUUID();
    try {
        await db.user.create({ data: { id: userId, cpf: '00000000082', role: 'CITIZEN', password: 'fixture' } });
        async function fixture(photosExpireAt: Date | null) {
            const reportId = randomUUID(),
                id = randomUUID();
            await db.report.create({ data: { id: reportId, authorId: userId, clientRequestId: randomUUID(), requestHash: '0'.repeat(64), description: 'Árvore', category: 'TREE', latitude: 0, longitude: 0, locationSource: 'GPS', showIdentity: false, status: 'RESOLVED', photosExpireAt, photos: { create: { id, width: 1, height: 1, position: 0, byteSize: 1 } } } });
            const folder = join(root, reportId);
            await mkdir(folder);
            const original = join(folder, id + '.jpg'),
                thumbnail = join(folder, id + '.thumb.jpg');
            await writeFile(original, 'fixture');
            if (photosExpireAt) await mkdir(thumbnail);
            else await writeFile(thumbnail, 'fixture');
            return { original, thumbnail, reportId };
        }
        const expired = await fixture(new Date(0));
        const legacy = await fixture(null);
        const emptyVolume = join(root, 'empty-volume');
        await mkdir(emptyVolume);
        await expect(purgeExpiredPhotos(db, emptyVolume)).rejects.toThrow();
        expect((await db.report.findUniqueOrThrow({ where: { id: expired.reportId } })).photosPurgedAt).toBeNull();
        expect(await readFile(expired.original, 'utf8')).toBe('fixture');
        await expect(purgeExpiredPhotos(db, root)).rejects.toThrow();
        await expect(readFile(expired.original)).rejects.toMatchObject({ code: 'ENOENT' });
        expect((await db.report.findUniqueOrThrow({ where: { id: expired.reportId } })).photosPurgedAt).toBeNull();
        await rm(expired.thumbnail, { recursive: true });
        await writeFile(expired.thumbnail, 'fixture');
        await Promise.all([purgeExpiredPhotos(db, root), purgeExpiredPhotos(db, root)]);
        await expect(readFile(expired.thumbnail)).rejects.toMatchObject({ code: 'ENOENT' });
        expect((await db.report.findUniqueOrThrow({ where: { id: expired.reportId } })).photosPurgedAt).toBeInstanceOf(Date);
        expect(await readFile(legacy.thumbnail, 'utf8')).toBe('fixture');
        expect(await readFile(legacy.original, 'utf8')).toBe('fixture');
    } finally {
        await db.report.deleteMany({ where: { authorId: userId } });
        await db.user.deleteMany({ where: { id: userId } });
        await db.$disconnect();
        await rm(root, { recursive: true, force: true });
    }
});
