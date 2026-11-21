import type { ReactNode } from 'react';
import { Download, MapPin, Search, ThumbsUp } from 'lucide-react';
import type { ReportStatus, ReportStatusCounts } from '@mycity/contracts';
import { CategorySymbol, type CategoryIcon } from './components/category-symbol';
import { Link } from './navigation';
import { statusKeys, statusNames } from './report-status-labels';
export interface TableRow {
    id: string;
    description: string;
    categoryName: string;
    categoryIcon: CategoryIcon;
    address: string;
    date: string;
    count: number;
    status: ReportStatus;
    photo?: { image: string } | undefined;
}
type FilterProps = { status: string; category: string; term: string; start: string; end: string; order: string; catalog: { id: string; name: string; archived: boolean; icon: CategoryIcon }[]; invalidPeriod: boolean; apply: (changes: Record<string, string>, focus: string, replace?: boolean) => void; clear: () => void; counts?: ReportStatusCounts | undefined; wasReset?: boolean; placeholder: string };
export { queuePageSize } from './queue-endpoint';

type QueueLayoutProps = {
    total?: number | undefined;
    changing?: boolean;
    revalidating?: boolean;
    page: number;
    pages: number;
    changePage: (page: number, direction: 'previous' | 'next') => void;
    filters: FilterProps;
    exportAction: { href?: string | undefined } | { run: () => void };
    children: ReactNode;
};

export function QueueLayout({ total, changing, revalidating, page, pages, changePage, filters, exportAction, children }: QueueLayoutProps) {
    const download = (
        <>
            <Download size={16} aria-hidden="true" /> Exportar CSV
        </>
    );
    return (
        <>
            <header className="page-title queue-heading-tools">
                <div>
                    <h1 tabIndex={-1} id="central">
                        Atendimento
                    </h1>
                    <span className="muted queue-total" aria-live="polite">
                        {total !== undefined && total + (total === 1 ? ' ocorrência' : ' ocorrências')}
                        {(changing || revalidating) && ' · Atualizando…'}
                    </span>
                </div>
                {'run' in exportAction ? (
                    <button type="button" className="queue-export" disabled={!total} onClick={exportAction.run}>
                        {download}
                    </button>
                ) : (
                    <a className="queue-export" aria-disabled={!exportAction.href} href={exportAction.href} download="ocorrencias.csv">
                        {download}
                    </a>
                )}
            </header>
            <section className="panel queue-sheet">
                <QueueFilters {...filters} />
                {children}
                <nav aria-label="Paginação" className="pager">
                    <span aria-live="polite">
                        Página {page} de {pages}
                    </span>
                    <button id="queue-page-previous" disabled={changing || page <= 1} onClick={() => changePage(page - 1, 'previous')}>
                        Anterior
                    </button>
                    <button id="queue-page-next" disabled={changing || page >= pages} onClick={() => changePage(page + 1, 'next')}>
                        Próxima
                    </button>
                </nav>
            </section>
        </>
    );
}

export function Status({ value }: { value: ReportStatus }) {
    return <span className={'status ' + value}>{statusNames[value]}</span>;
}
export function ReportTable({ rows, busy = false }: { rows: TableRow[]; busy?: boolean }) {
    return (
        <div className="table-scroll">
            <table aria-label="Denúncias recebidas" aria-busy={busy}>
                <thead>
                    <tr>
                        <th>Ocorrência</th>
                        <th>Situação</th>
                        <th>Registro</th>
                        <th>Confirmações</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id}>
                            <td>
                                <div className="preview-incident">
                                    {row.photo && <img src={row.photo.image} alt="" loading="lazy" />}
                                    <div>
                                        <Link
                                            id={'open-' + row.id}
                                            href={'/atendimento/' + encodeURIComponent(row.id)}
                                            aria-disabled={busy || undefined}
                                            onClick={(event) => {
                                                if (busy) event.preventDefault();
                                            }}
                                            aria-label={'Abrir denúncia: ' + row.description}
                                            aria-describedby={'queue-meta-' + row.id}
                                            className="preview-row-link"
                                        >
                                            <strong id={'queue-title-' + row.id}>{row.description}</strong>
                                        </Link>
                                        <small className="preview-case-meta" id={'queue-meta-' + row.id}>
                                            <span className="preview-category-label">
                                                <CategorySymbol icon={row.categoryIcon} size={14} />
                                                {row.categoryName}
                                            </span>
                                            <span className="queue-address">
                                                <MapPin size={12} aria-hidden="true" />
                                                {row.address}
                                            </span>
                                        </small>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <Status value={row.status} />
                            </td>
                            <td>
                                <time>{row.date}</time>
                            </td>
                            <td>
                                <span className="inline">
                                    <ThumbsUp size={14} />
                                    {row.count} <span className="sr-only">{row.count === 1 ? 'confirmação' : 'confirmações'}</span>
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function QueueFilters({ status, category, term, start, end, order, catalog, invalidPeriod, apply, clear, counts, wasReset, placeholder }: FilterProps) {
    const selectedCategory = catalog.find((item) => item.id === category);
    return (
        <>
            {' '}
            <div className="queue-search-order">
                <label htmlFor="queue-search">Buscar denúncias</label>
                <label htmlFor="queue-order">Ordenar por</label>
                <div className="queue-search-box">
                    <Search size={17} aria-hidden="true" />
                    <input id="queue-search" type="search" placeholder={placeholder} maxLength={160} value={term} onChange={(e) => apply({ q: e.target.value }, e.target.id, true)} />
                </div>
                <select id="queue-order" value={order} onChange={(e) => apply({ ordem: e.target.value === 'prioridade' ? '' : e.target.value }, e.target.id)}>
                    <option value="prioridade">Prioridade</option>
                    <option value="antigas">Mais antigas</option>
                    <option value="recentes">Mais recentes</option>
                </select>
            </div>
            <div className="filters filter-toolbar">
                <label>
                    <span className="preview-category-label">{selectedCategory && <CategorySymbol icon={selectedCategory.icon} size={14} />}Categoria</span>
                    <select id="preview-category" value={category} onChange={(e) => apply({ category: e.target.value }, e.target.id)}>
                        <option value="">Todas</option>
                        {catalog.map((item) => (
                            <option value={item.id} key={item.id}>
                                {item.name}
                                {item.archived ? ' (arquivada)' : ''}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Situação
                    <select id="preview-status" value={status} onChange={(e) => apply({ status: e.target.value }, e.target.id)}>
                        <option value="">Todas{counts && ' (' + Object.values(counts).reduce((a, b) => a + b, 0) + ')'}</option>
                        <option value="pending">Pendentes</option>
                        {statusKeys.map((key) => (
                            <option key={key} value={key}>
                                {statusNames[key]}
                                {counts && ' (' + counts[key] + ')'}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Data inicial
                    <input id="preview-start" type="date" value={start} max={end || undefined} onChange={(e) => apply({ dia: '', de: e.target.value, ate: end }, e.target.id)} />
                </label>
                <label>
                    Data final
                    <input id="preview-end" type="date" value={end} min={start || undefined} aria-invalid={invalidPeriod || undefined} aria-describedby={invalidPeriod ? 'period-error' : undefined} onChange={(e) => apply({ dia: '', de: start, ate: e.target.value }, e.target.id)} />
                </label>
                <button className="reset-control" type="button" disabled={!status && !category && !start && !end && !term && order === 'prioridade'} onClick={clear}>
                    {wasReset ? 'Filtros limpos' : 'Limpar filtros'}
                </button>
            </div>
        </>
    );
}
