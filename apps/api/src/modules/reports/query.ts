import type { ReportCategory, ReportStatus } from '@mycity/contracts';
import { Prisma } from '../../generated/prisma/client.js';
import { ReportError } from './upload.js';

export type ReportQuery = {
    scope: 'feed' | 'mine' | 'resolved' | 'management';
    limit: number;
    sort?: 'newest' | 'priority' | undefined;
    status?: ReportStatus | undefined;
    category?: ReportCategory | undefined;
    cursor?: string | undefined;
    bbox?: { west: number; south: number; east: number; north: number } | undefined;
};

export async function reportIds(tx: Prisma.TransactionClient, viewerId: string, query: ReportQuery) {
    const conditions: Prisma.Sql[] = [];
    if (query.scope === 'mine') conditions.push(Prisma.sql`r.author_id = ${viewerId}`);
    if (query.category) conditions.push(Prisma.sql`r.category = ${query.category}`);
    if (query.status) conditions.push(Prisma.sql`r.status = ${query.status.toLowerCase()}::report_status`);
    const active = Prisma.sql`r.status IN ('sent','under_review','in_progress')`;
    if (query.scope === 'feed' && query.status !== 'RESOLVED') conditions.push(active);
    if (query.scope === 'resolved') conditions.push(Prisma.sql`r.status = 'resolved'`);
    if (query.bbox) {
        const { west, south, east, north } = query.bbox;
        conditions.push(Prisma.sql`r.latitude BETWEEN ${south} AND ${north} AND r.longitude BETWEEN ${west} AND ${east}`);
    }
    const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
    let order = Prisma.sql`r.created_at DESC, r.id DESC`;
    if (query.scope === 'management' && query.sort !== 'newest') {
        order = Prisma.sql`
            CASE WHEN ${active} THEN 0 ELSE 1 END,
            CASE WHEN ${active} THEN (SELECT count(*) FROM report_confirmations c WHERE c.report_id=r.id) END DESC,
            CASE WHEN ${active} THEN r.created_at END ASC,
            CASE WHEN NOT (${active}) THEN r.created_at END DESC,
            r.id ASC`;
    }
    if (query.scope === 'resolved' || (query.scope === 'feed' && query.status === 'RESOLVED')) {
        order = Prisma.sql`COALESCE((SELECT max(e.created_at) FROM report_events e WHERE e.report_id=r.id AND e.type='STATUS_CHANGED' AND e.to_status='resolved'), r.modified_at) DESC, r.id DESC`;
    }
    // Rank only the visible, filtered set. An absent anchor is different from its last page.
    const anchor = query.cursor ? Prisma.sql`(SELECT position FROM ranked WHERE id=${query.cursor})` : Prisma.sql`0`;
    const rows = await tx.$queryRaw<{ id: string | null; valid: boolean }[]>`
        WITH ranked AS (
            SELECT r.id, row_number() OVER (ORDER BY ${order}) AS position
            FROM reports r ${where}
        ), anchor AS (SELECT ${anchor} AS position)
        SELECT page.id, anchor.position IS NOT NULL AS valid
        FROM anchor LEFT JOIN LATERAL (
            SELECT id, position FROM ranked WHERE position > anchor.position
            ORDER BY position LIMIT ${query.limit + 1}
        ) AS page ON true ORDER BY page.position
    `;
    if (!rows[0]?.valid) throw new ReportError(400, 'INVALID_CURSOR', 'Página inválida.');
    const ids = rows.flatMap((row) => (row.id ? [row.id] : []));
    return { ids: ids.slice(0, query.limit), page: { nextCursor: ids.length > query.limit ? ids[query.limit - 1]! : null } };
}
