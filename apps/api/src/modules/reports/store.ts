import { randomUUID } from 'node:crypto';
import filesystem, { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReportDetail, ReportMarker, ReportSummary, ReportStatus, Role } from '@mycity/contracts';
import type { Database } from '../../database.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { readPublicProfiles } from '../identity/index.js';
import { reportIds, type ReportQuery } from './query.js';
import { canEditReport, canTransition, isOpenReportStatus, managerActions, photosAvailable } from './rules.js';
import { managerInteraction, managerVisibleReports } from './management-visibility.js';
import { thumbnailFile } from './thumbnail.js';
import { ReportError, type parseUpload } from './upload.js';

const relations = (viewerId: string) =>
    ({
        categoryDefinition: { select: { name: true } },
        photos: { orderBy: { position: 'asc' } },
        _count: { select: { confirmations: true } },
        confirmations: { where: { userId: viewerId }, select: { userId: true } },
    }) satisfies Prisma.ReportInclude;
const detailRelations = (viewerId: string) => ({
    ...relations(viewerId),
    _count: { select: { confirmations: true, events: { where: managerInteraction } } },
});
export const latestStatusChange = {
    where: { type: 'STATUS_CHANGED' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { fromStatus: true, toStatus: true, text: true },
} satisfies Prisma.Report$eventsArgs;

export function previousStatusOf(row: { status: ReportStatus; events?: { fromStatus: ReportStatus | null; toStatus: ReportStatus | null }[] }) {
    const last = row.events?.[0];
    return last?.toStatus === row.status ? last.fromStatus : undefined;
}

type Stored = Prisma.ReportGetPayload<{ include: ReturnType<typeof relations> }>;
export const reportNotFound = () => new ReportError(404, 'NOT_FOUND', 'Denúncia ou foto não encontrada.');

function photoDto(reportId: string, { id, position, width, height, byteSize }: Stored['photos'][number]) {
    const contentPath = `/api/v1/reports/${reportId}/photos/${id}`;
    return { id, position, width, height, byteSize, contentPath, thumbnailPath: contentPath + '/thumb' };
}

type Profiles = Awaited<ReturnType<typeof readPublicProfiles>>;

function summary(row: Stored, viewerId: string, profiles: Profiles): ReportSummary {
    const author = row.showIdentity ? profiles.get(row.authorId) : undefined;
    return {
        id: row.id,
        category: row.category,
        categoryName: row.categoryDefinition.name,
        description: row.description,
        status: row.status,
        location: { latitude: row.latitude, longitude: row.longitude, source: row.locationSource },
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.modifiedAt.toISOString(),
        confirmationCount: row._count.confirmations,
        confirmedByMe: row.confirmations.length > 0,
        isMine: row.authorId === viewerId,
        showIdentity: row.showIdentity,
        ...(author && { author }),
        ...(row.photosExpireAt && { photosExpireAt: row.photosExpireAt.toISOString() }),
        ...(photosAvailable(row.photosExpireAt) && row.photos[0] && { coverPhoto: photoDto(row.id, row.photos[0]) }),
    };
}
function detail(row: Stored & { _count: { events: number } }, viewerId: string, profiles: Profiles, role: Role = 'CITIZEN', previousStatus?: ReportStatus | null): ReportDetail {
    const dto = summary(row, viewerId, profiles);
    const allowedActions: string[] = role === 'MANAGER' ? managerActions(row.status, previousStatus) : [];
    if (role === 'CITIZEN') {
        if (canTransition({ from: row.status, to: 'CANCELED', isAuthor: dto.isMine, role })) allowedActions.push('CANCEL');
        if (dto.isMine && canEditReport(row.status, row._count.events)) allowedActions.push('EDIT');
        if (dto.isMine && row.status === 'CANCELED') allowedActions.push('REOPEN');
        if (!dto.isMine && isOpenReportStatus(row.status)) allowedActions.push(dto.confirmedByMe ? 'WITHDRAW' : 'CONFIRM');
    }
    return { ...dto, photos: dto.coverPhoto ? row.photos.map((photo) => photoDto(row.id, photo)) : [], version: row.version, allowedActions };
}

export function visibleReports(viewer: { id: string; role: Role }): Prisma.ReportWhereInput {
    return viewer.role === 'CITIZEN' ? { OR: [{ authorId: viewer.id }, { status: { not: 'CANCELED' } }] } : managerVisibleReports;
}

export async function readDetail(reader: Pick<Database, 'report' | 'profile'>, id: string, viewer: { id: string; role: Role }) {
    const row = await reader.report.findFirst({
        where: { id, ...visibleReports(viewer) },
        include: { ...detailRelations(viewer.id), events: latestStatusChange },
    });
    if (!row) throw reportNotFound();
    const dto = detail(row, viewer.id, await readPublicProfiles(reader, row.showIdentity ? [row.authorId] : []), viewer.role, previousStatusOf(row));
    // The justification of the rejection in force, so readers need not search the history for it.
    const last = row.events[0];
    return row.status === 'REJECTED' && last?.toStatus === 'REJECTED' && last.text ? { ...dto, rejectionReason: last.text } : dto;
}

export async function checkUploadSpace(root: string) {
    const space = await filesystem.statfs(root);
    // Keep 256 MiB free even if the four admitted uploads all finish together.
    if (space.bavail * space.bsize < (256 + 4 * 16) * 1024 * 1024) {
        throw new ReportError(507, 'INSUFFICIENT_STORAGE', 'Armazenamento temporariamente indisponível.');
    }
}

export async function checkCategory(tx: Prisma.TransactionClient, categoryId: string) {
    // Archiving waits until every publication using this category has committed.
    const [category] = await tx.$queryRaw<{ archived: boolean }[]>`SELECT archived FROM report_categories WHERE id = ${categoryId} FOR SHARE`;
    if (!category) throw new ReportError(422, 'VALIDATION_ERROR', 'Escolha uma categoria cadastrada.');
    if (category.archived) throw new ReportError(409, 'CATEGORY_ARCHIVED', 'Categoria arquivada. Escolha outra categoria.');
}

export async function savePhotos(folder: string, input: Awaited<ReturnType<typeof parseUpload>>['photos'], written?: string[]) {
    const photos: { id: string; position: number; width: number; height: number; byteSize: number }[] = [];
    for (const [position, photo] of input.entries()) {
        const photoId = randomUUID();
        await writeFile(join(folder, photoId + '.jpg'), photo.data, { flag: 'wx', mode: 0o600 });
        written?.push(photoId);
        await writeFile(join(folder, thumbnailFile(photoId)), photo.thumbnail, { flag: 'wx', mode: 0o600 });
        photos.push({ id: photoId, position, width: photo.width, height: photo.height, byteSize: photo.data.length });
    }
    return photos;
}

export function createReportStore(db: Database, root: string) {
    return {
        async publish(authorId: string, input: Awaited<ReturnType<typeof parseUpload>>, initialize?: (tx: Prisma.TransactionClient, reportId: string) => Promise<void>) {
            const { metadata, requestHash } = input;
            const lookup = { authorId_clientRequestId: { authorId, clientRequestId: metadata.clientRequestId } };
            const replay = async (row: { id: string; requestHash: string }) => {
                if (row.requestHash !== requestHash) throw new ReportError(409, 'IDEMPOTENCY_CONFLICT', 'Este envio já foi usado com outros dados.');
                return { status: 200, data: await readDetail(db, row.id, { id: authorId, role: 'CITIZEN' }) };
            };
            const prior = await db.report.findUnique({ where: lookup, select: { id: true, requestHash: true } });
            if (prior) return replay(prior);
            const profiles = await readPublicProfiles(db, metadata.showIdentity ? [authorId] : []);
            if (metadata.showIdentity && !profiles.has(authorId)) throw new ReportError(409, 'PROFILE_UNAVAILABLE', 'O perfil da conta ainda precisa ser provisionado.');
            const id = randomUUID();
            const folder = join(root, id);
            await mkdir(root, { recursive: true });
            await checkUploadSpace(root);
            await mkdir(folder, { mode: 0o700 });
            let attemptingCommit = false;
            try {
                const photos = await savePhotos(folder, input.photos);
                const { location, ...fields } = metadata;
                attemptingCommit = true;
                const row = await db.$transaction(async (tx) => {
                    await checkCategory(tx, metadata.category);
                    const created = await tx.report.create({
                        data: {
                            ...fields,
                            id,
                            authorId,
                            requestHash,
                            latitude: location.latitude,
                            longitude: location.longitude,
                            locationSource: location.source,
                            photos: { create: photos },
                            events: { create: { type: 'CREATED', actorId: authorId, toStatus: 'SENT' } },
                        },
                        include: detailRelations(authorId),
                    });
                    if (!initialize) return created;
                    await initialize(tx, created.id);
                    return tx.report.findUniqueOrThrow({ where: { id: created.id }, include: detailRelations(authorId) });
                });
                return { status: 201, data: detail(row, authorId, profiles) };
            } catch (error) {
                // A dropped database response can follow a committed transaction.
                // Preserve files until the outcome is known.
                const committed = attemptingCommit ? await db.report.findUnique({ where: lookup, select: { id: true, requestHash: true } }) : null;
                if (committed?.id !== id) await rm(folder, { recursive: true, force: true });
                if (committed) return replay(committed);
                throw error;
            }
        },
        get(id: string, viewer: { id: string; role: Role }) {
            return readDetail(db, id, viewer);
        },
        list(viewerId: string, query: ReportQuery) {
            return db.$transaction(
                async (tx) => {
                    const { ids, page } = await reportIds(tx, viewerId, query);
                    const rows = await tx.report.findMany({ where: { id: { in: ids } }, include: relations(viewerId) });
                    const profiles = await readPublicProfiles(
                        tx,
                        rows.filter((row) => row.showIdentity).map((row) => row.authorId),
                    );
                    const byId = new Map(rows.map((row) => [row.id, summary(row, viewerId, profiles)]));
                    return { data: ids.map((id) => byId.get(id)!), page };
                },
                { isolationLevel: 'RepeatableRead' },
            );
        },
        markers(viewerId: string, query: Omit<ReportQuery, 'scope'>) {
            return db.$transaction(
                async (tx) => {
                    const { ids, page } = await reportIds(tx, viewerId, { ...query, scope: 'feed' });
                    const rows = await tx.report.findMany({ where: { id: { in: ids } }, select: { id: true, latitude: true, longitude: true, category: true, categoryDefinition: { select: { name: true } }, status: true, _count: { select: { confirmations: true } } } });
                    const byId = new Map(rows.map(({ _count, categoryDefinition, ...row }) => [row.id, { ...row, categoryName: categoryDefinition.name, confirmationCount: _count.confirmations } satisfies ReportMarker]));
                    return { data: ids.map((id) => byId.get(id)!), page };
                },
                { isolationLevel: 'RepeatableRead' },
            );
        },
    };
}
