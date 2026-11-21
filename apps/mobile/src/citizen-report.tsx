import { CategoryCatalog } from './category-catalog';
import { useCitizenRequest } from './citizen-api';
import { colors, mobileStyles } from './theme';
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Switch, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput } from './components/typography';
import { MotionPressable } from './components/motion-pressable';
import { useMotionEnabled } from './components/use-motion-enabled';
import { Icon } from './components/civic-header';
import { ReportLocationPicker } from './report-location-picker';
import { readReportPosition } from './report-position';
import { appendReportPhotos } from './report-photo-file';
import { randomUUID } from 'expo-crypto';
import { locationSchema, type Location, type ReportDetail, type ReportCategory } from '@mycity/contracts';
import { ActionButton } from './components/action-button';
import { ReportOverview } from './report-overview';
import { listPhotoPath, reportPhotoSource, ReportThumbnail } from './components/report-photo';
import { usePhotoExpiry } from './use-photo-expiry';
import { pickReportPhoto } from './report-photos';

export type CitizenDraft = { category: ReportCategory | null; description: string; photos: string[]; retainedPhotoIds?: string[]; location: Location | null; automaticLocation?: boolean; showIdentity: boolean; requestId: string };
function initialDraft(report?: ReportDetail): CitizenDraft {
    if (report) return { category: report.category, description: report.description, location: report.location, showIdentity: report.showIdentity, photos: [], retainedPhotoIds: report.photos.map((photo) => photo.id), requestId: randomUUID() };
    return { category: null, description: '', photos: [], location: null, showIdentity: true, requestId: randomUUID() };
}

type RequiredField = 'category' | 'description' | 'photos' | 'location';

function FieldError({ message }: { message: string }) {
    return message ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
            {message}
        </Text>
    ) : null;
}

function PhotoSlot({ children, number, disabled, remove }: { children: ReactNode; number: number; disabled: boolean; remove: () => void }) {
    return (
        <View style={styles.attachment}>
            {children}
            <MotionPressable accessibilityRole="button" accessibilityLabel={'Remover foto ' + number} accessibilityState={{ disabled }} disabled={disabled} onPress={remove} style={styles.removePhoto}>
                <View style={styles.removeBadge}>
                    <Text style={styles.removeSymbol}>×</Text>
                </View>
            </MotionPressable>
        </View>
    );
}

type Props = { editing?: ReportDetail; onConflict?: () => void; onBack?: () => void; token: string; apiBase: string; onSessionExpired: () => void; onPublished?: (report: ReportDetail) => void; draftRef?: { current: CitizenDraft | null } };
export function CitizenReport({ token, apiBase, onSessionExpired, onPublished, draftRef, onBack, editing, onConflict }: Props) {
    const reopens = editing?.status === 'CANCELED';
    const catalogRequest = useCitizenRequest(apiBase, token, onSessionExpired);
    const [draft, setDraft] = useState(() => draftRef?.current ?? initialDraft(editing));
    const [catalogVersion, setCatalogVersion] = useState(0);
    const { hidden } = usePhotoExpiry(editing ? [editing] : []);
    const retained = editing && !hidden(editing.photosExpireAt) ? editing.photos.filter((photo) => draft.retainedPhotoIds?.includes(photo.id)) : [];
    const photoCount = retained.length + draft.photos.length;
    const [stale, setStale] = useState(false);
    const [error, setError] = useState('');
    const [photoError, setPhotoError] = useState('');
    const [categoryError, setCategoryError] = useState('');
    const [categoryOpen, setCategoryOpen] = useState(false);
    const categoryButton = useRef<ComponentRef<typeof Pressable>>(null);
    const [photoSourcesOpen, setPhotoSourcesOpen] = useState(false);
    const photoButton = useRef<ComponentRef<typeof Pressable>>(null);
    const cameraChoice = useRef<ComponentRef<typeof Pressable>>(null);
    function closePhotoSources() {
        setPhotoSourcesOpen(false);
        requestAnimationFrame(() => photoButton.current?.focus());
    }
    const [submitted, setSubmitted] = useState(false);
    const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
    const headings = useRef<Partial<Record<RequiredField, ComponentRef<typeof Text> | null>>>({});
    const offsets = useRef<Partial<Record<RequiredField, number>>>({});
    const motion = useMotionEnabled();
    const [mapOpen, setMapOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [detail, setDetail] = useState<ReportDetail | null>(null);
    const inFlight = useRef(false);
    const mounted = useRef(true);
    const request = useRef<AbortController | null>(null);
    const busy = preparing || sending || stale;
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            request.current?.abort();
        };
    }, []);
    useEffect(() => {
        if (draftRef) {
            const filled = draft.category || draft.description.trim() || draft.photos.length || !draft.showIdentity || (draft.location && !draft.automaticLocation);
            draftRef.current = filled && !detail ? draft : null;
        }
    }, [draft, draftRef, detail]);

    const hasLocation = !!draft.location;
    const [gpsAttempt, setGpsAttempt] = useState(0);
    const [gpsStatus, setGpsStatus] = useState<'locating' | 'denied' | 'unavailable' | 'idle'>('locating');
    const cancelGps = useRef<() => void>(() => {});
    useEffect(() => {
        if (hasLocation || detail) return;
        let current: AbortController | null = null;
        let resume = false;
        let reading = false;
        function stop() {
            current?.abort();
            current = null;
            reading = false;
            resume = false;
        }
        async function acquire() {
            const controller = new AbortController();
            current = controller;
            setGpsStatus('locating');
            try {
                const position = await readReportPosition(controller.signal, () => {
                    reading = true;
                });
                if (controller.signal.aborted) return;
                if (!position) {
                    setGpsStatus('denied');
                    return;
                }
                const { coords } = position;
                const location = locationSchema.parse({ latitude: coords.latitude, longitude: coords.longitude, source: 'GPS' });
                setDraft((previous) => (previous.location ? previous : { ...previous, location, automaticLocation: true, requestId: randomUUID() }));
            } catch {
                if (!controller.signal.aborted) setGpsStatus('unavailable');
            } finally {
                if (current === controller) current = null;
            }
        }
        cancelGps.current = stop;
        const listener = AppState.addEventListener('change', (state) => {
            if ((state === 'background' || state === 'inactive') && reading && current) {
                stop();
                resume = true;
            } else if (state === 'active' && resume) {
                resume = false;
                void acquire();
            }
        });
        void acquire();
        return () => {
            stop();
            listener.remove();
        };
    }, [hasLocation, detail, gpsAttempt]);

    const missing = {
        photos: photoCount ? '' : 'Adicione pelo menos uma foto.',
        location: hasLocation ? '' : gpsStatus === 'locating' ? 'Aguarde o GPS ou escolha o ponto no mapa.' : 'Use o GPS ou escolha o ponto no mapa.',
        category: draft.category ? '' : 'Selecione uma categoria.',
        description: draft.description.trim() ? '' : 'Descreva o problema.',
    };
    function track(field: RequiredField) {
        return {
            ref: (heading: ComponentRef<typeof Text> | null) => {
                headings.current[field] = heading;
            },
            onLayout: (event: LayoutChangeEvent) => {
                offsets.current[field] = event.nativeEvent.layout.y;
            },
        };
    }
    function reveal(field: RequiredField) {
        Keyboard.dismiss();
        const heading = headings.current[field];
        if (heading) AccessibilityInfo.sendAccessibilityEvent?.(heading, 'focus');
        const y = offsets.current[field];
        if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: motion });
    }
    function edit(changes: Partial<CitizenDraft>) {
        if (changes.category) setCategoryError('');
        if (changes.photos || changes.retainedPhotoIds) setPhotoError('');
        setError('');
        setDraft((prev) => ({ ...prev, ...changes, requestId: randomUUID() }));
    }
    async function addPhoto(source: 'camera' | 'gallery') {
        if (busy || photoCount >= 3) return;
        setPhotoSourcesOpen(false);
        setPreparing(true);
        setPhotoError('');
        setError('');
        try {
            const uri = await pickReportPhoto(source);
            if (uri && mounted.current) edit({ photos: [...draft.photos, uri] });
        } catch (cause) {
            if (mounted.current) setPhotoError(cause instanceof Error && /^(Permita|Escolha)/.test(cause.message) ? cause.message : 'Não foi possível preparar a foto. Escolha outra imagem ou tente novamente.');
        } finally {
            if (mounted.current) {
                setPreparing(false);
                requestAnimationFrame(() => photoButton.current?.focus());
            }
        }
    }
    async function send() {
        if (inFlight.current || busy || stale || mapOpen) return;
        const firstMissing = (Object.keys(missing) as RequiredField[]).find((field) => missing[field]);
        if (firstMissing) {
            setSubmitted(true);
            reveal(firstMissing);
            return;
        }
        inFlight.current = true;
        setSending(true);
        setError('');
        const controller = new AbortController();
        request.current = controller;
        try {
            const form = new FormData();
            const identity = editing ? { expectedVersion: editing.version, retainedPhotoIds: retained.map((photo) => photo.id) } : { clientRequestId: draft.requestId };
            form.append('metadata', JSON.stringify({ ...identity, description: draft.description.trim(), category: draft.category, showIdentity: draft.showIdentity, location: draft.location }));
            await appendReportPhotos(form, draft.photos);
            const response = await fetch(apiBase + '/reports' + (editing ? '/' + encodeURIComponent(editing.id) : ''), { method: editing ? 'PATCH' : 'POST', headers: { Authorization: 'Bearer ' + token }, body: form, signal: controller.signal });
            if (!mounted.current) return;
            if (response.status === 401) {
                onSessionExpired();
                return;
            }
            if (!response.ok) {
                if (response.status === 409) {
                    const failure = await response.json().catch(() => null);
                    if (!mounted.current) return;
                    if (failure?.error?.code === 'PROFILE_UNAVAILABLE') {
                        setError('Seu perfil está indisponível. Desative “Quero mostrar minha cara” para enviar como anônimo ou tente novamente mais tarde.');
                        return;
                    }
                    if (failure?.error?.code === 'CATEGORY_ARCHIVED') {
                        edit({ category: null });
                        setCatalogVersion((version) => version + 1);
                        reveal('category');
                        setCategoryOpen(true);
                        setCategoryError('Esta categoria foi arquivada. Escolha outra para enviar seu registro.');
                        return;
                    }
                }
                if (editing && [403, 404, 409].includes(response.status)) {
                    setStale(true);
                    setError('Esta denúncia mudou ou não permite mais edição. Volte ao detalhe para consultar a versão atual.');
                    onConflict?.();
                    return;
                }
                if (response.status === 413) {
                    setPhotoError('Fotos acima do limite. Remova uma imagem e tente novamente.');
                    reveal('photos');
                    return;
                }
                const message = response.status === 409 ? 'Os dados deste envio mudaram. Revise o formulário antes de reenviar.' : response.status === 422 ? 'Revise os campos e as fotos da denúncia.' : 'Não foi possível enviar. Seus dados foram preservados.';
                setError(message);
                return;
            }
            const result = await response.json();
            if (mounted.current) {
                if (onPublished) onPublished(result.data);
                else setDetail(result.data);
            }
        } catch {
            if (mounted.current) setError('Não foi possível confirmar o envio. Seus dados foram preservados. Tente novamente.');
        } finally {
            inFlight.current = false;
            if (mounted.current) setSending(false);
        }
    }
    if (detail)
        return (
            <ScrollView contentContainerStyle={styles.page}>
                <Text accessibilityRole="header" style={styles.title}>
                    Denúncia enviada
                </Text>
                <ReportOverview detail={detail} apiBase={apiBase} token={token} />
                <ActionButton
                    label="Registrar outra denúncia"
                    onPress={() => {
                        setDraft(initialDraft());
                        setSubmitted(false);
                        setPhotoError('');
                        setCategoryError('');
                        setCategoryOpen(false);
                        setPhotoSourcesOpen(false);
                        setDetail(null);
                    }}
                />
            </ScrollView>
        );

    return (
        <>
            <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
                <View style={styles.formHeader}>
                    {onBack && (
                        <MotionPressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={styles.back}>
                            <Icon name="back" color={colors.teal} size={23} />
                        </MotionPressable>
                    )}
                    <Text accessibilityRole="header" style={styles.formTitle}>
                        {editing ? 'Editar denúncia' : 'Registrar denúncia'}
                    </Text>
                </View>
                {reopens && <Text style={mobileStyles.body}>Ao salvar, a denúncia voltará à fila do gestor com a situação Enviado.</Text>}
                <Text {...track('photos')} style={styles.label}>
                    Fotos ({photoCount}/3)
                </Text>
                <View style={styles.thumbnails}>
                    {retained.map((photo, i) => {
                        const source = reportPhotoSource(listPhotoPath(photo), apiBase, token);
                        return (
                            <PhotoSlot key={photo.id} number={i + 1} disabled={busy} remove={() => edit({ retainedPhotoIds: retained.filter((p) => p.id !== photo.id).map((p) => p.id) })}>
                                {source && <ReportThumbnail source={source} label={'Prévia da foto ' + (i + 1)} fillFrame />}
                            </PhotoSlot>
                        );
                    })}
                    {draft.photos.map((uri, i) => (
                        <PhotoSlot key={i} number={retained.length + i + 1} disabled={busy} remove={() => edit({ photos: draft.photos.filter((_, index) => index !== i) })}>
                            <Image source={{ uri }} accessibilityLabel={'Prévia da foto ' + (retained.length + i + 1)} resizeMode="cover" style={StyleSheet.absoluteFill} />
                        </PhotoSlot>
                    ))}
                    {photoCount < 3 && (
                        <Pressable ref={photoButton} accessibilityRole="button" accessibilityLabel="Adicionar foto" aria-expanded={photoSourcesOpen} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => setPhotoSourcesOpen(true)} style={({ pressed }) => [photoCount === 0 ? styles.emptyPhoto : styles.attachment, styles.addPhoto, pressed && styles.pressed]}>
                            <Text accessible={false} style={styles.addSymbol}>
                                +
                            </Text>
                            <Text style={styles.addLabel}>Adicionar</Text>
                        </Pressable>
                    )}
                </View>
                {preparing && <Text accessibilityLiveRegion="polite">Preparando foto…</Text>}
                <FieldError message={photoError || (submitted ? missing.photos : '')} />
                <Text {...track('location')} style={styles.label}>
                    Localização
                </Text>
                <View style={styles.section}>
                    <View style={styles.locationRow}>
                        <Icon name="pin" color={colors.teal} size={22} />
                        <View style={styles.locationCopy}>
                            {draft.location ? (
                                <>
                                    <Text style={styles.sectionLabel}>{draft.location.source === 'GPS' ? 'Localização obtida por GPS' : 'Ponto confirmado no mapa'}</Text>
                                    <Text style={mobileStyles.meta}>
                                        {draft.location.latitude.toFixed(5)}, {draft.location.longitude.toFixed(5)}
                                    </Text>
                                </>
                            ) : (
                                <Text accessibilityLiveRegion="polite" style={mobileStyles.body}>
                                    {gpsStatus === 'locating' ? 'Buscando sua localização…' : gpsStatus === 'denied' ? 'Localização sem permissão. Tente o GPS ou escolha o ponto no mapa.' : gpsStatus === 'unavailable' ? 'GPS indisponível. Tente novamente ou escolha o ponto no mapa.' : 'Use o GPS ou escolha o ponto no mapa.'}
                                </Text>
                            )}
                        </View>
                    </View>
                    {!draft.location && gpsStatus !== 'locating' && <ActionButton variant="secondary" label="Tentar GPS novamente" disabled={sending} onPress={() => setGpsAttempt((value) => value + 1)} />}
                    <ActionButton
                        variant="secondary"
                        label={draft.location ? 'Ajustar ponto no mapa' : 'Escolher no mapa'}
                        disabled={busy}
                        onPress={() => {
                            Keyboard.dismiss();
                            setError('');
                            cancelGps.current();
                            if (gpsStatus === 'locating') setGpsStatus('idle');
                            setMapOpen(true);
                        }}
                    />
                    <FieldError message={submitted ? missing.location : ''} />
                </View>
                <Text {...track('category')} style={styles.label}>
                    Categoria
                </Text>
                <CategoryCatalog key={catalogVersion} request={catalogRequest} activeOnly keepCategory={editing?.category}>
                    {(categories) => {
                        if (!categories.length) return null;
                        const current = categories.find((entry) => entry.id === draft.category);
                        const value = current ? current.name + (current.archived ? ' (arquivada)' : '') : 'Selecionar categoria';
                        return (
                            <View style={styles.categoryField}>
                                <Pressable ref={categoryButton} accessibilityRole="button" accessibilityLabel={'Escolher categoria: ' + value} aria-expanded={categoryOpen} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => setCategoryOpen(!categoryOpen)} style={styles.categoryRow}>
                                    <Text style={styles.categoryText}>{value}</Text>
                                    <View style={{ transform: [{ rotate: categoryOpen ? '-90deg' : '90deg' }] }}>
                                        <Icon name="next" size={18} />
                                    </View>
                                </Pressable>
                                {categoryOpen && (
                                    <View accessibilityRole="radiogroup" accessibilityLabel="Categorias disponíveis">
                                        {categories.map(({ id: code, name, archived }) => {
                                            const checked = draft.category === code;
                                            return (
                                                <MotionPressable
                                                    key={code}
                                                    accessibilityRole="radio"
                                                    aria-checked={checked}
                                                    accessibilityState={{ disabled: busy }}
                                                    disabled={busy}
                                                    style={[styles.categoryRow, styles.categoryOption, checked && styles.chosen]}
                                                    onPress={() => {
                                                        edit({ category: code });
                                                        setCategoryOpen(false);
                                                        categoryButton.current?.focus();
                                                    }}
                                                >
                                                    <Text style={styles.categoryText}>{archived ? name + ' (arquivada)' : name}</Text>
                                                    <View style={[styles.radio, checked && styles.radioSelected]}>{checked && <View style={styles.radioDot} />}</View>
                                                </MotionPressable>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    }}
                </CategoryCatalog>
                <FieldError message={categoryError || (submitted ? missing.category : '')} />
                <Text {...track('description')} style={styles.label}>
                    Descrição
                </Text>
                <TextInput accessibilityLabel="Descrição" placeholder="Descreva o problema observado" value={draft.description} multiline maxLength={1000} editable={!busy} onChangeText={(description) => edit({ description })} style={styles.input} />
                <Text style={mobileStyles.meta}>{draft.description.length}/1.000 caracteres</Text>
                <FieldError message={submitted ? missing.description : ''} />
                <View style={styles.toggle}>
                    <Text style={styles.label}>Quero mostrar minha cara</Text>
                    <Switch accessibilityLabel="Quero mostrar minha cara" disabled={busy} value={draft.showIdentity} onValueChange={(showIdentity) => edit({ showIdentity })} />
                </View>
                <Text style={mobileStyles.meta}>{draft.showIdentity ? 'Seu nome e sua foto aparecerão nesta denúncia.' : 'Sua denúncia aparecerá como anônima, inclusive para o gestor.'}</Text>
                {!!error && (
                    <Text accessibilityLiveRegion="assertive" style={styles.error}>
                        {error}
                    </Text>
                )}
                <ActionButton label={reopens ? 'Salvar e reabrir' : editing ? 'Salvar alterações' : sending ? 'Enviando…' : 'Enviar denúncia'} pending={sending} disabled={preparing || stale} onPress={() => void send()} />
            </ScrollView>
            {photoSourcesOpen && (
                <Modal visible transparent animationType={motion ? 'slide' : 'none'} onShow={() => cameraChoice.current?.focus()} onRequestClose={closePhotoSources}>
                    <View style={styles.backdrop}>
                        <Pressable accessible={false} focusable={false} importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={closePhotoSources} />
                        <SafeAreaView edges={['bottom']} accessibilityViewIsModal style={styles.sheet}>
                            <ScrollView bounces={false} contentContainerStyle={styles.sheetBody}>
                                <View style={styles.sheetHeader}>
                                    <Text accessibilityRole="header" style={mobileStyles.heading}>
                                        Adicionar foto
                                    </Text>
                                    <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={closePhotoSources} style={styles.sheetClose}>
                                        <Text style={styles.closeSymbol}>×</Text>
                                    </Pressable>
                                </View>
                                <Pressable ref={cameraChoice} accessibilityRole="button" onPress={() => void addPhoto('camera')} style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}>
                                    <Text style={styles.sourceText}>Tirar foto</Text>
                                    <Icon name="next" size={16} />
                                </Pressable>
                                <Pressable accessibilityRole="button" onPress={() => void addPhoto('gallery')} style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}>
                                    <Text style={styles.sourceText}>Escolher da galeria</Text>
                                    <Icon name="next" size={16} />
                                </Pressable>
                            </ScrollView>
                        </SafeAreaView>
                    </View>
                </Modal>
            )}
            {mapOpen && (
                <ReportLocationPicker
                    saved={draft.location}
                    cancel={() => setMapOpen(false)}
                    confirm={(location) => {
                        edit({ location, automaticLocation: false });
                        setMapOpen(false);
                    }}
                />
            )}
        </>
    );
}
const styles = StyleSheet.create({
    page: { ...mobileStyles.page, justifyContent: 'space-between' },
    title: mobileStyles.title,
    label: { ...mobileStyles.label, marginTop: 8 },
    categoryField: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
    categoryRow: { minHeight: 48, flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 },
    categoryOption: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
    categoryText: { flex: 1, color: colors.ink, fontSize: 16, lineHeight: 22 },
    chosen: { backgroundColor: colors.pale },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    radioSelected: { borderColor: colors.teal },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal },
    input: { padding: 14, minHeight: 100, borderWidth: 1, borderRadius: 8, borderColor: colors.muted, backgroundColor: colors.surface, textAlignVertical: 'top', color: colors.ink, fontSize: 16 },
    formHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    formTitle: { ...mobileStyles.title, flex: 1 },
    back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    section: { ...mobileStyles.card, gap: 12 },
    sectionLabel: { ...mobileStyles.label, fontWeight: '700' },
    thumbnails: { flexDirection: 'row', gap: 8 },
    attachment: { width: '31%', maxWidth: 120, aspectRatio: 1, backgroundColor: colors.canvas, borderRadius: 8, overflow: 'hidden' },
    removePhoto: { position: 'absolute', right: 0, top: 0, width: 48, height: 48, alignItems: 'flex-end', padding: 4 },
    removeBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#18332fe8', borderWidth: 1, borderColor: '#ffffffcb' },
    removeSymbol: { color: '#fff', fontSize: 20, lineHeight: 23, fontWeight: '600' },
    emptyPhoto: { width: '100%', flexDirection: 'row', paddingVertical: 14, borderRadius: 8 },
    addPhoto: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.teal, backgroundColor: colors.surface },
    addSymbol: { color: colors.teal, fontSize: 26, lineHeight: 28 },
    addLabel: { color: colors.teal, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    pressed: { backgroundColor: colors.pale },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 46, 74, 0.42)' },
    sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    sheetBody: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetClose: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    closeSymbol: { fontSize: 26, color: colors.muted },
    sourceRow: { minHeight: 52, paddingVertical: 12, flexDirection: 'row', gap: 12, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
    sourceText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    locationCopy: { flex: 1, gap: 3 },
    toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
    error: mobileStyles.error,
});
