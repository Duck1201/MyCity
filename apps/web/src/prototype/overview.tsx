export { Overview } from './overview-dashboard';
export { Status } from '../queue-presentation';
import { QueueLayout, queuePageSize, ReportTable } from '../queue-presentation';
import { pending, priority, type Category, type DemoRecord } from './demo';
import { queueUrl, navigate } from './navigation';
import { exportQueue } from './queue-export';
import '../queue-filters.css';
import './queue.css';
function searchable(text: string) {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
}

export function Queue({ rows, location, catalog }: { rows: DemoRecord[]; location: URL; catalog: Category[] }) {
    const params = location.searchParams;
    const status = params.get('status') ?? '';
    const category = params.get('category') ?? '';
    const term = params.get('q') ?? '';
    const start = params.get('de') ?? params.get('dia') ?? '';
    const end = params.get('ate') ?? params.get('dia') ?? '';
    const order = params.get('ordem') ?? 'prioridade';
    const invalidPeriod = !!(start && end && end < start);
    const terms = searchable(term).trim().split(/\s+/).filter(Boolean);
    const filtered = rows
        .filter((row) => {
            if (invalidPeriod || (start && row.registeredDay < start) || (end && row.registeredDay > end)) return false;
            if (category && row.category !== category) return false;
            if (status && !(status === 'pending' ? pending(row.status) : row.status === status)) return false;
            const text = searchable([row.id, row.id.replace('-', ''), row.address, row.description].join(' '));
            return terms.every((word) => text.includes(word));
        })
        .sort((a, b) => {
            if (order === 'antigas') return a.registeredDay.localeCompare(b.registeredDay) || a.id.localeCompare(b.id);
            if (order === 'recentes') return b.registeredDay.localeCompare(a.registeredDay) || b.id.localeCompare(a.id);
            return priority(a, b);
        });
    const pages = Math.max(1, Math.ceil(filtered.length / queuePageSize));
    const requested = Number(params.get('pagina'));
    const page = Number.isSafeInteger(requested) ? Math.min(pages, Math.max(1, requested)) : 1;
    function apply(changes: Record<string, string>, focus: string, replace = false) {
        const next = Object.fromEntries(params);
        delete next.pagina;
        navigate(queueUrl({ ...next, ...changes }), focus, replace);
    }
    function changePage(target: number, direction: 'previous' | 'next') {
        const focus = target === 1 ? 'next' : target === pages ? 'previous' : direction;
        apply({ pagina: String(target) }, 'queue-page-' + focus);
    }
    return (
        <QueueLayout total={filtered.length} page={page} pages={pages} changePage={changePage} exportAction={{ run: () => exportQueue(filtered) }} filters={{ status, category, term, start, end, order, catalog, invalidPeriod, apply, clear: () => navigate('/atendimento', 'preview-category'), placeholder: 'Protocolo, endereço ou relato' }}>
            {invalidPeriod ? (
                <p id="period-error" role="alert" className="empty">
                    A data final deve ser igual ou posterior à inicial.
                </p>
            ) : filtered.length ? (
                <ReportTable showProtocol rows={filtered.slice((page - 1) * queuePageSize, page * queuePageSize)} />
            ) : (
                <div className="empty">Nenhuma denúncia encontrada.</div>
            )}
        </QueueLayout>
    );
}
