import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChartNoAxesColumnIncreasing, Inbox, LayoutGrid } from 'lucide-react';
import { previewPeer, readDemoConfirmations, readDemoTrail, writeDemoStatus, watchDemoConfirmations } from './confirmation-store';
import { categories, records, statusEvent } from './demo';
import { animateNavigation } from '../navigation-motion';
import { ManagerAccount, ManagerFrame } from '../manager-shell';
import { QueueLoading } from '../components/queue-loading';
import './preview-shell.css';
import { Overview, Queue } from './overview';
import { Detail } from './detail';
import { Catalog } from './catalog';
import { Link, useLocation } from './navigation';

const destinations = [
    { key: 'visao-geral', title: 'Visão geral', icon: ChartNoAxesColumnIncreasing },
    { key: 'atendimento', title: 'Atendimento', icon: Inbox },
    { key: 'categorias', title: 'Categorias', icon: LayoutGrid },
];
export function PrototypeConsole() {
    const [closed, setClosed] = useState(false);
    useEffect(() => {
        if (closed) document.title = 'Prévia encerrada · MyCity';
    }, [closed]);
    if (closed)
        return (
            <main className="preview-exit">
                <h1>Prévia encerrada</h1>
                <button
                    autoFocus
                    onClick={() => {
                        history.replaceState(null, '', '/visao-geral');
                        setClosed(false);
                    }}
                >
                    Abrir painel demonstrativo
                </button>
            </main>
        );
    return <PreviewWorkspace leave={() => setClosed(true)} />;
}
function PreviewWorkspace({ leave }: { leave: () => void }) {
    const location = useLocation();
    const [rows, setRows] = useState(records);
    const [items, setItems] = useState(categories);
    const [mode, setMode] = useState('normal');
    const [, section, id] = location.pathname.split('/');
    const destination = destinations.find((item) => item.key === section) ?? destinations[0]!;
    useEffect(() => {
        const prefix = id && section === 'atendimento' ? id + ' · ' : '';
        document.title = prefix + destination.title + ' · MyCity';
    }, [destination.title, id, section]);
    const [confirmed, setConfirmed] = useState<number[]>([]);
    useEffect(() => {
        if (!previewPeer('8093')) return;
        function refresh() {
            try {
                setConfirmed(readDemoConfirmations());
                setRows((previous) =>
                    previous.map((row) => {
                        const steps = readDemoTrail(row.protocol);
                        if (!steps) return row;
                        const trail = steps.map((step) => step.status);
                        if (trail.join() === row.statusTrail.join()) return row;
                        const start = row.statusTrail.every((v, i) => trail[i] === v) ? row.statusTrail.length : 0;
                        const events = steps.slice(start).map(({ status, reason }, i) => ({ kind: 'status' as const, text: statusEvent(status, trail[start + i - 1], reason) }));
                        return { ...row, status: trail.at(-1)!, statusTrail: trail, events: [...row.events, ...events] };
                    }),
                );
            } catch {
                // Storage is optional for an isolated preview.
            }
        }
        const stop = watchDemoConfirmations(refresh);
        refresh();
        return stop;
    }, []);
    const dataset =
        mode === 'empty'
            ? []
            : rows.map((row) => {
                  const category = items.find((item) => item.id === row.category);
                  return { ...row, categoryName: category?.name ?? row.categoryName, categoryIcon: category?.icon ?? row.categoryIcon, count: row.count + Number(confirmed.includes(row.protocol)) };
              });
    function updateReport(next: (typeof records)[number], reason?: string) {
        const changed = next.status !== next.statusTrail.at(-1);
        if (changed && previewPeer('8093')) {
            try {
                if (!writeDemoStatus(next.protocol, next.status, reason)) return false;
            } catch {
                /* Storage is optional for the local preview. */
            }
        }
        setRows((previous) => previous.map((row) => (row.id !== next.id ? row : { ...next, count: row.count, statusTrail: changed ? [...next.statusTrail, next.status] : next.statusTrail })));
        return true;
    }
    const record = dataset.find((row) => row.id === id);
    useEffect(() => {
        if (['/', '/prototipo.html'].includes(window.location.pathname)) {
            const old = window.location.hash.slice(1);
            history.replaceState(null, '', '/' + (destinations.some((item) => item.key === old) ? old : 'visao-geral'));
            window.dispatchEvent(new Event('popstate'));
        }
    }, []);
    const previousView = useRef({ destination, id });
    const content = useRef<HTMLElement>(null);
    useLayoutEffect(() => {
        const previous = previousView.current;
        previousView.current = { destination, id };
        if (previous.destination === destination && previous.id === id) return;
        const laterSection = destinations.indexOf(destination) > destinations.indexOf(previous.destination);
        const transform = id ? 'translateX(24px)' : previous.id ? 'translateX(-24px)' : laterSection ? 'translateY(16px)' : 'translateY(-16px)';
        return animateNavigation(content.current, transform);
    }, [destination, id]);
    const href = location.href;
    useLayoutEffect(() => {
        const bookmark = history.state;
        const focus = bookmark?.focus && document.getElementById(bookmark.focus);
        (focus || document.getElementById('content'))?.focus({ preventScroll: true });
        if (bookmark?.scroll || window.scrollY) window.scrollTo(0, bookmark?.scroll || 0);
    }, [href]);
    return (
        <div className="preview-shell">
            <a
                className="skip"
                href="#content"
                onClick={(event) => {
                    event.preventDefault();
                    content.current?.focus();
                }}
            >
                Ir para o conteúdo
            </a>
            <ManagerFrame
                renderBrandLink={(brand, close) => (
                    <Link className="desk-brand-home" aria-label="MyCity — Visão geral" href="/visao-geral" onClick={close}>
                        {brand}
                    </Link>
                )}
                focusDestination={() => content.current?.focus({ preventScroll: true })}
                renderNavigation={(close) => (
                    <>
                        <nav className="desk-links" aria-label="Administração">
                            {destinations.map(({ key, title, icon: Icon }) => (
                                <Link href={'/' + key} key={key} className="desk-link" aria-label={title} title={title} aria-current={destination.key === key ? 'page' : undefined} onClick={close}>
                                    <Icon aria-hidden="true" />
                                    <span className="desk-copy">{title}</span>
                                </Link>
                            ))}
                        </nav>
                        <ManagerAccount leave={leave} />
                    </>
                )}
            >
                <div className="console preview-workspace">
                    <main id="content" ref={content} tabIndex={-1}>
                        {mode === 'loading' ? (
                            <section className="panel feedback" aria-busy="true">
                                <h1>{destination.title}</h1>
                                {destination.key === 'atendimento' ? (
                                    <QueueLoading kind={id ? 'detail' : 'queue'} />
                                ) : (
                                    <>
                                        <p role="status">Carregando dados…</p>
                                        <div className="skeleton" />
                                        <div className="skeleton" />
                                    </>
                                )}
                            </section>
                        ) : mode === 'error' ? (
                            <section className="panel feedback">
                                <h1>{destination.title}</h1>
                                <p role="alert">Não foi possível carregar os dados.</p>
                                <button
                                    onClick={() => {
                                        setMode('normal');
                                        document.getElementById('content')?.focus();
                                    }}
                                >
                                    Tentar novamente
                                </button>
                            </section>
                        ) : destination.key === 'categorias' ? (
                            <Catalog items={items} change={setItems} rows={dataset} />
                        ) : destination.key === 'atendimento' && id ? (
                            record ? (
                                <Detail key={record.id} row={record} update={updateReport} />
                            ) : (
                                <section className="panel feedback">
                                    <h1>Denúncia indisponível</h1>
                                    <Link href="/atendimento">Voltar ao atendimento</Link>
                                </section>
                            )
                        ) : destination.key === 'atendimento' ? (
                            <Queue rows={dataset} catalog={items} location={location} />
                        ) : (
                            <Overview rows={dataset} catalog={items} />
                        )}
                    </main>
                    <footer className="preview-tools">
                        <label className="preview">
                            Estado da prévia
                            <select value={mode} onChange={(e) => setMode(e.target.value)}>
                                <option value="normal">Dados demonstrativos</option>
                                <option value="loading">Carregamento</option>
                                <option value="empty">Sem ocorrências</option>
                                <option value="error">Falha de consulta</option>
                            </select>
                        </label>
                    </footer>
                </div>
            </ManagerFrame>
        </div>
    );
}
