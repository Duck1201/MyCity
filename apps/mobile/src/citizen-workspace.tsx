import { CommunityHighlight } from './components/community-highlight';
import { categoryLabel } from './category-catalog';
import { mobileStyles, colors } from './theme';
import { CitizenCover, Icon, type IconName } from './prototype/civic-header';
import { ReportCard } from './components/report-card';
import { reportPhotoSource } from './components/report-photo';
import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { BackHandler, Share, ScrollView, StyleSheet, View } from 'react-native';
import { MotionPressable as Pressable } from './components/motion-pressable';
import { ScreenTransition, TabIndicator } from './components/navigation-motion';
import { CitizenAccessLayout } from './components/citizen-login-screen';
import { Text } from './components/typography';
import { type ReportDetail, type ReportEvent, type ReportNotification, reportStatusSchema, type ReportSummary } from '@mycity/contracts';
import { CitizenReport, type CitizenDraft } from './citizen-report';
import { ReportOverview, statusLabels } from './report-overview';
import { ActionButton } from './components/action-button';
import { useActiveQuery } from './use-active-query';

import { FilterVisibilityContext, Filters, filteredPath, activeStatuses, type ReportFilters } from './report-filters';
import { ApiConfirmation, confirmationLabel } from './report-confirmation';
import { Participation } from './report-participation';
import { useCitizenRequest, type CitizenRequest as Request } from './citizen-api';
import { WeatherAlerts } from './weather-alerts';
import { CommunityMap, type MapViewport } from './community-map';
type Page<T> = { data: T[]; page: { nextCursor: string | null } };
const primaryTabs = ['mine', 'feed', 'map', 'alerts'] as const;
type PrimaryTab = (typeof primaryTabs)[number];
type SecondaryTab = 'resolved' | 'notifications';
type Tab = PrimaryTab | SecondaryTab;
type Selection = { id: string; noticeId?: string; published?: ReportDetail };
type ReturnScreen = { tab: Tab; pages: (string | null)[]; filters: ReportFilters; selection: Selection | null; creating: boolean };
const tabLabels = { feed: 'Feed', map: 'Mapa', mine: 'Início', alerts: 'Alertas' };
const date = (value: string) => new Date(value).toLocaleString('pt-BR');
const withCursor = (path: string, cursor: string | null) => (cursor ? path + (path.includes('?') ? '&' : '?') + 'cursor=' + encodeURIComponent(cursor) : path);

const tabIcons: Record<PrimaryTab, IconName> = { mine: 'inbox', feed: 'feed', map: 'map', alerts: 'alerts' };

function transitionLabel(from: ReportEvent['fromStatus'], to: ReportNotification['status']) {
    if (to === 'UNDER_REVIEW' && (from === 'RESOLVED' || from === 'REJECTED' || from === 'CANCELED')) return 'Atendimento reaberto para análise';
    if (to === 'SENT' && from === 'UNDER_REVIEW') return 'Denúncia devolvida à fila de entrada';
    if (to === 'UNDER_REVIEW' && from === 'IN_PROGRESS') return 'Atendimento devolvido para análise';
    return null;
}

function QueryFeedback({ failed, loading, retry, updating }: { failed: boolean; loading: boolean; updating?: boolean; retry: () => void }) {
    if (failed)
        return (
            <View style={styles.message}>
                <Text accessibilityLiveRegion="polite">{updating ? 'Não foi possível atualizar. Exibindo os resultados anteriores.' : 'Não foi possível atualizar. Confira sua conexão.'}</Text>
                <ActionButton label="Tentar novamente" onPress={retry} />
            </View>
        );
    if (updating) return <Text accessibilityLiveRegion="polite">Exibindo os resultados anteriores enquanto atualizamos…</Text>;
    if (loading) return <Text accessibilityLiveRegion="polite">Carregando…</Text>;
    return null;
}
function Pagination({ pages, next, setPages }: { pages: (string | null)[]; next: string | null; setPages: (pages: (string | null)[]) => void }) {
    if (pages.length === 1 && !next) return null;
    return (
        <View style={styles.pages}>
            <Text>Página {pages.length}</Text>
            {pages.length > 1 && <ActionButton label="Página anterior" onPress={() => setPages(pages.slice(0, -1))} />}
            {next && <ActionButton label="Próxima página" onPress={() => setPages([...pages, next])} />}
        </View>
    );
}

function HomeCommunity({ request, open, feed, apiBase, token }: { request: Request; open: ListProps['open']; feed: () => void; apiBase: string; token: string }) {
    const load = useCallback((signal: AbortSignal) => request<Page<ReportSummary>>('/reports?scope=feed&limit=1', signal), [request]);
    const query = useActiveQuery(load, true, '/reports?scope=feed&limit=1');
    const row = query.data?.data[0];
    return <CommunityHighlight report={row && { description: row.description, category: categoryLabel(row), status: row.status, photo: row.coverPhoto && reportPhotoSource(row.coverPhoto.contentPath, apiBase, token) }} message={query.failed ? 'Não foi possível atualizar as ocorrências da cidade.' : !query.data ? 'Consultando o feed…' : !row ? 'Nenhuma ocorrência ativa no feed.' : undefined} open={() => row && open({ id: row.id })} feed={feed} />;
}

function ReportList({ request, feed, resolved, offsets, open, pages, setPages, scope, filters, onChange, apiBase, token }: ListProps & { feed: () => void; resolved: () => void; offsets: Map<string, number>; apiBase: string; token: string; scope: 'mine' | 'feed' | 'resolved'; filters: ReportFilters; onChange: (f: ReportFilters) => void }) {
    const [voteError, setVoteError] = useState<{ id: string; message: string } | null>(null);
    const path = withCursor(filteredPath('/reports?scope=' + scope, filters), pages.at(-1) ?? null);
    const load = useCallback((signal: AbortSignal) => request<Page<ReportSummary>>(path, signal), [path, request]);
    const query = useActiveQuery(load, true, path);
    const contentOffset = useMemo(() => ({ x: 0, y: offsets.get(path) ?? 0 }), [offsets, path]);
    const completeHome = !query.updating && scope === 'mine' && !filters.category && !filters.status && pages.length === 1 && !!query.data && !query.data.page.nextCursor;
    const rows = query.data?.data ?? [];
    const openCount = rows.filter((row) => activeStatuses.includes(row.status)).length;
    const filterButton = <Filters request={request} filters={filters} statuses={scope === 'resolved' ? [] : scope === 'mine' ? reportStatusSchema.options : [...activeStatuses, 'RESOLVED']} onChange={onChange} />;
    return (
        <ScrollView testID="report-list" contentOffset={contentOffset} onScroll={(event) => offsets.set(path, event.nativeEvent.contentOffset.y)} scrollEventThrottle={64} contentContainerStyle={styles.page}>
            {scope === 'mine' && (
                <>
                    <Text accessibilityRole="header" style={styles.title}>
                        Início
                    </Text>
                    <CitizenCover ready={completeHome} open={openCount} closed={rows.length - openCount} />
                </>
            )}
            <View style={styles.headingRow}>
                <Text accessibilityRole="header" style={[scope === 'mine' ? styles.heading : styles.title, styles.headingText]}>
                    {scope === 'mine' ? 'Meus registros' : scope === 'feed' ? 'Denúncias da comunidade' : 'Histórico de resolvidas'}
                </Text>
                {scope === 'mine' && filterButton}
            </View>
            {scope !== 'mine' && (
                <View style={styles.listControls}>
                    {filterButton}
                    {scope === 'feed' ? <ActionButton variant="secondary" label="Resolvidas" onPress={resolved} /> : <ActionButton variant="secondary" label="Voltar ao feed" onPress={feed} />}
                </View>
            )}
            <QueryFeedback failed={query.failed} loading={!query.data} updating={query.updating} retry={query.retry} />
            {voteError && !query.data?.data.some((row) => row.id === voteError.id) && (
                <Text accessibilityLiveRegion="polite" style={styles.message}>
                    {voteError.message}
                </Text>
            )}
            {!query.updating && query.data?.data.length === 0 && <Text style={styles.emptyList}>{scope === 'mine' && !filters.status && !filters.category ? 'Você ainda não registrou denúncias.' : 'Nenhuma denúncia encontrada.'}</Text>}
            {query.data?.data.map((report) => (
                <ReportCard key={report.id} feed={scope === 'feed'} category={categoryLabel(report)} description={report.description} status={report.status} when={date(report.createdAt)} photo={report.coverPhoto && reportPhotoSource(report.coverPhoto.contentPath, apiBase, token)} onPress={() => open({ id: report.id })}>
                    {scope === 'feed' && !query.updating ? <ApiConfirmation report={report} onError={(message) => setVoteError({ id: report.id, message })} request={request} update={(vote) => query.replace((previous) => previous && { ...previous, data: previous.data.map((row) => (row.id === report.id ? { ...row, ...vote } : row)) })} refresh={query.retry} /> : <Text style={styles.meta}>{confirmationLabel(report.confirmationCount)}</Text>}
                </ReportCard>
            ))}
            {!query.updating && <Pagination pages={pages} next={query.data?.page.nextCursor ?? null} setPages={setPages} />}
            {scope === 'mine' && <HomeCommunity request={request} open={open} feed={feed} apiBase={apiBase} token={token} />}
        </ScrollView>
    );
}
type ListProps = { request: Request; open: (selection: Selection) => void; pages: (string | null)[]; setPages: (pages: (string | null)[]) => void };
function Notifications({ request, open, pages, setPages, back }: ListProps & { back: () => void }) {
    const path = withCursor('/notifications', pages.at(-1) ?? null);
    const load = useCallback((signal: AbortSignal) => request<Page<ReportNotification>>(path, signal), [path, request]);
    const query = useActiveQuery(load, true, path);
    return (
        <ScrollView contentContainerStyle={styles.page}>
            <ActionButton variant="secondary" label="Voltar" onPress={back} />
            <Text accessibilityRole="header" style={styles.title}>
                Avisos de atendimento
            </Text>
            <QueryFeedback failed={query.failed} loading={!query.data} updating={query.updating} retry={query.retry} />
            {!query.updating && query.data?.data.length === 0 && <Text>Você ainda não recebeu notificações.</Text>}
            {query.data?.data.map((n) => (
                <Pressable accessibilityRole="button" style={styles.card} key={n.id} onPress={() => open({ id: n.reportId, ...(!n.readAt && { noticeId: n.id }) })}>
                    <Text style={styles.label}>{transitionLabel(n.fromStatus, n.status) ?? 'Status atualizado: ' + statusLabels[n.status]}</Text>
                    <Text style={styles.status}>{n.readAt ? 'Lida' : 'Não lida'}</Text>
                    <Text>{date(n.createdAt)}</Text>
                </Pressable>
            ))}
            {!query.updating && <Pagination pages={pages} next={query.data?.page.nextCursor ?? null} setPages={setPages} />}
        </ScrollView>
    );
}

function History({ request, path, pages, setPages }: { request: Request; path: string; pages: (string | null)[]; setPages: ListProps['setPages'] }) {
    const url = withCursor(path, pages.at(-1) ?? null);
    const load = useCallback((signal: AbortSignal) => request<Page<ReportEvent>>(url, signal), [url, request]);
    const query = useActiveQuery(load, true, url);
    return (
        <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.heading}>
                Histórico do atendimento
            </Text>
            <QueryFeedback failed={query.failed} loading={!query.data} updating={query.updating} retry={query.retry} />
            {!query.updating && query.data?.data.length === 0 && <Text>Nenhum evento registrado.</Text>}
            {query.data?.data.map((event) => (
                <View key={event.id} style={styles.event}>
                    <Text style={styles.label}>{event.type === 'CREATED' ? 'Denúncia registrada' : event.type === 'REPLY' ? 'Resposta do gestor' : event.toStatus ? (transitionLabel(event.fromStatus, event.toStatus) ?? statusLabels[event.toStatus]) : 'Atualização de status'}</Text>
                    {event.text && <Text style={mobileStyles.body}>{event.text}</Text>}
                    <Text style={mobileStyles.meta}>
                        {date(event.createdAt)} · {event.actorRole === 'MANAGER' ? 'Gestor' : 'Cidadão'}
                    </Text>
                </View>
            ))}
            {!query.updating && <Pagination pages={pages} next={query.data?.page.nextCursor ?? null} setPages={setPages} />}
        </View>
    );
}

function ReportTracking({ request, selection, apiBase, token, back, backLabel }: { request: Request; selection: Selection; apiBase: string; token: string; back: () => void; backLabel: string }) {
    const path = '/reports/' + encodeURIComponent(selection.id);
    const load = useCallback((signal: AbortSignal) => request<{ data: ReportDetail }>(path, signal), [path, request]);
    const query = useActiveQuery(load, true, path);
    const detail = query.unavailable ? undefined : (query.data?.data ?? selection.published);
    const [pages, setPages] = useState<(string | null)[]>([null]);
    const [shareError, setShareError] = useState(false);
    const [historyRevision, setHistoryRevision] = useState(0);
    const [readError, setReadError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const canMarkRead = !!detail && !!selection.noticeId;
    useEffect(() => {
        if (!canMarkRead || !selection.noticeId) return;
        const controller = new AbortController();
        void request('/notifications/' + encodeURIComponent(selection.noticeId) + '/read', controller.signal, 'PUT').catch(() => {
            if (!controller.signal.aborted) setReadError(true);
        });
        return () => controller.abort();
    }, [canMarkRead, selection.noticeId, attempt, request]);
    return (
        <ScrollView contentContainerStyle={styles.page}>
            <Pressable accessibilityRole="button" onPress={back} style={({ pressed }) => [styles.back, pressed && styles.pressedLink]}>
                <Icon name="back" size={18} />
                <Text style={styles.backText}>{backLabel}</Text>
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>
                {selection.published ? 'Denúncia enviada' : 'Detalhes da denúncia'}
            </Text>
            {query.unavailable ? <Text accessibilityLiveRegion="polite">Esta denúncia não está disponível para sua conta.</Text> : <QueryFeedback failed={query.failed} loading={!detail} retry={query.retry} />}
            {readError && (
                <View style={styles.message}>
                    <Text accessibilityLiveRegion="polite">Não foi possível confirmar a leitura da notificação.</Text>
                    <ActionButton
                        label="Tentar marcar como lida"
                        onPress={() => {
                            setReadError(false);
                            setAttempt((v) => v + 1);
                        }}
                    />
                </View>
            )}
            {detail && (
                <>
                    <ReportOverview detail={detail} apiBase={apiBase} token={token} />
                    {detail.status !== 'CANCELED' && (
                        <ActionButton
                            variant="secondary"
                            label="Compartilhar link"
                            onPress={() => {
                                setShareError(false);
                                void Share.share({ message: 'mycity://reports/' + encodeURIComponent(detail.id) }).catch(() => setShareError(true));
                            }}
                        />
                    )}
                    {shareError && <Text accessibilityLiveRegion="polite">Não foi possível compartilhar o link.</Text>}
                    <Participation
                        detail={detail}
                        request={request}
                        update={(next) => query.replace({ data: next }, true)}
                        updateVote={(vote) =>
                            query.replace((previous) => {
                                const current = previous?.data;
                                if (!current) return previous;
                                const allowedActions = current.allowedActions.map((action) => (action === 'CONFIRM' || action === 'WITHDRAW' ? (vote.confirmedByMe ? 'WITHDRAW' : 'CONFIRM') : action));
                                return { data: { ...current, ...vote, allowedActions } };
                            })
                        }
                        refresh={() => {
                            query.retry();
                            setHistoryRevision((n) => n + 1);
                        }}
                    />
                    <History key={historyRevision} request={request} path={path + '/history'} pages={pages} setPages={setPages} />
                </>
            )}
        </ScrollView>
    );
}

export function CitizenWorkspace({ token, apiBase, onSessionExpired, onLeave, draftRef, linkedReport, clearLink }: { token: string; apiBase: string; onSessionExpired: () => void; onLeave?: () => void; linkedReport?: { id: string } | null; clearLink?: () => void; draftRef: { current: CitizenDraft | null } }) {
    const [tab, setTab] = useState<Tab>('mine');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [weatherId, setWeatherId] = useState<string | null>(null);
    const [weatherPages, setWeatherPages] = useState<(string | null)[]>([null]);
    const offsets = useRef(new Map<string, number>());
    const [creating, setCreating] = useState(false);
    const [hasDraft, setHasDraft] = useState(() => !!draftRef.current);
    const closeForm = useCallback(() => {
        setHasDraft(!!draftRef.current);
        setCreating(false);
    }, [draftRef]);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [pages, setPages] = useState<(string | null)[]>([null]);
    const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
    const [mapFilters, setMapFilters] = useState<ReportFilters>({});
    const [showMapList, setShowMapList] = useState(false);
    const [filters, setFilters] = useState<ReportFilters>({});
    const [returnStack, setReturnStack] = useState<ReturnScreen[]>([]);
    const savedLists = useRef(new Map<Tab, Pick<ReturnScreen, 'pages' | 'filters'>>());
    const hasOrigin = returnStack.length > 0;
    const request = useCitizenRequest(apiBase, token, onSessionExpired);
    function resetToTab(value: Tab) {
        if (creating) closeForm();
        if (tab === 'mine' || tab === 'feed') savedLists.current.set(tab, { pages, filters });
        const saved = savedLists.current.get(value);
        setSelection(null);
        setPages(saved?.pages ?? [null]);
        setTab(value);
        setFilters(saved?.filters ?? {});
    }
    function selectTab(value: PrimaryTab) {
        if (value === tab && !selection && !creating) return;
        setReturnStack([]);
        resetToTab(value);
    }
    function openSecondaryTab(value: SecondaryTab) {
        if (value === tab) {
            setSelection(null);
            return;
        }
        setReturnStack([...returnStack, { tab, pages, filters, selection, creating }]);
        resetToTab(value);
    }
    const returnToOrigin = useCallback(() => {
        const origin = returnStack.at(-1);
        if (!origin) return;
        setReturnStack(returnStack.slice(0, -1));
        setTab(origin.tab);
        setPages(origin.pages);
        setFilters(origin.filters);
        setSelection(origin.selection);
        setCreating(origin.creating);
    }, [returnStack]);
    useEffect(() => {
        if (!selection && !creating && !hasOrigin) return;
        const handler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (creating) closeForm();
            else if (selection) setSelection(null);
            else returnToOrigin();
            return true;
        });
        return () => handler.remove();
    }, [selection, creating, closeForm, hasOrigin, returnToOrigin]);
    useEffect(() => {
        if (linkedReport) {
            if (creating) closeForm();
            setReturnStack([]);
            setTab('feed');
            setFilters({});
            setPages([null]);
            setSelection({ id: linkedReport.id });
            clearLink?.();
        }
    }, [linkedReport, clearLink, creating, closeForm]);
    const primaryTab = tab === 'resolved' ? 'feed' : tab;
    function tabButton(value: PrimaryTab) {
        const active = primaryTab === value;
        const icon = tabIcons[value];
        return (
            <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.tab, active && styles.selected]} onPress={() => selectTab(value)}>
                <Icon name={icon} size={20} color={active ? colors.deepTeal : colors.muted} />
                <Text style={[styles.tabLabel, active && styles.current]}>{tabLabels[value]}</Text>
            </Pressable>
        );
    }
    const listProps = { request, pages, setPages, open: setSelection };
    const createLabel = hasDraft ? 'Continuar rascunho' : 'Nova denúncia';
    const create = () => setCreating(true);
    const floatingCreate = (
        <Pressable accessibilityRole="button" accessibilityLabel={createLabel} onPress={create} style={({ pressed }) => [styles.floatingCreate, pressed && styles.pressedCreate]}>
            <Icon name="add" size={28} color={colors.surface} />
        </Pressable>
    );
    const notifications = (
        <Pressable accessibilityRole="button" accessibilityLabel="Notificações" accessibilityState={{ selected: tab === 'notifications' }} onPress={() => openSecondaryTab('notifications')} style={({ pressed }) => [styles.notifications, (tab === 'notifications' || pressed) && styles.activeNotifications]}>
            <Icon name="bell" size={18} color={colors.surface} />
            <Text style={styles.headerActionLabel}>Notificações</Text>
        </Pressable>
    );
    const route = creating ? 'create' : selection ? 'report/' + selection.id : tab === 'alerts' && weatherId ? 'alert/' + weatherId : tab;
    const depth = returnStack.length + Number(!!selection || (tab === 'alerts' && !!weatherId)) + Number(creating);
    return (
        <CitizenAccessLayout onLeave={onLeave} headerAction={notifications}>
            <View style={styles.content}>
                <FilterVisibilityContext.Provider value={setFiltersOpen}>
                    <ScreenTransition route={route} depth={depth} fadeContent={false}>
                        {selection && !creating ? (
                            <ReportTracking key={selection.id} selection={selection} request={request} apiBase={apiBase} token={token} backLabel={tab === 'notifications' ? 'Voltar às notificações' : tab === 'feed' ? 'Voltar ao feed' : tab === 'map' ? 'Voltar ao mapa' : tab === 'resolved' ? 'Voltar às resolvidas' : 'Voltar aos meus registros'} back={() => setSelection(null)} />
                        ) : creating ? (
                            <CitizenReport
                                onBack={closeForm}
                                draftRef={draftRef}
                                token={token}
                                apiBase={apiBase}
                                onSessionExpired={onSessionExpired}
                                onPublished={(published) => {
                                    draftRef.current = null;
                                    setHasDraft(false);
                                    setCreating(false);
                                    setReturnStack([]);
                                    setTab('mine');
                                    setPages([null]);
                                    setFilters({});
                                    setSelection({ id: published.id, published });
                                }}
                            />
                        ) : tab === 'alerts' ? (
                            <WeatherAlerts request={request} id={weatherId} setId={setWeatherId} cursors={weatherPages} setCursors={setWeatherPages} />
                        ) : tab === 'map' ? (
                            <CommunityMap request={request} filters={mapFilters} setFilters={setMapFilters} viewport={mapViewport} setViewport={setMapViewport} showList={showMapList} setShowList={setShowMapList} open={(id) => setSelection({ id })} />
                        ) : tab !== 'notifications' ? (
                            <ReportList
                                feed={tab === 'resolved' ? returnToOrigin : () => selectTab('feed')}
                                resolved={() => openSecondaryTab('resolved')}
                                offsets={offsets.current}
                                key={tab}
                                {...listProps}
                                apiBase={apiBase}
                                token={token}
                                scope={tab}
                                filters={filters}
                                onChange={(next) => {
                                    setFilters(next);
                                    setPages([null]);
                                }}
                            />
                        ) : (
                            <Notifications {...listProps} back={returnToOrigin} />
                        )}
                    </ScreenTransition>
                </FilterVisibilityContext.Provider>
                {!creating && !filtersOpen && floatingCreate}
            </View>
            <View accessibilityRole="tablist" accessibilityLabel="Navegação principal" style={styles.primaryNav}>
                {primaryTabs.map(tabButton)}
                <TabIndicator index={primaryTabs.findIndex((value) => value === primaryTab)} count={primaryTabs.length} inset={6} />
            </View>
        </CitizenAccessLayout>
    );
}

const styles = StyleSheet.create({
    content: { flex: 1, minHeight: 0, backgroundColor: colors.canvas },
    headingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    headingText: { flexGrow: 1, flexShrink: 1, minWidth: 130 },
    emptyList: { ...mobileStyles.body, color: colors.muted, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.line },
    back: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
    backText: { fontSize: 15, fontWeight: '700', color: colors.teal, flexShrink: 1 },
    pressedLink: { opacity: 0.7 },
    listControls: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 },
    floatingCreate: { position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.teal, elevation: 4 },
    pressedCreate: { backgroundColor: colors.deepTeal },
    notifications: { minWidth: 48, minHeight: 48, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 1, gap: 6, borderRadius: 8 },
    activeNotifications: { backgroundColor: 'rgba(255, 255, 255, 0.14)' },
    headerActionLabel: { color: colors.surface, fontSize: 14, fontWeight: '700', flexShrink: 1 },
    primaryNav: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 4, borderTopColor: colors.line, borderTopWidth: 1 },
    tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, paddingVertical: 6 },
    selected: { backgroundColor: colors.pale, borderRadius: 6 },
    tabLabel: { textAlign: 'center', color: colors.muted, fontWeight: '600', fontSize: 14 },
    current: { color: colors.deepTeal, fontWeight: '700' },
    page: { ...mobileStyles.page, paddingBottom: 88 },
    title: mobileStyles.title,
    heading: mobileStyles.heading,
    label: mobileStyles.label,
    status: { color: colors.deepTeal, fontWeight: '700' },
    meta: mobileStyles.meta,
    card: mobileStyles.card,
    event: { backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.teal, padding: 12, gap: 6 },
    section: { gap: 10, marginTop: 8 },
    pages: { gap: 8 },
    message: mobileStyles.message,
});
