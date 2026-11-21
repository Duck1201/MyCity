import { readdir, lstat, readFile, rm, rmdir, unlink, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Database } from '../src/database.js';
import { thumbnailFile, thumbnailOf } from '../src/modules/reports/thumbnail.js';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const reportFolder = new RegExp('^' + uuid + '$');
const photoName = new RegExp('^' + uuid + '(\\.thumb)?\\.jpg$');

// Run offline, using the database and photo volume from the same deployment.
export async function reconcileReportFiles(db: Database, root: string, removeId?: string) {
    if (removeId !== undefined && !reportFolder.test(removeId)) throw new Error('ID de diretório inválido.');
    const orphans: string[] = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
        const id = entry.name;
        if ((removeId && id !== removeId) || !entry.isDirectory() || !reportFolder.test(id)) continue;
        const folder = join(root, id);
        const stats = await lstat(folder);
        if (Date.now() - stats.mtimeMs < 24 * 60 * 60 * 1000) continue;
        const contents = await readdir(folder, { withFileTypes: true });
        if (contents.some((child) => !child.isFile() || !photoName.test(child.name))) continue;
        if (await db.report.findUnique({ where: { id }, select: { id: true } })) continue;
        orphans.push(id);
        if (removeId) await rm(folder, { recursive: true });
    }
    if (removeId && !orphans.length) throw new Error('ID ausente do inventário de resíduos removíveis.');
    return orphans.sort();
}

// Use only entries that belonged to the database before an explicit reset.
export async function removeResetPhotos(root: string, photos: readonly { id: string; reportId: string }[]) {
    if (!photos.length) return;
    const rootStats = await lstat(root).catch(absent);
    if (!rootStats) return;
    if (!rootStats.isDirectory() || (await realpath(root)) !== resolve(root)) {
        console.warn('A pasta de uploads não é um diretório físico direto. Os arquivos foram preservados.');
        return;
    }
    const folders = new Set<string>();
    for (const photo of photos) {
        if (!reportFolder.test(photo.reportId) || !photoName.test(photo.id + '.jpg')) continue;
        const folder = join(root, photo.reportId);
        if (!(await lstat(folder).catch(absent))?.isDirectory()) continue;
        for (const name of [photo.id + '.jpg', thumbnailFile(photo.id)]) {
            const path = join(folder, name);
            if (!(await lstat(path).catch(absent))?.isFile()) continue;
            await unlink(path);
            folders.add(folder);
        }
    }
    for (const folder of folders) {
        // A directory containing unrelated files belongs to its owner.
        if (!(await readdir(folder)).length) await rmdir(folder);
    }
}

// Photos published before thumbnails existed get one; rerunning only fills gaps.
// Walk the report folders on this volume, so photos stored elsewhere are not counted.
export async function backfillThumbnails(db: Database, root: string) {
    let created = 0,
        missingOriginals = 0;
    for (const entry of await readdir(root, { withFileTypes: true })) {
        if (!entry.isDirectory() || !reportFolder.test(entry.name)) continue;
        const folder = join(root, entry.name);
        await db.$transaction(async (tx) => {
            // Serialize against the purge so a thumbnail cannot be recreated after removal.
            const reports = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM reports WHERE id = ${entry.name}
                AND (photos_expire_at IS NULL OR photos_expire_at > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) FOR UPDATE`;
            if (!reports.length) return;
            for (const { id } of await tx.reportPhoto.findMany({ where: { reportId: entry.name }, select: { id: true }, orderBy: { position: 'asc' } })) {
                if (!photoName.test(id + '.jpg') || (await lstat(join(folder, thumbnailFile(id))).catch(absent))?.isFile()) continue;
                const original = join(folder, id + '.jpg');
                if (!(await lstat(original).catch(absent))?.isFile()) {
                    missingOriginals++;
                    continue;
                }
                await writeFile(join(folder, thumbnailFile(id)), await thumbnailOf(await readFile(original)), { flag: 'wx', mode: 0o600 });
                created++;
            }
        });
    }
    return { created, missingOriginals };
}

function absent(error: NodeJS.ErrnoException) {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
}
