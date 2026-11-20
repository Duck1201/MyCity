import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { ChartNoAxesColumnIncreasing, Inbox, LayoutGrid, LogOut, MapPin, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { PanelStage } from './panel-loading';
import { Link, useLocation } from './navigation';
import './manager-shell.css';

export type QueueNavigation = { section: 'overview' | 'queue' | 'categories'; id?: string };
const destinations = [
    { section: 'overview', href: '/visao-geral', label: 'Visão geral', icon: ChartNoAxesColumnIncreasing },
    { section: 'queue', href: '/atendimento', label: 'Atendimento', icon: Inbox },
    { section: 'categories', href: '/categorias', label: 'Categorias', icon: LayoutGrid },
] as const;

function managerRoute(url: URL): QueueNavigation {
    if (url.pathname === '/' && url.hash === '#atendimento') return { section: 'queue' };
    if (url.pathname === '/categorias' || (url.pathname === '/' && url.hash === '#categorias')) return { section: 'categories' };
    const match = /^\/atendimento(?:\/([^/]+))?\/?$/.exec(url.pathname);
    if (match) return match[1] ? { section: 'queue', id: match[1] } : { section: 'queue' };
    return { section: 'overview' };
}

const preferenceKey = 'mycity.manager.sidebar';
const minWidth = 208;
const maxWidth = 336;
const defaultSize = { width: 258, collapsed: false };
const mobileQuery = '(max-width: 760px)';
const clampWidth = (width: number) => Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
type RailSize = typeof defaultSize;

function readSize(): RailSize {
    try {
        const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? 'null');
        if (saved && Number.isFinite(saved.width) && typeof saved.collapsed === 'boolean') return { width: clampWidth(saved.width), collapsed: saved.collapsed };
    } catch {
        /* Storage is optional in a private browsing context. */
    }
    return defaultSize;
}

function saveSize(size: RailSize) {
    try {
        localStorage.setItem(preferenceKey, JSON.stringify(size));
    } catch {
        /* The in-memory preference still works when storage is unavailable. */
    }
}

function onViewportChange(subscribe: () => void) {
    const media = window.matchMedia?.(mobileQuery);
    media?.addEventListener('change', subscribe);
    return () => media?.removeEventListener('change', subscribe);
}
const isMobile = () => window.matchMedia?.(mobileQuery).matches ?? false;

function Brand() {
    return (
        <div className="desk-brand">
            <span className="desk-brandmark" aria-hidden="true">
                <MapPin />
            </span>
            <span className="desk-brand-copy">
                <strong>MyCity</strong>
                <span>Gestão urbana</span>
            </span>
        </div>
    );
}

function RailItems({ section, onNavigate, leave }: { section: QueueNavigation['section']; onNavigate: () => void; leave: () => void }) {
    return (
        <>
            <nav className="desk-links" aria-label="Navegação do gestor">
                {destinations.map(({ section: key, href, label, icon: Icon }) => (
                    <Link key={key} href={href} className="desk-link" aria-current={key === section ? 'page' : undefined} aria-label={label} title={label} onClick={onNavigate}>
                        <Icon aria-hidden="true" />
                        <span className="desk-copy">{label}</span>
                    </Link>
                ))}
            </nav>
            <ManagerAccount leave={leave} />
        </>
    );
}

export function ManagerAccount({ leave }: { leave: () => void }) {
    return (
        <div className="desk-account">
            <span className="desk-person desk-copy">Gestor público</span>
            <button type="button" title="Sair" aria-label="Sair" className="desk-link desk-exit" onClick={leave}>
                <LogOut aria-hidden="true" />
                <span className="desk-copy">Sair</span>
            </button>
        </div>
    );
}

export function ManagerShell({ children, leave }: { children: (navigation: QueueNavigation) => ReactNode; leave: () => void }) {
    const url = useLocation();
    const navigation = managerRoute(url);
    const section = navigation.section;
    const view = navigation.id ?? section;
    const area = useRef<HTMLDivElement>(null);
    const prior = useRef(view);
    useLayoutEffect(() => {
        document.title = (navigation.id ? navigation.id + ' · ' : '') + destinations.find((item) => item.section === section)!.label + ' · MyCity';
        if (prior.current === view) return;
        prior.current = view;
        const position = history.state?.scroll ?? 0;
        if (position || window.scrollY) window.scrollTo(0, position);
        if (!history.state?.focus) area.current?.focus({ preventScroll: true });
    }, [view, section, navigation.id]);
    return (
        <>
            <a
                className="skip"
                href="#manager-content"
                onClick={(event) => {
                    event.preventDefault();
                    area.current?.focus();
                }}
            >
                Ir para o conteúdo
            </a>
            <ManagerFrame
                renderBrandLink={(brand, close) => (
                    <Link href="/visao-geral" className="desk-brand-home" aria-label="MyCity — Visão geral" onClick={close}>
                        {brand}
                    </Link>
                )}
                focusDestination={() => area.current?.focus({ preventScroll: true })}
                renderNavigation={(close) => <RailItems section={section} onNavigate={close} leave={leave} />}
            >
                <div id="manager-content" className="console manager-content" tabIndex={-1} ref={area}>
                    <PanelStage key={view} offset={navigation.id ? 'translateX(16px)' : 'translateY(10px)'} message={navigation.id ? 'Carregando ocorrência…' : section === 'categories' ? 'Carregando categorias…' : section === 'queue' ? 'Carregando atendimento…' : 'Carregando visão geral…'}>
                        {children(navigation)}
                    </PanelStage>
                </div>
            </ManagerFrame>
        </>
    );
}

export function ManagerFrame({ renderNavigation, renderBrandLink, children, focusDestination }: { renderBrandLink?: (brand: ReactNode, close?: () => void) => ReactNode; renderNavigation: (close: () => void) => ReactNode; children: ReactNode; focusDestination?: () => void }) {
    const [size, setSize] = useState(readSize);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const followedLink = useRef(false);
    const [dragging, setDragging] = useState(false);
    const mobile = useSyncExternalStore(onViewportChange, isMobile, () => false);
    const drag = useRef<{ pointerId: number; startX: number; startWidth: number; width: number } | null>(null);
    const oldEdge = useRef<number | null>(null);
    const body = useRef<HTMLDivElement>(null);
    const surface = useRef<HTMLDivElement>(null);
    const movement = useRef<Animation[]>([]);

    useLayoutEffect(() => {
        // Do not reopen a mobile drawer after a viewport change back from desktop.
        if (!mobile) setDrawerOpen(false);
        drag.current = null;
        setDragging(false);
    }, [mobile]);

    useLayoutEffect(() => {
        const from = oldEdge.current;
        oldEdge.current = null;
        if (from === null || !body.current || !surface.current) return;
        for (const animation of movement.current) animation.cancel();
        const edge = body.current.getBoundingClientRect().left;
        if (!edge || from === edge || !body.current.animate) return;
        const options = { duration: 210, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };
        movement.current = [body.current.animate([{ transform: 'translateX(' + (from - edge) + 'px)' }, { transform: 'translateX(0)' }], options), surface.current.animate([{ transform: 'scaleX(' + from / edge + ')' }, { transform: 'scaleX(1)' }], options)];
    }, [size.collapsed]);

    function toggle(animate: boolean) {
        const next = { ...size, collapsed: !size.collapsed };
        if (animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) oldEdge.current = body.current?.getBoundingClientRect().left ?? null;
        setSize(next);
        saveSize(next);
    }
    function resizeByKey(event: KeyboardEvent<HTMLElement>) {
        const width = { ArrowRight: size.width + 16, ArrowLeft: size.width - 16, Home: minWidth, End: maxWidth }[event.key];
        if (width === undefined) return;
        event.preventDefault();
        const next = { collapsed: false, width: clampWidth(width) };
        setSize(next);
        saveSize(next);
    }
    function grab(event: PointerEvent<HTMLElement>) {
        if (event.button !== 0 || !event.isPrimary) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus();
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: size.width, width: size.width };
        setDragging(true);
    }
    function move(event: PointerEvent<HTMLElement>) {
        const handle = drag.current;
        if (!handle || handle.pointerId !== event.pointerId) return;
        handle.width = clampWidth(handle.startWidth + event.clientX - handle.startX);
        setSize({ width: handle.width, collapsed: false });
    }
    function release(event: PointerEvent<HTMLElement>) {
        const handle = drag.current;
        if (!handle || handle.pointerId !== event.pointerId) return;
        drag.current = null;
        setDragging(false);
        saveSize({ width: handle.width, collapsed: false });
    }
    function closeAfterNavigation() {
        followedLink.current = true;
        setDrawerOpen(false);
    }
    function brand(close?: () => void) {
        return renderBrandLink ? renderBrandLink(<Brand />, close) : <Brand />;
    }
    return (
        <div className="desk-shell" style={{ '--desk-rail-width': (size.collapsed ? 72 : size.width) + 'px' } as CSSProperties} data-compact={size.collapsed || undefined} data-resizing={dragging || undefined}>
            {mobile ? (
                <header className="desk-mobile-bar">
                    <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
                        <Dialog.Trigger asChild>
                            <button type="button" className="desk-icon-button" aria-label="Abrir menu lateral">
                                <Menu />
                            </button>
                        </Dialog.Trigger>
                        {brand()}

                        <Dialog.Portal>
                            <Dialog.Overlay className="desk-scrim" />
                            <Dialog.Content
                                className="desk-drawer"
                                aria-describedby={undefined}
                                onCloseAutoFocus={(event) => {
                                    if (followedLink.current && focusDestination) {
                                        event.preventDefault();
                                        focusDestination();
                                    }
                                    followedLink.current = false;
                                }}
                            >
                                <Dialog.Title className="sr-only">Menu do gestor</Dialog.Title>
                                <div className="desk-masthead">
                                    {brand(closeAfterNavigation)}
                                    <Dialog.Close asChild>
                                        <button type="button" aria-label="Fechar menu lateral" className="desk-icon-button">
                                            <X />
                                        </button>
                                    </Dialog.Close>
                                </div>
                                {renderNavigation(closeAfterNavigation)}
                            </Dialog.Content>
                        </Dialog.Portal>
                    </Dialog.Root>
                </header>
            ) : (
                <aside className="desk-rail" aria-label="Menu do gestor">
                    <div className="desk-surface" aria-hidden="true" ref={surface} />
                    <div className="desk-rail-interior">
                        <div className="desk-masthead">
                            {brand()}
                            <button type="button" className="desk-icon-button desk-fold" aria-expanded={!size.collapsed} aria-label={size.collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} title={size.collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} onClick={(event) => toggle(event.detail > 0)}>
                                {size.collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                            </button>
                        </div>
                        {renderNavigation(() => setDrawerOpen(false))}
                    </div>
                    {!size.collapsed && <div role="separator" className="desk-resizer" tabIndex={0} aria-label="Largura do menu lateral" aria-orientation="vertical" aria-valuemin={minWidth} aria-valuemax={maxWidth} aria-valuenow={size.width} aria-valuetext={size.width + ' pixels'} title="Arraste ou use as setas para ajustar a largura" onKeyDown={resizeByKey} onPointerDown={grab} onPointerMove={move} onPointerUp={release} onLostPointerCapture={release} onPointerCancel={release} />}
                </aside>
            )}
            <div className="desk-workspace" ref={body}>
                {children}
            </div>
        </div>
    );
}
