import { usePanelLoading } from './panel-loading';
import { categoryIconFor, type ManagementOverview, type ManagementQueuePage } from '@mycity/contracts';
import { useLiveQuery } from './use-live-query';
import { OverviewPanel, RecentReports } from './prototype/overview-panel';

function RecentQueue({ categories, onSessionExpired }: { categories: ManagementOverview['categories']; onSessionExpired: () => void }) {
    const query = useLiveQuery<ManagementQueuePage>('/api/v1/reports/queue?ordem=recentes&limit=3', onSessionExpired);
    const rows = (query.data?.data ?? []).map((row) => ({ ...row, categoryIcon: categoryIconFor(row.category, categories.find((c) => c.id === row.category)?.icon), photo: row.coverPhotoId ? '/api/v1/reports/' + encodeURIComponent(row.id) + '/photos/' + encodeURIComponent(row.coverPhotoId) : undefined }));
    return (
        <RecentReports
            rows={rows}
            feedback={
                query.failed ? (
                    <p role="alert">
                        Não foi possível atualizar os registros. <button onClick={query.refresh}>Tentar novamente</button>
                    </p>
                ) : (
                    !query.data && <p role="status">Carregando registros…</p>
                )
            }
        />
    );
}
export function ManagerOverview({ onSessionExpired }: { onSessionExpired: () => void }) {
    const query = useLiveQuery<{ data: ManagementOverview }>('/api/v1/reports/overview', onSessionExpired);
    const overview = query.data?.data;
    usePanelLoading(!overview && !query.failed);
    const byCategory = new Map(overview?.categories.map((c) => [c.id, c]));
    const ranked = overview?.categories.map((category) => ({ ...category, icon: categoryIconFor(category.id, category.icon) })) ?? [];
    const priorities =
        overview?.priorities.map((row) => {
            const group = byCategory.get(row.category);
            return { ...row, categoryName: group?.name ?? row.category, categoryIcon: categoryIconFor(row.category, group?.icon), count: row.confirmationCount, photo: row.photoPath };
        }) ?? [];
    const oldest = overview?.oldest && { id: overview.oldest.id, days: Math.max(0, Math.floor((Date.now() - Date.parse(overview.oldest.createdAt)) / 86400000)) };
    return (
        <main aria-label="Visão geral">
            {!overview && <h1>Visão geral</h1>}
            {query.failed && (
                <p role="alert">
                    Não foi possível atualizar a visão geral.{' '}
                    <button type="button" onClick={query.refresh}>
                        Tentar novamente
                    </button>
                </p>
            )}
            {overview && <OverviewPanel counts={overview.counts} ranked={ranked} oldest={oldest ?? undefined} priorities={priorities} recent={<RecentQueue categories={overview.categories} onSessionExpired={onSessionExpired} />} />}
        </main>
    );
}
