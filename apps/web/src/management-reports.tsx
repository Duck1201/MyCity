import { usePhotoExpiry } from './use-photo-expiry';
import { usePanelLoading, usePanelVisible } from './panel-loading';
import { useLayoutEffect, useRef, useState } from 'react';
import { categoryIconFor, managementQueueSchema, type ManagementQueuePage } from '@mycity/contracts';
import { useCategoryCatalog } from './category-catalog';
import { QueueLoading } from './components/queue-loading';
import { navigate, queueUrl, useLocation } from './navigation';
import { QueueLayout, queuePageSize, ReportTable } from './queue-presentation';
import { useLiveQuery } from './use-live-query';
import './queue-filters.css';
import './queue.css';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });
export function ManagementReports({ onSessionExpired }: { onSessionExpired: () => void }) {
    const location = useLocation();
    const params = location.searchParams;
    const category = params.get('category') ?? '';
    const status = params.get('status') ?? '';
    const term = params.get('q') ?? '';
    const order = params.get('ordem') ?? 'prioridade';
    const start = params.get('de') ?? params.get('dia') ?? '';
    const end = params.get('ate') ?? params.get('dia') ?? '';
    const invalidPeriod = !!(start && end && end < start);
    const filters = new URLSearchParams();
    for (const [key, value] of Object.entries({ category, status, q: term, ordem: order === 'prioridade' ? '' : order, de: start, ate: end })) if (value) filters.set(key, value);
    const request = new URLSearchParams(filters);
    request.set('limit', String(queuePageSize));
    const number = params.get('pagina');
    if (number) request.set('pagina', number);
    const valid = managementQueueSchema.safeParse(Object.fromEntries(request)).success;
    const endpoint = '/api/v1/reports/queue?' + request;
    const query = useLiveQuery<ManagementQueuePage>(valid ? endpoint : null, onSessionExpired);
    const categoryQuery = useCategoryCatalog(onSessionExpired);
    const catalog = (categoryQuery.data?.data ?? []).map((item) => ({ ...item, icon: categoryIconFor(item.id, item.icon) }));
    const data = valid ? (query.data ?? query.previousData) : undefined;
    usePanelLoading(valid && !data && !query.failed);
    const changing = valid && !query.data && !!query.previousData && !query.failed;
    const { hidden } = usePhotoExpiry(data?.data);
    const rows = data?.data.map((row) => ({
        ...row,
        count: row.confirmationCount,
        photo: row.coverPhotoId && !hidden(row.photosExpireAt) ? { image: '/api/v1/reports/' + encodeURIComponent(row.id) + '/photos/' + encodeURIComponent(row.coverPhotoId) + '/thumb' } : undefined,
        address: row.latitude + ', ' + row.longitude,
        date: dateFormat.format(new Date(row.createdAt)),
        categoryIcon: categoryIconFor(row.category, catalog.find((item) => item.id === row.category)?.icon),
    }));
    const [wasReset, setWasReset] = useState(false);
    const visible = usePanelVisible();
    const focusStamp = useRef('');
    useLayoutEffect(() => {
        if (!visible) return;
        const id: unknown = history.state?.focus;
        if (typeof id !== 'string' || !id || focusStamp.current === location.href + '|' + id) return;
        if (id.startsWith('open-') && !query.data && !query.failed) return;
        const target = document.getElementById(id);
        ((target && !(target instanceof HTMLButtonElement && target.disabled) ? target : null) ?? document.getElementById('central'))?.focus({ preventScroll: true });
        if (id.startsWith('open-')) target?.closest('tr')?.scrollIntoView?.({ block: 'nearest' });
        focusStamp.current = location.href + '|' + id;
    }, [location.href, query.data, query.failed, visible]);
    function apply(changes: Record<string, string>, focus: string, replace = false) {
        setWasReset(false);
        const next = Object.fromEntries(params);
        delete next.pagina;
        navigate(queueUrl({ ...next, ...changes }), focus, replace);
    }
    const page = data?.page ?? 1;
    const pages = Math.max(1, Math.ceil((data?.total ?? 0) / queuePageSize));
    function changePage(next: number, direction: 'next' | 'previous') {
        const focus = next === 1 ? 'next' : next === pages ? 'previous' : direction;
        apply({ pagina: String(next) }, 'queue-page-' + focus);
    }
    return (
        <main className="live-management" aria-label="Gestão de denúncias">
            <QueueLayout
                total={data?.total}
                changing={changing}
                page={page}
                pages={pages}
                changePage={changePage}
                exportAction={{ href: query.data?.total && valid ? '/api/v1/reports/queue.csv?' + filters : undefined }}
                filters={{
                    status,
                    category,
                    term,
                    start,
                    end,
                    order,
                    catalog,
                    invalidPeriod,
                    apply,
                    wasReset,
                    placeholder: 'Protocolo, relato ou coordenadas',
                    counts: data?.counts,
                    clear: () => {
                        setWasReset(true);
                        navigate('/atendimento', 'preview-category');
                    },
                }}
            >
                {categoryQuery.failed && (
                    <p role="alert" className="empty">
                        Não foi possível atualizar as categorias. <button onClick={categoryQuery.refresh}>Tentar novamente</button>
                    </p>
                )}
                {!valid ? (
                    <p className="empty" id="period-error" role="alert">
                        {invalidPeriod ? 'A data final deve ser igual ou posterior à inicial.' : 'Confira os filtros ou limpe a consulta.'}
                    </p>
                ) : (
                    <>
                        {query.failed && (
                            <p role="alert" className="empty">
                                Não foi possível atualizar a lista de denúncias. <button onClick={query.refresh}>Tentar novamente</button>
                            </p>
                        )}
                        {changing && (
                            <span className="sr-only" role="status" aria-label="Atualizando fila">
                                Atualizando a fila…
                            </span>
                        )}
                        {!data && !query.failed && <QueueLoading kind="queue" />}
                        {rows?.length ? <ReportTable rows={rows} busy={changing} /> : data && <p className="empty">{filters.size ? 'Nenhuma denúncia corresponde aos filtros.' : 'Nenhuma denúncia recebida.'}</p>}
                    </>
                )}
            </QueueLayout>
        </main>
    );
}
