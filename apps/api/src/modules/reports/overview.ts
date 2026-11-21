import { managerVisibleReports } from './management-visibility.js';
import type { ManagementOverview, ReportStatus } from '@mycity/contracts';
import { categoryIconFor } from '@mycity/contracts';
import type { Database } from '../../database.js';
import { photosAvailable } from './rules.js';

const pending: ReportStatus[] = ['SENT', 'UNDER_REVIEW', 'IN_PROGRESS'];

export function managementOverview(db: Database): Promise<ManagementOverview> {
    return db.$transaction(
        async (tx) => {
            const groups = await tx.report.groupBy({ by: ['status', 'category'], where: managerVisibleReports, _count: { _all: true } });
            const counts: ManagementOverview['counts'] = { SENT: 0, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 };
            const pendingByCategory = new Map<string, number>();
            for (const { status, category, _count } of groups) {
                counts[status] += _count._all;
                if (pending.includes(status)) pendingByCategory.set(category, (pendingByCategory.get(category) ?? 0) + _count._all);
            }
            const catalog = await tx.reportCategoryDefinition.findMany({ select: { id: true, name: true, archived: true, icon: true } });
            const where = { status: { in: pending } };
            const oldest = await tx.report.findFirst({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, createdAt: true } });
            const rows = await tx.report.findMany({
                where,
                orderBy: [{ confirmations: { _count: 'desc' } }, { createdAt: 'asc' }, { id: 'asc' }],
                take: 3,
                select: { id: true, description: true, category: true, status: true, createdAt: true, photosExpireAt: true, _count: { select: { confirmations: true } }, photos: { orderBy: { position: 'asc' }, take: 1, select: { id: true } } },
            });
            return {
                counts,
                oldest: oldest && { id: oldest.id, createdAt: oldest.createdAt.toISOString() },
                categories: catalog.map(({ id, name, archived, icon }) => ({ id, name, archived, icon: categoryIconFor(id, icon), count: pendingByCategory.get(id) ?? 0 })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id)),
                priorities: rows.map(({ id, description, category, status, createdAt, photosExpireAt, _count, photos }) => ({ id, description, category, status, confirmationCount: _count.confirmations, createdAt: createdAt.toISOString(), ...(photosAvailable(photosExpireAt) && photos[0] && { photoPath: '/api/v1/reports/' + id + '/photos/' + photos[0].id + '/thumb' }) })),
            };
        },
        { isolationLevel: 'RepeatableRead' },
    );
}
