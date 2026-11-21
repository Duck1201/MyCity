import { lstat, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Database } from '../../database.js';
import { thumbnailFile } from './thumbnail.js';

function allowMissing(error: NodeJS.ErrnoException) {
    if (error.code !== 'ENOENT') throw error;
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function purgeExpiredPhotos(db: Database, root: string) {
    const now = new Date();
    let after = '',
        purged = 0,
        failed = 0;
    for (;;) {
        const due = await db.report.findMany({ where: { photosExpireAt: { lte: now }, photosPurgedAt: null, id: { gt: after } }, orderBy: { id: 'asc' }, take: 100, select: { id: true } });
        if (!due.length) break;
        if ((await realpath(root)) !== resolve(root)) throw new Error('Diretório de uploads inválido.');
        for (const { id } of due) {
            try {
                purged += await db.$transaction(async (tx) => {
                    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM reports WHERE id = ${id} AND photos_expire_at <= ${now} AND photos_purged_at IS NULL FOR UPDATE`;
                    if (!locked.length) return 0;
                    if (!uuid.test(id)) throw new Error('ID de diretório inválido.');
                    const folder = join(root, id);
                    if (!(await lstat(folder)).isDirectory()) throw new Error('Diretório de fotos inválido.');
                    const photos = await tx.reportPhoto.findMany({ where: { reportId: id }, select: { id: true } });
                    for (const photo of photos) {
                        if (!uuid.test(photo.id)) throw new Error('ID de foto inválido.');
                        await unlink(join(folder, photo.id + '.jpg')).catch(allowMissing);
                        await unlink(join(folder, thumbnailFile(photo.id))).catch(allowMissing);
                    }
                    // File removal is repeatable if the database commit fails.
                    await tx.$executeRaw`UPDATE reports SET photos_purged_at = ${now} WHERE id = ${id}`;
                    return 1;
                });
            } catch {
                failed++;
            }
        }
        after = due[due.length - 1]!.id;
    }
    if (failed) throw new Error('Falha ao remover fotos expiradas em ' + failed + ' denúncia(s).');
    return { purged };
}
