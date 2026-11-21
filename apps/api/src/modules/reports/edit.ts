import { mkdir, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Database } from '../../database.js';
import { managerInteraction } from './management-visibility.js';
import { readPublicProfiles } from '../identity/index.js';
import { lockReport, recordStatusChange } from './service.js';
import { canEditReport, photosAvailable } from './rules.js';
import { checkCategory, checkUploadSpace, readDetail, reportNotFound, savePhotos, visibleReports } from './store.js';
import { thumbnailFile } from './thumbnail.js';
import { ReportError, badInput, type parseEditUpload } from './upload.js';

export async function editableReport(db: Pick<Database, 'report'>, id: string, authorId: string) {
    const row = await db.report.findFirst({
        where: { id, ...visibleReports({ id: authorId, role: 'CITIZEN' }) },
        select: { id: true, authorId: true, status: true, version: true, category: true, photosExpireAt: true, photos: true, _count: { select: { events: { where: managerInteraction } } } },
    });
    if (!row) throw reportNotFound();
    if (row.authorId !== authorId) throw new ReportError(403, 'FORBIDDEN', 'Somente o autor pode editar esta denúncia.');
    if (!canEditReport(row.status, row._count.events)) throw new ReportError(409, 'EDIT_UNAVAILABLE', 'A edição só está disponível antes do atendimento.');
    return row;
}

async function removeFiles(folder: string, ids: string[]) {
    for (const id of ids) {
        for (const name of [id + '.jpg', thumbnailFile(id)]) {
            try {
                await unlink(join(folder, name));
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('Um arquivo de edição aguarda reconciliação offline.');
            }
        }
    }
}

export async function editReport(db: Database, root: string, id: string, authorId: string, input: Awaited<ReturnType<typeof parseEditUpload>>) {
    const { metadata, photos } = input;
    const { category, description, showIdentity, location, retainedPhotoIds, expectedVersion } = metadata;
    const written: string[] = [];
    const folder = resolve(root, id);
    let removed: string[] = [];
    const data = await db.$transaction(async (tx) => {
        await lockReport(tx, id);
        const report = await editableReport(tx, id, authorId);
        if (report.version !== expectedVersion) throw new ReportError(409, 'VERSION_CONFLICT', 'A denúncia foi atualizada. Consulte o estado atual.');
        if (category !== report.category) await checkCategory(tx, category);
        if (showIdentity && !(await readPublicProfiles(tx, [authorId])).has(authorId)) throw new ReportError(409, 'PROFILE_UNAVAILABLE', 'O perfil da conta ainda precisa ser provisionado.');
        const retained = retainedPhotoIds.map((photoId) => {
            const photo = report.photos.find((item) => item.id === photoId);
            if (!photo || !photosAvailable(report.photosExpireAt)) throw badInput('Confira as fotos mantidas na denúncia.');
            return photo;
        });
        if (!/^[a-f0-9-]{36}$/i.test(id) || report.photos.some((photo) => !/^[a-f0-9-]{36}$/i.test(photo.id))) throw new Error('Identificador de arquivo inválido.');
        if ((await realpath(root)) !== resolve(root)) throw new Error('Diretório de uploads inválido.');
        if (photos.length) {
            await checkUploadSpace(root);
            await mkdir(folder, { recursive: true, mode: 0o700 });
        }
        if ((await realpath(folder)) !== folder) throw new Error('Diretório de fotos inválido.');
        try {
            const added = await savePhotos(folder, photos, written);
            removed = report.photos.filter((photo) => !retainedPhotoIds.includes(photo.id)).map((photo) => photo.id);
            // Positions are unique and constrained to 0..2. Reinsert the small set
            // in its final order inside the transaction, preserving retained IDs.
            await tx.reportPhoto.deleteMany({ where: { reportId: id } });
            if (report.status === 'CANCELED') await recordStatusChange(tx, report, authorId, 'SENT');
            await tx.report.update({
                where: { id },
                data: { status: 'SENT', category, description, showIdentity, latitude: location.latitude, longitude: location.longitude, locationSource: location.source, photosExpireAt: null, photosPurgedAt: null, version: { increment: 1 }, photos: { create: [...retained, ...added].map(({ id: photoId, width, height, byteSize }, position) => ({ id: photoId, width, height, byteSize, position })) } },
            });
            return await readDetail(tx, id, { id: authorId, role: 'CITIZEN' });
        } catch (error) {
            // Throwing from the callback prevents COMMIT. Once it returns,
            // only offline reconciliation can safely settle an uncertain commit.
            await removeFiles(folder, written);
            throw error;
        }
    });
    await removeFiles(folder, removed);
    return data;
}
