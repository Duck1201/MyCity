import { CommunityHighlight } from '../components/community-highlight';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ScreenTransition, TabIndicator } from '../components/navigation-motion';
import { ReportConfirmation } from '../report-confirmation';
import { statusLabels } from '../report-overview';
import { activeStatuses } from '../report-filters';
import { useDemoConfirmations } from './use-demo-confirmations';
import { colors } from '../theme';
import { Text } from '../components/typography';
import { MapWorkspace, type MapFilters } from './map-workspace';
import { AlertScenarios } from './alert-scenarios';
import { cases, categoryName, examplePoint, type ReportPhotos, type Case, type Category } from './fixtures';
import { CivicHeader, CitizenCover, Icon, type IconName } from './civic-header';
import { Badge, Button, CaseCard, s } from './presentation';
import { CasePhotoGallery } from './case-photos';
import { CreateCase, emptyDraft } from './create-case';

const tabs = ['Início', 'Feed', 'Mapa', 'Alertas'] as const;
type Tab = (typeof tabs)[number];
const tabIcons: Record<Tab, IconName> = { Início: 'inbox', Feed: 'feed', Mapa: 'map', Alertas: 'alerts' };
type Page = Tab | 'Nova denúncia' | 'Cenários' | 'Notificações' | 'Acompanhamento' | 'Confirmação';
type Scenario = 'Normal' | 'Carregando' | 'Lista vazia' | 'Falha na consulta';
const scenarios: Scenario[] = ['Normal', 'Carregando', 'Lista vazia', 'Falha na consulta'];
export function CitizenPrototype() {
    const [tab, selectTab] = useState<Tab>('Início');
    const [page, show] = useState<Page>(tab);
    const [created, store] = useState<Case[]>([]);
    const { confirmed, setConfirmed, statusById, bridge } = useDemoConfirmations();
    const records = [...created, ...cases].map((record) => {
        const updatedStatus = statusById[record.id];
        const status = updatedStatus ?? record.status;
        const confirmedByMe = confirmed.includes(record.id);
        return { ...record, status, confirmedByMe, confirmationCount: record.confirmationCount + Number(confirmedByMe), update: updatedStatus ? 'Situação atualizada para ' + statusLabels[updatedStatus] + '.' : record.update };
    });
    const [hiddenReportIds, setHiddenReportIds] = useState<number[]>([]);
    const items = records.filter((record) => !hiddenReportIds.includes(record.id));
    const notifications = items.filter((record) => record.mine && record.status !== 'SENT');
    const [draft, setDraft] = useState(emptyDraft);
    const hasDraft = Boolean(draft.category || draft.description || draft.located || draft.photos.length);
    const selectedMapGroup = useRef<number | null>(null);
    const [mapFilters, setMapFilters] = useState<MapFilters>({});
    const mapRegion = useRef({ ...examplePoint, latitudeDelta: 0.012, longitudeDelta: 0.012 });
    const [selectedId, selectItem] = useState(cases[0]!.id);
    const item = records.find((record) => record.id === selectedId)!;
    const [origin, setOrigin] = useState<Page>(tab);
    const [scenario, setScenario] = useState<Scenario>('Normal');
    const [resolved, setResolved] = useState(false);
    const [alert, setAlert] = useState('');
    const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
    const fab = useRef<ComponentRef<typeof View>>(null);
    const offset = useRef(0);
    const entryOffset = useRef(0);
    const returnOffset = useRef<{ y: number; focusFab: boolean } | null>(null);
    useLayoutEffect(() => {
        const restore = returnOffset.current;
        const y = restore?.y ?? 0;
        returnOffset.current = null;
        offset.current = y;
        scroll.current?.scrollTo({ y, animated: false });
        if (restore?.focusFab && Platform.OS === 'web' && document.activeElement === document.body) fab.current?.focus();
    }, [page, tab]);
    useEffect(() => {
        if (scenario !== 'Carregando') return;
        const timer = setTimeout(() => setScenario('Normal'), 850);
        return () => clearTimeout(timer);
    }, [scenario]);
    const goBack = useCallback(() => {
        if (page === 'Acompanhamento') {
            returnOffset.current = { y: entryOffset.current, focusFab: false };
            show(origin);
            return true;
        }
        if (page === 'Alertas' && alert) {
            setAlert('');
            return true;
        }
        if (page !== tab) {
            if (page === 'Nova denúncia') returnOffset.current = { y: entryOffset.current, focusFab: true };
            show(tab);
            return true;
        }
        if (tab !== 'Início') {
            selectTab('Início');
            show('Início');
            return true;
        }
        return false;
    }, [page, origin, tab, alert]);
    useEffect(() => {
        if (Platform.OS === 'web') return;
        const handler = BackHandler.addEventListener('hardwareBackPress', goBack);
        return () => handler.remove();
    }, [goBack]);
    function go(tab: Tab) {
        selectTab(tab);
        show(tab);
        setScenario('Normal');
        setAlert('');
    }
    function open(record: Case) {
        entryOffset.current = offset.current;
        setOrigin(page);
        selectItem(record.id);
        show('Acompanhamento');
    }
    function openForm() {
        entryOffset.current = offset.current;
        show('Nova denúncia');
    }
    function submitted(category: Category, description: string, photos: ReportPhotos) {
        const record: Case = { id: Math.max(...records.map((x) => x.id)) + 1, category, description, photo: photos[0], photos, point: examplePoint, place: 'Rua dos Passos, Centro', status: 'SENT', when: 'Agora', confirmedByMe: false, confirmationCount: 0, update: 'Registro recebido pela prefeitura.', mine: true };
        store((previous) => [record, ...previous]);
        setDraft(emptyDraft);
        selectItem(record.id);
        entryOffset.current = 0;
        setOrigin('Início');
        selectTab('Início');
        setScenario('Normal');
        show('Confirmação');
    }
    const showFab = page === 'Início' || page === 'Feed' || page === 'Mapa';
    const fabLabel = hasDraft ? 'Continuar rascunho' : 'Nova denúncia';
    const route = page === 'Alertas' && alert ? page + '/' + alert : page;
    const depth = page === 'Acompanhamento' || page === 'Confirmação' ? 2 : page !== tab || alert ? 1 : 0;
    const list = items.filter((record) => (page === 'Início' ? record.mine : page === 'Feed' && resolved ? record.status === 'RESOLVED' : activeStatuses.includes(record.status)));
    const featured = items.find((record) => activeStatuses.includes(record.status));
    const closedCount = list.filter((record) => ['RESOLVED', 'REJECTED', 'CANCELED'].includes(record.status)).length;
    return (
        <View style={s.page}>
            {bridge}
            <CivicHeader home={page === 'Início'} onScenarios={() => show('Cenários')} onNotifications={() => show('Notificações')} />
            <ScreenTransition route={route} depth={depth}>
                <ScrollView
                    ref={scroll}
                    onScroll={(event) => {
                        offset.current = event.nativeEvent.contentOffset.y;
                    }}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={[s.content, showFab && styles.scrollBottom]}
                >
                    {page !== tab && page !== 'Confirmação' && <Button label="Voltar" icon="back" link onPress={goBack} />}
                    <Text accessibilityRole="header" style={s.title}>
                        {page === 'Confirmação' ? 'Denúncia enviada' : page}
                    </Text>
                    {page === 'Início' && <CitizenCover open={list.length - closedCount} closed={closedCount} ready={scenario !== 'Carregando' && scenario !== 'Falha na consulta'} />}
                    {page === 'Início' && scenario !== 'Carregando' && scenario !== 'Falha na consulta' && (
                        <CommunityHighlight
                            report={featured && { description: featured.description, category: categoryName(featured.category), photo: featured.photo.image, status: featured.status }}
                            open={() => featured && open(featured)}
                            feed={() => {
                                setResolved(false);
                                go('Feed');
                            }}
                            message={!featured ? 'Nenhuma ocorrência ativa no feed.' : undefined}
                        />
                    )}
                    {page === 'Cenários' && (
                        <View style={s.scenarioList}>
                            {scenarios.map((value) => (
                                <Pressable
                                    key={value}
                                    accessibilityRole="button"
                                    accessibilityLabel={value}
                                    accessibilityState={{ selected: scenario === value }}
                                    onPress={() => {
                                        setHiddenReportIds(value === 'Lista vazia' ? records.filter((record) => record.mine).map((record) => record.id) : []);
                                        setScenario(value);
                                        show('Início');
                                    }}
                                    style={({ pressed }) => [s.scenarioRow, pressed && s.pressed]}
                                >
                                    <Text style={s.text}>{value}</Text>
                                    {scenario === value && <Text style={s.meta}>Selecionado</Text>}
                                </Pressable>
                            ))}
                        </View>
                    )}
                    {page === 'Mapa' && <MapWorkspace records={items} region={mapRegion} selectedGroup={selectedMapGroup} open={open} filters={mapFilters} change={setMapFilters} loading={scenario === 'Carregando'} failed={scenario === 'Falha na consulta'} retry={() => setScenario('Carregando')} />}
                    {(page === 'Início' || page === 'Feed') && (
                        <>
                            {page === 'Feed' && (
                                <View style={s.feedFilter}>
                                    {(['Ativas', 'Resolvidas'] as const).map((label) => {
                                        const isResolved = label === 'Resolvidas';
                                        const selected = isResolved === resolved;
                                        return (
                                            <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => setResolved(isResolved)} style={({ pressed }) => [s.feedSegment, selected && s.selectedSegment, pressed && s.pressed]}>
                                                <Text style={[s.buttonText, selected && s.primaryText]}>{label}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            )}
                            <View style={s.listHeading}>
                                <Text accessibilityRole="header" style={s.heading}>
                                    {page === 'Início' ? 'Meus registros' : 'Ocorrências da cidade'}
                                </Text>
                                {scenario !== 'Carregando' && scenario !== 'Falha na consulta' && (
                                    <Text style={s.meta}>
                                        {list.length} {list.length === 1 ? 'registro' : 'registros'}
                                    </Text>
                                )}
                            </View>
                            {scenario === 'Carregando' ? (
                                <View style={s.card}>
                                    <ActivityIndicator />
                                    <Text accessibilityLiveRegion="polite" style={s.meta}>
                                        Carregando denúncias…
                                    </Text>
                                </View>
                            ) : scenario === 'Falha na consulta' ? (
                                <View style={s.card}>
                                    <Text style={s.text}>Não foi possível carregar suas denúncias.</Text>
                                    <Button label="Tentar novamente" onPress={() => setScenario('Carregando')} />
                                </View>
                            ) : !list.length ? (
                                <View style={s.notice}>
                                    <Icon name="inbox" />
                                    <Text style={[s.text, s.grow]}>{page === 'Início' ? 'Você ainda não registrou denúncias.' : 'Nenhuma ocorrência encontrada.'}</Text>
                                </View>
                            ) : (
                                list.map((record) => <CaseCard key={record.id} item={record} onPress={() => open(record)} {...(page === 'Feed' && { onConfirm: (next: boolean) => setConfirmed(record.id, next) })} />)
                            )}
                        </>
                    )}
                    {page === 'Notificações' && (
                        <>
                            <Text style={s.meta}>Retornos da prefeitura</Text>
                            {!notifications.length && <Text style={s.text}>Você ainda não recebeu retornos da prefeitura.</Text>}
                            {notifications.map((record) => (
                                <CaseCard key={record.id} item={record} onPress={() => open(record)} />
                            ))}
                        </>
                    )}
                    {page === 'Alertas' && <AlertScenarios selected={alert} choose={setAlert} />}
                    {page === 'Nova denúncia' && <CreateCase draft={draft} onChange={setDraft} onSent={submitted} />}
                    {page === 'Confirmação' && (
                        <View style={s.card}>
                            <Text style={s.text}>Protocolo MC-{item.id} · Registro demonstrativo</Text>
                            <Button primary label="Acompanhar denúncia" onPress={() => show('Acompanhamento')} />
                        </View>
                    )}
                    {page === 'Acompanhamento' && !item.mine && item.status === 'CANCELED' && (
                        <Text accessibilityLiveRegion="polite" style={s.text}>
                            Esta denúncia não está disponível para sua conta.
                        </Text>
                    )}
                    {page === 'Acompanhamento' && (item.mine || item.status !== 'CANCELED') && (
                        <>
                            <View style={s.topline}>
                                <Badge item={item} />
                                <Text selectable style={s.meta}>
                                    Protocolo MC-{item.id}
                                </Text>
                            </View>
                            <Text style={s.heading}>{categoryName(item.category)}</Text>
                            <ReportConfirmation report={{ ...item, isMine: item.mine }} onChange={async (next) => setConfirmed(item.id, next)} />
                            <View style={s.note}>
                                <Text style={s.heading}>Última atualização</Text>
                                <Text style={s.text}>{item.update}</Text>
                                <Text style={s.meta}>{item.when}</Text>
                            </View>
                            <View style={s.card}>
                                <Text style={s.heading}>Relato</Text>
                                <Text style={s.text}>{item.description}</Text>
                                <Text style={s.meta}>{item.place}</Text>
                                <CasePhotoGallery key={item.id} photos={item.photos} />
                            </View>
                        </>
                    )}
                </ScrollView>
                {showFab && (
                    <Pressable ref={fab} accessibilityRole="button" accessibilityLabel={fabLabel} accessibilityHint="Abrir formulário de registro" onPress={openForm} style={({ pressed }) => [styles.fab, page === 'Início' && styles.extended, pressed && styles.pressed]}>
                        <Icon name="add" color={colors.surface} size={23} />
                        {page === 'Início' && <Text style={styles.fabLabel}>{fabLabel}</Text>}
                    </Pressable>
                )}
            </ScreenTransition>
            {page === tab && (
                <View style={s.nav} accessibilityRole="tablist">
                    {tabs.map((value) => (
                        <Pressable key={value} accessibilityRole="tab" accessibilityLabel={value} aria-selected={tab === value} accessibilityState={{ selected: tab === value }} style={[s.navItem, tab === value && s.navActive]} onPress={() => go(value)}>
                            <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.tabIcon}>
                                <Icon name={tabIcons[value]} size={20} color={tab === value ? '#23568e' : '#526571'} />
                            </View>
                            <Text selectable={false} style={s.navText}>
                                {value}
                            </Text>
                        </Pressable>
                    ))}
                    <TabIndicator index={tabs.indexOf(tab)} count={tabs.length} top />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    fab: { position: 'absolute', right: 16, bottom: 12, width: 56, minHeight: 56, borderRadius: 17, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, boxShadow: '0px 3px 8px rgba(19,52,82,0.24)' },
    extended: { width: 'auto', maxWidth: '90%', paddingHorizontal: 18, paddingVertical: 12 },
    pressed: { backgroundColor: colors.deepTeal },
    fabLabel: { fontSize: 16, fontWeight: '700', color: colors.surface, flexShrink: 1 },
    scrollBottom: { paddingBottom: 84 },
});
