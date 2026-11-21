import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { removeResetPhotos } from '../prisma/report-files.js';

it('limpa somente os JPEGs conhecidos, preserva conteúdo independente e não atravessa links', async () => {
    const base = await mkdtemp(join(tmpdir(), 'mycity-reset-photos-'));
    try {
        const root = join(base, 'uploads');
        const reportId = randomUUID(),
            emptyReport = randomUUID(),
            foreignReport = randomUUID(),
            photoId = randomUUID();
        const foreign = join(base, 'foreign');
        for (const dir of [join(root, reportId), join(root, emptyReport), foreign]) await mkdir(dir, { recursive: true });
        await writeFile(join(root, reportId, photoId + '.jpg'), 'antigo');
        await writeFile(join(root, emptyReport, photoId + '.jpg'), 'antigo');
        await writeFile(join(root, reportId, 'note.txt'), 'preservar');
        await writeFile(join(foreign, photoId + '.jpg'), 'externo');
        await symlink(foreign, join(root, foreignReport), 'dir');
        await removeResetPhotos(root, [
            { id: photoId, reportId },
            { id: photoId, reportId: emptyReport },
            { id: photoId, reportId: foreignReport },
        ]);
        expect(await readdir(join(root, reportId))).toEqual(['note.txt']);
        expect(await readdir(root)).not.toContain(emptyReport);
        expect(await readFile(join(foreign, photoId + '.jpg'), 'utf8')).toBe('externo');
    } finally {
        await rm(base, { recursive: true, force: true });
    }
});

it('preserva arquivos se o upload configurado atravessar um ancestral simbólico', async () => {
    const base = await mkdtemp(join(tmpdir(), 'mycity-reset-path-'));
    try {
        const reportId = randomUUID(),
            photoId = randomUUID();
        const actual = join(base, 'owner', 'uploads', reportId);
        await mkdir(actual, { recursive: true });
        await writeFile(join(actual, photoId + '.jpg'), 'preservar');
        await symlink(join(base, 'owner'), join(base, 'alias'), 'dir');
        await removeResetPhotos(join(base, 'alias', 'uploads'), [{ id: photoId, reportId }]);
        expect(await readFile(join(actual, photoId + '.jpg'), 'utf8')).toBe('preservar');
    } finally {
        await rm(base, { recursive: true, force: true });
    }
});

it('remove a miniatura junto da foto conhecida', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mycity-reset-thumbs-'));
    try {
        const reportId = randomUUID(),
            photoId = randomUUID(),
            onlyThumb = randomUUID();
        await mkdir(join(root, reportId));
        await writeFile(join(root, reportId, photoId + '.jpg'), 'antigo');
        await writeFile(join(root, reportId, photoId + '.thumb.jpg'), 'antigo');
        await writeFile(join(root, reportId, onlyThumb + '.thumb.jpg'), 'antigo');
        await removeResetPhotos(root, [
            { id: photoId, reportId },
            { id: onlyThumb, reportId },
        ]);
        expect(await readdir(root)).not.toContain(reportId);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
