import { CategoryCatalog } from './category-catalog';
import { useCitizenRequest } from './citizen-api';
import { colors, mobileStyles } from './theme';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, Keyboard, ScrollView, StyleSheet, Switch, View, type LayoutChangeEvent } from 'react-native';
import { Text, TextInput } from './components/typography';
import { MotionPressable } from './components/motion-pressable';
import { useMotionEnabled } from './components/use-motion-enabled';
import { Icon } from './prototype/civic-header';
import { ReportLocationPicker } from './report-location-picker';
import * as GPS from 'expo-location';
import { readDevicePosition } from './device-position';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { locationSchema, type Location, type ReportDetail, type ReportCategory } from '@mycity/contracts';
import { ActionButton } from './components/action-button';
import { ReportOverview } from './report-overview';
import { pickReportPhoto } from './report-photos';

export type CitizenDraft = { category: ReportCategory | null; description: string; photos: string[]; location: Location | null; automaticLocation?: boolean; showIdentity: boolean; requestId: string };
function emptyDraft(): CitizenDraft {
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

type Props = { onBack?: () => void; token: string; apiBase: string; onSessionExpired: () => void; onPublished?: (report: ReportDetail) => void; draftRef?: { current: CitizenDraft | null } };
export function CitizenReport({ token, apiBase, onSessionExpired, onPublished, draftRef, onBack }: Props) {
    const catalogRequest = useCitizenRequest(apiBase, token, onSessionExpired);
    const [draft, setDraft] = useState(() => draftRef?.current ?? emptyDraft());
    const [catalogVersion, setCatalogVersion] = useState(0);
    const [error, setError] = useState('');
    const [photoError, setPhotoError] = useState('');
    const [categoryError, setCategoryError] = useState('');
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
    const busy = preparing || sending;
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
        function stop() {
            current?.abort();
            current = null;
            resume = false;
        }
        async function acquire() {
            if (AppState.currentState === 'background') {
                resume = true;
                return;
            }
            const controller = new AbortController();
            current = controller;
            setGpsStatus('locating');
            try {
                const permission = await GPS.requestForegroundPermissionsAsync();
                if (controller.signal.aborted) return;
                if (!permission.granted) {
                    setGpsStatus('denied');
                    return;
                }
                const { coords } = await readDevicePosition(controller.signal);
                if (controller.signal.aborted) return;
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
            if (state === 'background' && current) {
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
        photos: draft.photos.length ? '' : 'Adicione pelo menos uma foto.',
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
        if (changes.photos) setPhotoError('');
        setError('');
        setDraft((prev) => ({ ...prev, ...changes, requestId: randomUUID() }));
    }
    async function addPhoto(source: 'camera' | 'gallery') {
        if (busy || draft.photos.length >= 3) return;
        setPreparing(true);
        setPhotoError('');
        setError('');
        try {
            const uri = await pickReportPhoto(source);
            if (uri && mounted.current) edit({ photos: [...draft.photos, uri] });
        } catch (cause) {
            if (mounted.current) setPhotoError(cause instanceof Error && /^(Permita|Escolha)/.test(cause.message) ? cause.message : 'Não foi possível preparar a foto. Escolha outra imagem ou tente novamente.');
        } finally {
            if (mounted.current) setPreparing(false);
        }
    }
    async function send() {
        if (inFlight.current || busy || mapOpen) return;
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
            form.append('metadata', JSON.stringify({ clientRequestId: draft.requestId, description: draft.description.trim(), category: draft.category, showIdentity: draft.showIdentity, location: draft.location }));
            draft.photos.forEach((uri) => form.append('photos', new File(uri)));
            const response = await fetch(apiBase + '/reports', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form, signal: controller.signal });
            if (!mounted.current) return;
            if (response.status === 401) {
                onSessionExpired();
                return;
            }
            if (!response.ok) {
                if (response.status === 409) {
                    const failure = await response.json().catch(() => null);
                    if (!mounted.current) return;
                    if (failure?.error?.code === 'CATEGORY_ARCHIVED') {
                        edit({ category: null });
                        setCatalogVersion((version) => version + 1);
                        reveal('category');
                        setCategoryError('Esta categoria foi arquivada. Escolha outra para enviar seu registro.');
                        return;
                    }
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
                        setDraft(emptyDraft());
                        setSubmitted(false);
                        setPhotoError('');
                        setCategoryError('');
                        setDetail(null);
                    }}
                />
            </ScrollView>
        );

    return (
        <>
            <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
                {onBack && (
                    <MotionPressable accessibilityRole="button" onPress={onBack} style={styles.back}>
                        <Icon name="back" color={colors.teal} size={18} />
                        <Text style={styles.linkText}>Voltar</Text>
                    </MotionPressable>
                )}
                <Text accessibilityRole="header" style={styles.title}>
                    Registrar denúncia
                </Text>
                <Text {...track('photos')} style={styles.label}>
                    Fotos ({draft.photos.length}/3)
                </Text>
                <View style={styles.section}>
                    <Text style={mobileStyles.meta}>Adicione de uma a três fotos. Cada JPEG pode ter até 5 MiB.</Text>
                    {draft.photos.length > 0 && (
                        <View style={styles.thumbnails}>
                            {draft.photos.map((uri, i) => (
                                <View key={uri} style={styles.attachment}>
                                    <Image source={{ uri }} accessibilityLabel={'Prévia da foto ' + (i + 1)} resizeMode="contain" style={styles.photo} />
                                    <MotionPressable accessibilityRole="button" accessibilityLabel={'Remover foto ' + (i + 1)} disabled={busy} onPress={() => edit({ photos: draft.photos.filter((_, index) => index !== i) })} style={({ pressed }) => [styles.removePhoto, pressed && styles.highlight]}>
                                        <Text style={styles.linkText}>Remover</Text>
                                    </MotionPressable>
                                </View>
                            ))}
                        </View>
                    )}
                    {draft.photos.length < 3 && (
                        <View style={styles.choices}>
                            <View style={styles.photoAction}>
                                <ActionButton label="Câmera" disabled={busy} onPress={() => void addPhoto('camera')} />
                            </View>
                            <View style={styles.photoAction}>
                                <ActionButton variant="secondary" label="Galeria" disabled={busy} onPress={() => void addPhoto('gallery')} />
                            </View>
                        </View>
                    )}
                    {preparing && <Text accessibilityLiveRegion="polite">Preparando foto…</Text>}
                    <FieldError message={photoError || (submitted ? missing.photos : '')} />
                </View>
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
                <CategoryCatalog key={catalogVersion} request={catalogRequest} activeOnly>
                    {(categories) => (
                        <View style={styles.choices}>
                            {categories.map(({ id: code, name }) => (
                                <MotionPressable key={code} accessibilityRole="radio" accessibilityState={{ checked: draft.category === code, disabled: busy }} disabled={busy} style={[styles.choice, code === draft.category && styles.chosen]} onPress={() => edit({ category: code })}>
                                    <Text style={code === draft.category ? styles.active : styles.text}>{name}</Text>
                                </MotionPressable>
                            ))}
                        </View>
                    )}
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
                {error && (
                    <Text accessibilityLiveRegion="assertive" style={styles.error}>
                        {error}
                    </Text>
                )}
                <ActionButton label={sending ? 'Enviando…' : 'Enviar denúncia'} pending={sending} disabled={preparing} onPress={() => void send()} />
            </ScrollView>
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
    page: mobileStyles.page,
    title: mobileStyles.title,
    label: { ...mobileStyles.label, marginTop: 8 },
    choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    choice: { width: '48%', minHeight: 48, paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8 },
    chosen: { backgroundColor: colors.teal, borderColor: colors.teal },
    active: { color: colors.surface, fontWeight: '700' },
    text: { color: colors.ink, fontSize: 15 },
    input: { padding: 14, minHeight: 100, borderWidth: 1, borderRadius: 8, borderColor: colors.muted, backgroundColor: colors.surface, textAlignVertical: 'top', color: colors.ink, fontSize: 16 },
    back: { alignSelf: 'flex-start', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
    linkText: { fontSize: 15, fontWeight: '700', color: colors.teal },
    section: { ...mobileStyles.card, gap: 12 },
    sectionLabel: { ...mobileStyles.label, fontWeight: '700' },
    thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    attachment: { flexBasis: 76, flexGrow: 1, maxWidth: 124, borderColor: colors.line, borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
    photo: { width: '100%', aspectRatio: 1, backgroundColor: colors.canvas },
    removePhoto: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    highlight: { backgroundColor: colors.pale },
    photoAction: { flexGrow: 1, flexBasis: 96 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    locationCopy: { flex: 1, gap: 3 },
    toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
    error: mobileStyles.error,
});
