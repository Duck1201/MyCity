import { CommunityHighlight } from './components/community-highlight';
import { categoryLabel } from './category-catalog';
import { mobileStyles, colors } from './theme';
import { CitizenCover, Icon, type IconName } from './prototype/civic-header';
import { ReportCard } from './components/report-card';
import { reportPhotoSource } from './components/report-photo';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Share, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ScreenTransition, TabIndicator } from './components/navigation-motion';
import { Text } from './components/typography';
import { type ReportDetail, type ReportEvent, type ReportNotification, reportStatusSchema, type ReportSummary } from '@mycity/contracts';
import { CitizenReport, type CitizenDraft } from './citizen-report';
import { ReportOverview, statusLabels } from './report-overview';
import { ActionButton } from './components/action-button';
import { useActiveQuery } from './use-active-query';

import { Filters, filteredPath, activeStatuses, type ReportFilters } from './report-filters';
import { ApiConfirmation, confirmationLabel } from './report-confirmation';
import { Participation } from './report-participation';
import { useCitizenRequest, type CitizenRequest as Request } from './citizen-api';
import { WeatherAlerts } from './weather-alerts';
import { CommunityMap, brazilView } from './community-map';
type Page<T> = { data: T[]; page: { nextCursor: string | null } };
type Tab = 'mine' | 'notifications' | 'feed' | 'resolved' | 'map' | 'alerts';
type Selection = { id: string; noticeId?: string; published?: ReportDetail };
const trackingTabs = ['resolved', 'notifications'] as const satisfies readonly Tab[];
const primaryTabs = ['mine', 'feed', 'map', 'alerts'] as const satisfies readonly Tab[];
const tabLabels: Record<Tab, string> = { feed: 'Feed', map: 'Mapa', resolved: 'Resolvidas', mine: 'Início', notifications: 'Notificações', alerts: 'Alertas' };
const date = (value: string) => new Date(value).toLocaleString('pt-BR');
const withCursor = (path: string, cursor: string | null) => (cursor ? path + (path.includes('?') ? '&' : '?') + 'cursor=' + encodeURIComponent(cursor) : path);

const tabIcons: Partial<Record<Tab, IconName>> = { mine: 'inbox', feed: 'feed', map: 'map', alerts: 'alerts' };

function transitionLabel(from: ReportEvent['fromStatus'], to: ReportNotification['status']) {
    if (to === 'UNDER_REVIEW' && (from === 'RESOLVED' || from === 'REJECTED' || from === 'CANCELED')) return 'Atendimento reaberto para análise';
    if (to === 'SENT' && from === 'UNDER_REVIEW') return 'Denúncia devolvida à fila de entrada';
    if (to === 'UNDER_REVIEW' && from === 'IN_PROGRESS') return 'Atendimento devolvido para análise';
    return null;
}

function QueryFeedback({ failed, loading, retry }: { failed: boolean; loading: boolean; retry: () => void }) {
    if (failed)
        return (
            <View style={styles.message}>
                <Text accessibilityLiveRegion="polite">Não foi possível atualizar. Confira sua conexão.</Text>
                <ActionButton label="Tentar novamente" onPress={retry} />
            </View>
        );
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
    const query = useActiveQuery(load);
    const row = query.data?.data[0];
    return <CommunityHighlight report={row && { description: row.description, category: categoryLabel(row), status: row.status, photo: row.coverPhoto && reportPhotoSource(row.coverPhoto.contentPath, apiBase, token) }} message={query.failed ? 'Não foi possível atualizar as ocorrências da cidade.' : !query.data ? 'Consultando o feed…' : !row ? 'Nenhuma ocorrência ativa no feed.' : undefined} open={() => row && open({ id: row.id })} feed={feed} />;
}

function ReportList({ request, feed, open, pages, setPages, scope, filters, onChange, apiBase, token }: ListProps & { feed: () => void; apiBase: string; token: string; scope: 'mine' | 'feed' | 'resolved'; filters: ReportFilters; onChange: (f: ReportFilters) => void }) {
    const [voteError, setVoteError] = useState<{ id: string; message: string } | null>(null);
    const path = withCursor(filteredPath('/reports?scope=' + scope, filters), pages.at(-1) ?? null);
    const load = useCallback((signal: AbortSignal) => request<Page<ReportSummary>>(path, signal), [path, request]);
    const query = useActiveQuery(load);
    const completeHome = scope === 'mine' && !filters.category && !filters.status && pages.length === 1 && !!query.data && !query.data.page.nextCursor;
    const rows = query.data?.data ?? [];
    const openCount = rows.filter((row) => activeStatuses.includes(row.status)).length;
    return (
        <ScrollView contentContainerStyle={styles.page}>
            {scope === 'mine' && (
                <>
                    <Text accessibilityRole="header" style={styles.title}>
                        Início
                    </Text>
                    <CitizenCover ready={completeHome} open={openCount} closed={rows.length - openCount} />
                    <HomeCommunity request={request} open={open} feed={feed} apiBase={apiBase} token={token} />
                </>
            )}
            <Text accessibilityRole="header" style={scope === 'mine' ? styles.heading : styles.title}>
                {scope === 'mine' ? 'Meus registros' : scope === 'feed' ? 'Denúncias da comunidade' : 'Histórico de resolvidas'}
            </Text>
            <Filters request={request} filters={filters} statuses={scope === 'resolved' ? [] : scope === 'mine' ? reportStatusSchema.options : [...activeStatuses, 'RESOLVED']} onChange={onChange} />
            <QueryFeedback failed={query.failed} loading={!query.data} retry={query.retry} />
            {voteError && !query.data?.data.some((row) => row.id === voteError.id) && (
                <Text accessibilityLiveRegion="polite" style={styles.message}>
                    {voteError.message}
                </Text>
            )}
            {query.data?.data.length === 0 && <Text>{scope === 'mine' && !filters.status && !filters.category ? 'Você ainda não registrou denúncias.' : 'Nenhuma denúncia encontrada.'}</Text>}
            {query.data?.data.map((report) => (
                <ReportCard key={report.id} feed={scope === 'feed'} category={categoryLabel(report)} description={report.description} status={report.status} when={date(report.createdAt)} photo={report.coverPhoto && reportPhotoSource(report.coverPhoto.contentPath, apiBase, token)} onPress={() => open({ id: report.id })}>
                    {scope === 'feed' ? <ApiConfirmation report={report} onError={(message) => setVoteError({ id: report.id, message })} request={request} update={(vote) => query.replace((previous) => previous && { ...previous, data: previous.data.map((row) => (row.id === report.id ? { ...row, ...vote } : row)) })} refresh={query.retry} /> : <Text style={styles.meta}>{confirmationLabel(report.confirmationCount)}</Text>}
                </ReportCard>
            ))}
            <Pagination pages={pages} next={query.data?.page.nextCursor ?? null} setPages={setPages} />
        </ScrollView>
    );
}
type ListProps = { request: Request; open: (selection: Selection) => void; pages: (string | null)[]; setPages: (pages: (string | null)[]) => void };
function Notifications({ request, open, pages, setPages }: ListProps) {
    const path = withCursor('/notifications', pages.at(-1) ?? null);
    const load = useCallback((signal: AbortSignal) => request<Page<ReportNotification>>(path, signal), [path, request]);
    const query = useActiveQuery(load);
    return (
        <ScrollView contentContainerStyle={styles.page}>
            <Text accessibilityRole="header" style={styles.title}>
                Avisos de atendimento
            </Text>
            <QueryFeedback failed={query.failed} loading={!query.data} retry={query.retry} />
            {query.data?.data.length === 0 && <Text>Você ainda não recebeu notificações.</Text>}
            {query.data?.data.map((n) => (
                <Pressable accessibilityRole="button" style={styles.card} key={n.id} onPress={() => open({ id: n.reportId, ...(!n.readAt && { noticeId: n.id }) })}>
                    <Text style={styles.label}>{transitionLabel(n.fromStatus, n.status) ?? 'Status atualizado: ' + statusLabels[n.status]}</Text>
                    <Text style={styles.status}>{n.readAt ? 'Lida' : 'Não lida'}</Text>
                    <Text>{date(n.createdAt)}</Text>
                </Pressable>
            ))}
            <Pagination pages={pages} next={query.data?.page.nextCursor ?? null} setPages={setPages} />
        </ScrollView>
    );
}

function History({ request, path, pages, setPages }: { request: Request; path: string; pages: (string | null)[]; setPages: ListProps['setPages'] }) {
    const url = withCursor(path, pages.at(-1) ?? null);
    const load = useCallback((signal: AbortSignal) => request<Page<ReportEvent>>(url, signal), [url, request]);
    const query = useActiveQuery(load);
    return (
        <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.heading}>
                Histórico do atendimento
            </Text>
            <QueryFeedback failed={query.failed} loading={!query.data} retry={query.retry} />
            {query.data?.data.length === 0 && <Text>Nenhum evento registrado.</Text>}
            {query.data?.data.map((event) => (
                <View key={event.id} style={styles.event}>
                    <Text style={styles.label}>{event.type === 'CREATED' ? 'Denúncia registrada' : event.type === 'REPLY' ? 'Resposta do gestor' : event.toStatus ? (transitionLabel(event.fromStatus, event.toStatus) ?? statusLabels[event.toStatus]) : 'Atualização de status'}</Text>
                    {event.text && <Text>{event.text}</Text>}
                    <Text>
                        {date(event.createdAt)} · {event.actorRole === 'MANAGER' ? 'Gestor' : 'Cidadão'}
                    </Text>
                </View>
            ))}
            <Pagination pages={pages} next={query.data?.page.nextCursor ?? null} setPages={setPages} />
        </View>
    );
}

function ReportTracking({ request, selection, apiBase, token, back, backLabel }: { request: Request; selection: Selection; apiBase: string; token: string; back: () => void; backLabel: string }) {
    const path = '/reports/' + encodeURIComponent(selection.id);
    const load = useCallback((signal: AbortSignal) => request<{ data: ReportDetail }>(path, signal), [path, request]);
    const query = useActiveQuery(load);
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
            <ActionButton variant="secondary" label={backLabel} onPress={back} />
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
                        update={(next) => query.replace({ data: next })}
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
                    <History key={historyRevision + ':' + pages.at(-1)} request={request} path={path + '/history'} pages={pages} setPages={setPages} />
                </>
            )}
        </ScrollView>
    );
}

export function CitizenWorkspace({ token, apiBase, onSessionExpired, draftRef, linkedReport, clearLink }: { token: string; apiBase: string; onSessionExpired: () => void; linkedReport?: { id: string } | null; clearLink?: () => void; draftRef: { current: CitizenDraft | null } }) {
    const [tab, setTab] = useState<Tab>('mine');
    const [creating, setCreating] = useState(false);
    const [hasDraft, setHasDraft] = useState(() => !!draftRef.current);
    const closeForm = useCallback(() => {
        const draft = draftRef.current;
        setHasDraft(!!(draft?.category || draft?.description || draft?.location || draft?.photos.length || draft?.showIdentity === false));
        setCreating(false);
    }, [draftRef]);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [pages, setPages] = useState<(string | null)[]>([null]);
    const [mapRegion, setMapRegion] = useState(brazilView);
    const [filters, setFilters] = useState<ReportFilters>({});
    const request = useCitizenRequest(apiBase, token, onSessionExpired);
    function selectTab(value: Tab) {
        if (creating) closeForm();
        setSelection(null);
        setPages([null]);
        setTab(value);
        setFilters({});
    }
    useEffect(() => {
        if (!selection && !creating) return;
        const handler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (creating) closeForm();
            else setSelection(null);
            return true;
        });
        return () => handler.remove();
    }, [selection, creating, closeForm]);
    useEffect(() => {
        if (linkedReport) {
            if (creating) closeForm();
            setTab('feed');
            setFilters({});
            setPages([null]);
            setSelection({ id: linkedReport.id });
            clearLink?.();
        }
    }, [linkedReport, clearLink, creating, closeForm]);
    function tabButton(value: Tab) {
        const active = tab === value;
        const icon = tabIcons[value];
        return (
            <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.tab, active && styles.selected]} onPress={() => selectTab(value)}>
                {icon && <Icon name={icon} size={20} color={active ? colors.deepTeal : colors.muted} />}
                <Text style={[styles.tabLabel, active && styles.current]}>{tabLabels[value]}</Text>
            </Pressable>
        );
    }
    const listProps = { request, pages, setPages, open: setSelection };
    return (
        <View style={styles.container}>
            <View accessibilityRole="tablist" accessibilityLabel="Acompanhamento" style={styles.secondaryNav}>
                {trackingTabs.map(tabButton)}
                <TabIndicator index={trackingTabs.findIndex((value) => value === tab)} count={trackingTabs.length} inset={6} />
            </View>
            <ScreenTransition route={selection ? 'report/' + selection.id : creating ? 'create' : tab} depth={selection ? 2 : creating ? 1 : 0}>
                {selection ? (
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
                            setTab('mine');
                            setPages([null]);
                            setFilters({});
                            setSelection({ id: published.id, published });
                        }}
                    />
                ) : tab === 'alerts' ? (
                    <WeatherAlerts request={request} />
                ) : tab === 'map' ? (
                    <CommunityMap request={request} filters={filters} setFilters={setFilters} region={mapRegion} setRegion={setMapRegion} open={(id) => setSelection({ id })} />
                ) : tab !== 'notifications' ? (
                    <ReportList
                        feed={() => selectTab('feed')}
                        key={tab + JSON.stringify(filters) + pages.at(-1)}
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
                    <Notifications key={'notices-' + pages.at(-1)} {...listProps} />
                )}
            </ScreenTransition>
            {!selection && !creating && (tab === 'mine' || tab === 'feed' || tab === 'map') && (
                <View style={styles.createAction}>
                    <ActionButton label={hasDraft ? 'Continuar rascunho' : 'Nova denúncia'} onPress={() => setCreating(true)} />
                </View>
            )}
            <View accessibilityRole="tablist" accessibilityLabel="Navegação principal" style={styles.primaryNav}>
                {primaryTabs.map(tabButton)}
                <TabIndicator index={primaryTabs.findIndex((value) => value === tab)} count={primaryTabs.length} inset={6} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    createAction: { paddingHorizontal: 16, paddingVertical: 4 },
    container: { flex: 1, backgroundColor: colors.canvas },
    secondaryNav: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 6, borderBottomColor: colors.line, borderBottomWidth: 1 },
    primaryNav: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 4, borderTopColor: colors.line, borderTopWidth: 1 },
    tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, paddingVertical: 6 },
    selected: { backgroundColor: colors.pale, borderRadius: 6 },
    tabLabel: { textAlign: 'center', color: colors.muted, fontWeight: '600', fontSize: 14 },
    current: { color: colors.deepTeal, fontWeight: '700' },
    page: mobileStyles.page,
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
