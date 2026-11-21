import { overviewEndpoint, recentReportsEndpoint } from './queue-endpoint';
import { usePanelLoading } from './panel-loading';
import { categoryIconFor, type ManagementOverview, type ManagementQueuePage } from '@mycity/contracts';
import { useLiveQuery } from './use-live-query';
import { OverviewPanel, RecentReports } from './components/overview-panel';

const day = 86_400_000;
const ageLabel = (createdAt: string) => {
    const days = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / day));
    return days === 0 ? 'hoje' : days === 1 ? 'há 1 dia' : 'há ' + days + ' dias';
};

function RecentQueue({ categories, onSessionExpired }: { categories: ManagementOverview['categories']; onSessionExpired: () => void }) {
    const query = useLiveQuery<ManagementQueuePage>(recentReportsEndpoint, onSessionExpired);
    const rows = (query.data?.data ?? []).map((row) => ({ ...row, categoryIcon: categoryIconFor(row.category, categories.find((c) => c.id === row.category)?.icon), photo: row.coverPhotoId ? '/api/v1/reports/' + encodeURIComponent(row.id) + '/photos/' + encodeURIComponent(row.coverPhotoId) + '/thumb' : undefined }));
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
    const query = useLiveQuery<{ data: ManagementOverview }>(overviewEndpoint, onSessionExpired);
    const overview = query.data?.data;
    usePanelLoading(!overview && !query.failed);
    const byCategory = new Map(overview?.categories.map((c) => [c.id, c]));
    const ranked = overview?.categories.map((category) => ({ ...category, icon: categoryIconFor(category.id, category.icon) })) ?? [];
    const priorities =
        overview?.priorities.map((row) => {
            const group = byCategory.get(row.category);
            return { ...row, categoryName: group?.name ?? row.category, categoryIcon: categoryIconFor(row.category, group?.icon), count: row.confirmationCount, photo: row.photoPath, age: ageLabel(row.createdAt) };
        }) ?? [];
    const oldest = overview?.oldest && { id: overview.oldest.id, days: Math.max(0, Math.floor((Date.now() - Date.parse(overview.oldest.createdAt)) / day)) };
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
