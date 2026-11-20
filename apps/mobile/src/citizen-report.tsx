import { CategoryCatalog } from './category-catalog';
import { useCitizenRequest } from './citizen-api';
import { colors, mobileStyles } from './theme';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from './components/typography';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as GPS from 'expo-location';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { type Location, type ReportDetail, type ReportCategory } from '@mycity/contracts';
import { ActionButton } from './components/action-button';
import { ReportOverview } from './report-overview';
import { pickReportPhoto } from './report-photos';

export type CitizenDraft = { category: ReportCategory | null; description: string; photos: string[]; location: Location | null; showIdentity: boolean; requestId: string };
function emptyDraft(): CitizenDraft {
    return { category: null, description: '', photos: [], location: null, showIdentity: true, requestId: randomUUID() };
}

type Props = { onBack?: () => void; token: string; apiBase: string; onSessionExpired: () => void; onPublished?: (report: ReportDetail) => void; draftRef?: { current: CitizenDraft | null } };
export function CitizenReport({ token, apiBase, onSessionExpired, onPublished, draftRef, onBack }: Props) {
    const catalogRequest = useCitizenRequest(apiBase, token, onSessionExpired);
    const [draft, setDraft] = useState(() => draftRef?.current ?? emptyDraft());
    const [catalogVersion, setCatalogVersion] = useState(0);
    const [error, setError] = useState('');
    const [mapOpen, setMapOpen] = useState(false);
    const [candidate, setCandidate] = useState<Location | null>(null);
    const [sending, setSending] = useState(false);
    const [locating, setLocating] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [detail, setDetail] = useState<ReportDetail | null>(null);
    const gpsAttempt = useRef(0);
    const inFlight = useRef(false);
    const mounted = useRef(true);
    const request = useRef<AbortController | null>(null);
    const busy = preparing || sending;
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            gpsAttempt.current++;
            request.current?.abort();
        };
    }, []);
    useEffect(() => {
        if (draftRef) draftRef.current = detail ? null : draft;
    }, [draft, draftRef, detail]);

    function edit(changes: Partial<CitizenDraft>) {
        setError('');
        setDraft((prev) => ({ ...prev, ...changes, requestId: randomUUID() }));
    }
    function chooseMap() {
        gpsAttempt.current++;
        setLocating(false);
        setCandidate(draft.location);
        setMapOpen(true);
        setError('');
    }
    async function locate() {
        const attempt = ++gpsAttempt.current;
        setLocating(true);
        setError('');
        try {
            if (!(await GPS.requestForegroundPermissionsAsync()).granted) throw new Error();
            const { coords } = await GPS.getCurrentPositionAsync({});
            if (attempt !== gpsAttempt.current) return;
            setCandidate({ latitude: coords.latitude, longitude: coords.longitude, source: 'GPS' });
            setMapOpen(true);
        } catch {
            if (attempt !== gpsAttempt.current) return;
            setCandidate(draft.location);
            setMapOpen(true);
            setError('GPS indisponível. Toque no mapa e confirme o ponto.');
        } finally {
            if (attempt === gpsAttempt.current) setLocating(false);
        }
    }
    async function addPhoto(source: 'camera' | 'gallery') {
        if (busy || draft.photos.length >= 3) return;
        setPreparing(true);
        setError('');
        try {
            const uri = await pickReportPhoto(source);
            if (uri && mounted.current) edit({ photos: [...draft.photos, uri] });
        } catch (cause) {
            if (mounted.current) setError(cause instanceof Error && /^(Permita|Escolha)/.test(cause.message) ? cause.message : 'Não foi possível preparar a foto. Escolha outra imagem ou tente novamente.');
        } finally {
            if (mounted.current) setPreparing(false);
        }
    }
    async function send() {
        if (inFlight.current || busy) return;
        if (!draft.category || !draft.description.trim() || !draft.location || draft.photos.length === 0 || mapOpen) {
            setError('Selecione a categoria, descreva o problema, adicione uma foto e confirme a localização.');
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
                        setError('Esta categoria foi arquivada. Escolha outra para enviar seu registro.');
                        return;
                    }
                }
                const message = response.status === 413 ? 'Fotos acima do limite. Remova uma imagem e tente novamente.' : response.status === 409 ? 'Os dados deste envio mudaram. Revise o formulário antes de reenviar.' : response.status === 422 ? 'Revise os campos e as fotos da denúncia.' : 'Não foi possível enviar. Seus dados foram preservados.';
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
                        setDetail(null);
                    }}
                />
            </ScrollView>
        );

    return (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
            {onBack && <ActionButton variant="secondary" label="Voltar" onPress={onBack} />}
            <Text accessibilityRole="header" style={styles.title}>
                Registrar denúncia
            </Text>
            <Text style={styles.label}>Categoria</Text>
            <CategoryCatalog key={catalogVersion} request={catalogRequest} activeOnly>
                {(categories) => (
                    <View style={styles.choices}>
                        {categories.map(({ id: code, name }) => (
                            <Pressable key={code} accessibilityRole="radio" accessibilityState={{ checked: draft.category === code, disabled: busy }} disabled={busy} style={[styles.choice, code === draft.category && styles.chosen]} onPress={() => edit({ category: code })}>
                                <Text style={code === draft.category ? styles.active : styles.text}>{name}</Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            </CategoryCatalog>
            <Text style={styles.label}>Descrição</Text>
            <TextInput accessibilityLabel="Descrição" placeholder="Descreva o problema observado" value={draft.description} multiline maxLength={1000} editable={!busy} onChangeText={(description) => edit({ description })} style={styles.input} />
            <Text style={mobileStyles.meta}>{draft.description.length}/1.000 caracteres</Text>
            <Text style={styles.label}>Fotos ({draft.photos.length}/3)</Text>
            <Text style={mobileStyles.meta}>Adicione de uma a três fotos. Cada JPEG pode ter até 5 MiB.</Text>
            {draft.photos.map((uri, i) => (
                <View key={uri}>
                    <Image source={{ uri }} accessibilityLabel={'Prévia da foto ' + (i + 1)} resizeMode="contain" style={styles.photo} />
                    <ActionButton variant="secondary" label={'Remover foto ' + (i + 1)} pending={busy} onPress={() => edit({ photos: draft.photos.filter((_, index) => index !== i) })} />
                </View>
            ))}
            {draft.photos.length < 3 && (
                <View style={styles.choices}>
                    <ActionButton variant="secondary" label="Câmera" pending={busy} onPress={() => void addPhoto('camera')} />
                    <ActionButton variant="secondary" label="Galeria" pending={busy} onPress={() => void addPhoto('gallery')} />
                </View>
            )}
            {preparing && <Text accessibilityLiveRegion="polite">Preparando foto…</Text>}
            <Text style={styles.label}>Localização</Text>
            {draft.location && (
                <Text>
                    Ponto confirmado: {draft.location.latitude}, {draft.location.longitude}
                </Text>
            )}
            <View style={styles.choices}>
                <ActionButton variant="secondary" label={locating ? 'Buscando GPS…' : 'Usar GPS'} pending={busy || locating} onPress={() => void locate()} />
                <ActionButton variant="secondary" label="Escolher no mapa" pending={busy} onPress={chooseMap} />
            </View>
            {mapOpen && (
                <>
                    <Text style={mobileStyles.meta}>Toque no mapa para ajustar o ponto da ocorrência.</Text>
                    <MapView testID="location-map" provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={{ latitude: candidate?.latitude ?? -14.2, longitude: candidate?.longitude ?? -51.9, latitudeDelta: candidate ? 0.018 : 36, longitudeDelta: candidate ? 0.018 : 36 }} onPress={(e) => setCandidate({ ...e.nativeEvent.coordinate, source: 'MANUAL' })}>
                        {candidate && <Marker coordinate={candidate} />}
                    </MapView>
                    {candidate && (
                        <Text>
                            {candidate.latitude}, {candidate.longitude}
                        </Text>
                    )}
                    <ActionButton
                        label="Confirmar ponto"
                        pending={!candidate}
                        onPress={() => {
                            if (candidate) edit({ location: candidate });
                            setMapOpen(false);
                        }}
                    />
                    <ActionButton
                        variant="secondary"
                        label="Fechar mapa"
                        onPress={() => {
                            setMapOpen(false);
                            setError('');
                        }}
                    />
                </>
            )}
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
            <ActionButton label={sending ? 'Enviando…' : 'Enviar denúncia'} pending={busy || locating} onPress={() => void send()} />
        </ScrollView>
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
    input: { padding: 14, minHeight: 100, borderWidth: 1, borderRadius: 8, borderColor: '#819ba5', backgroundColor: colors.surface, textAlignVertical: 'top', color: colors.ink, fontSize: 16 },
    map: { height: 260, width: '100%' },
    photo: { width: '100%', height: 190, backgroundColor: colors.canvas },
    toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
    error: mobileStyles.error,
});
