import type { ReportStatusCounts } from '@mycity/contracts';
import { pending, priority, type Category, type DemoRecord } from './demo';
import { OverviewPanel, RecentReports } from './overview-panel';

export function Overview({ rows, catalog }: { rows: DemoRecord[]; catalog: Category[] }) {
    const counts: ReportStatusCounts = { SENT: 0, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 };
    const totals = new Map<string, number>();
    const active = rows.filter((row) => pending(row.status)).sort(priority);
    for (const row of rows) counts[row.status]++;
    for (const row of active) totals.set(row.category, (totals.get(row.category) ?? 0) + 1);
    const oldest = active.reduce<DemoRecord | undefined>((record, row) => (!record || row.days > record.days ? row : record), undefined);
    const ranked = catalog.map((category) => ({ ...category, count: totals.get(category.id) ?? 0 })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
    return (
        <OverviewPanel
            counts={counts}
            oldest={oldest}
            ranked={ranked}
            recent={
                <RecentReports
                    rows={[...rows]
                        .sort((a, b) => a.days - b.days || b.id.localeCompare(a.id))
                        .slice(0, 3)
                        .map((row) => ({ ...row, photo: row.photo.image }))}
                />
            }
            priorities={active.slice(0, 3).map((row) => ({ ...row, photo: row.photo.image }))}
        />
    );
}
