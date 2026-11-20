import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createDatabase } from '../src/database.js';
import { reconcileReportFiles } from '../prisma/report-files.js';

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
