import { managerVisibleSql } from './management-visibility.js';
import { createHash } from 'node:crypto';
import { csvLine, type ManagementQueuePage, type ManagementQueueRequest, type ManagementQueueRow, type QueueFilters, type ReportStatusCounts } from '@mycity/contracts';
import { Prisma } from '../../generated/prisma/client.js';
import type { Database } from '../../database.js';
import { photosAvailable } from './rules.js';

const active = Prisma.sql`r.status IN ('sent','under_review','in_progress')`;
const zone = 'America/Sao_Paulo';
function matching(filters: QueueFilters) {
    const conditions: Prisma.Sql[] = [managerVisibleSql];
    if (filters.category) conditions.push(Prisma.sql`r.category=${filters.category}`);
    if (filters.de) conditions.push(Prisma.sql`r.created_at >= (${filters.de}::date::timestamp AT TIME ZONE ${zone} AT TIME ZONE 'UTC')`);
    if (filters.ate) conditions.push(Prisma.sql`r.created_at < ((${filters.ate}::date+1)::timestamp AT TIME ZONE ${zone} AT TIME ZONE 'UTC')`);
    const words =
        filters.q
            ?.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean) ?? [];
    for (const word of words) conditions.push(Prisma.sql`strpos(translate(lower(concat_ws(' ',r.id,r.description,r.latitude,r.longitude)), 'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'),${word})>0`);
    return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

const names = { SENT: 'Enviado', UNDER_REVIEW: 'Em análise', IN_PROGRESS: 'Em andamento', RESOLVED: 'Resolvido', REJECTED: 'Rejeitado', CANCELED: 'Cancelado' };
const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: zone });
type Row = Omit<ManagementQueueRow, 'createdAt' | 'photosExpireAt'> & { createdAt: Date; photosExpireAt: Date | null };
function rows(filters: QueueFilters, where: Prisma.Sql, page: Prisma.Sql) {
    const status = filters.status === 'pending' ? active : filters.status ? Prisma.sql`r.status=${filters.status.toLowerCase()}::report_status` : Prisma.sql`true`;
    const order = filters.ordem === 'recentes' ? Prisma.sql`r.created_at DESC,r.id DESC` : filters.ordem === 'antigas' ? Prisma.sql`r.created_at ASC,r.id ASC` : Prisma.sql`CASE WHEN ${active} THEN 0 ELSE 1 END, CASE WHEN ${active} THEN v.n END DESC, CASE WHEN ${active} THEN r.created_at END ASC, CASE WHEN NOT (${active}) THEN r.created_at END DESC,r.id ASC`;
    return Prisma.sql`WITH matches AS (SELECT r.* FROM reports r ${where})
      SELECT r.id,r.category,c.name AS "categoryName",r.description,r.latitude,r.longitude,upper(r.status::text) AS status,
        r.created_at AS "createdAt", r.photos_expire_at AS "photosExpireAt", v.n AS "confirmationCount",(SELECT id FROM report_photos p WHERE p.report_id=r.id ORDER BY position LIMIT 1) AS "coverPhotoId"
      FROM matches r JOIN report_categories c ON c.id=r.category
      CROSS JOIN LATERAL (SELECT count(*)::integer AS n FROM report_confirmations WHERE report_id=r.id) v
      WHERE ${status} ORDER BY ${order} ${page}`;
}
export async function managementQueue(db: Database, filters: ManagementQueueRequest): Promise<ManagementQueuePage> {
    const where = matching(filters);
    return db.$transaction(
        async (tx) => {
            const groups = await tx.$queryRaw<{ status: keyof ReportStatusCounts; count: number }[]>`SELECT upper(r.status::text) AS status,count(*)::integer AS count FROM reports r ${where} GROUP BY r.status`;
            const counts: ReportStatusCounts = { SENT: 0, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 };
            for (const group of groups) counts[group.status] = group.count;
            const total = filters.status === 'pending' ? counts.SENT + counts.UNDER_REVIEW + counts.IN_PROGRESS : filters.status ? counts[filters.status] : Object.values(counts).reduce((sum, n) => sum + n, 0);
            const page = Math.min(filters.pagina, Math.max(1, Math.ceil(total / filters.limit)));
            const result = await tx.$queryRaw<Row[]>(rows(filters, where, Prisma.sql`LIMIT ${filters.limit} OFFSET ${(page - 1) * filters.limit}`));
            return { counts, total, page, data: result.map(({ photosExpireAt, coverPhotoId, ...row }) => ({ ...row, createdAt: row.createdAt.toISOString(), ...(photosExpireAt && { photosExpireAt: photosExpireAt.toISOString() }), coverPhotoId: photosAvailable(photosExpireAt) ? coverPhotoId : null })) };
        },
        { isolationLevel: 'RepeatableRead' },
    );
}
async function* csvChunks(tx: Prisma.TransactionClient, signal: AbortSignal) {
    yield '\uFEFF' + csvLine(['Protocolo', 'Categoria', 'Relato', 'Latitude', 'Longitude', 'Situação', 'Data de registro', 'Confirmações']);
    for (;;) {
        signal.throwIfAborted();
        const batch = await tx.$queryRaw<Row[]>`FETCH FORWARD 128 FROM queue_export`;
        if (!batch.length) return;
        yield batch.map((row) => '\r\n' + csvLine([row.id, row.categoryName, row.description, row.latitude, row.longitude, names[row.status], dateFormat.format(row.createdAt), row.confirmationCount])).join('');
    }
}

export async function managementCsv(db: Database, filters: QueueFilters, signal: AbortSignal, send: (etag: string, chunks: AsyncIterable<string>) => Promise<void>) {
    await db.$transaction(
        async (tx) => {
            await tx.$executeRaw`DECLARE queue_export SCROLL CURSOR FOR ${rows(filters, matching(filters), Prisma.empty)}`;
            // Rewind the same snapshot to send the exact bytes validated by the ETag.
            const hash = createHash('sha256');
            for await (const chunk of csvChunks(tx, signal)) hash.update(chunk);
            await tx.$executeRaw`MOVE ABSOLUTE 0 FROM queue_export`;
            await send('"' + hash.digest('base64url') + '"', csvChunks(tx, signal));
        },
        { timeout: 300_000, isolationLevel: 'RepeatableRead' },
    );
}
