import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { PROVIDER_GOOGLE, type Camera, type LatLng, type Region } from './map-view';
import Svg, { Circle, Path } from 'react-native-svg';
import * as GPS from 'expo-location';
import { locationSchema, type Location } from '@mycity/contracts';
import { ActionButton } from './components/action-button';
import { MotionPressable } from './components/motion-pressable';
import { Text } from './components/typography';
import { readDevicePosition } from './device-position';
import { cityRegion, pointRegion } from './map-region';
import { Icon } from './components/civic-header';
import { colors, mobileStyles } from './theme';

type Props = { saved: Location | null; confirm: (point: Location) => void; cancel: () => void };

const streetZoom = 17;
export function ReportLocationPicker({ saved, confirm, cancel }: Props) {
    const [candidate, setCandidate] = useState(saved);
    const [locating, setLocating] = useState(false);
    const [moving, setMoving] = useState(false);
    const [error, setError] = useState('');
    const map = useRef<MapView>(null);
    const initialRegion = useRef(saved ? pointRegion(saved) : cityRegion).current;
    const longitudeDelta = useRef(initialRegion.longitudeDelta);
    const ready = useRef(false);
    const pendingCamera = useRef<Partial<Camera> | null>(saved ? { center: saved, zoom: streetZoom } : null);
    const gesture = useRef(false);
    const attempt = useRef(0);
    const gpsRequest = useRef<AbortController | null>(null);
    function abortGps() {
        gpsRequest.current?.abort();
        gpsRequest.current = null;
    }
    useEffect(() => {
        const listener = AppState.addEventListener('change', (state) => {
            if (state === 'background' && gpsRequest.current) {
                abortGps();
                setLocating(false);
            }
        });
        return () => {
            listener.remove();
            abortGps();
            attempt.current++;
        };
    }, []);

    function center(point: LatLng) {
        const target = { center: { latitude: point.latitude, longitude: point.longitude }, ...(longitudeDelta.current > 0.01 && { zoom: streetZoom }) };
        if (ready.current) map.current?.setCamera(target);
        else pendingCamera.current = target;
    }

    function tap(point?: LatLng) {
        if (!point) return;
        const { latitude, longitude } = point;
        abortGps();
        attempt.current++;
        gesture.current = false;
        setMoving(false);
        setLocating(false);
        setError('');
        setCandidate({ latitude, longitude, source: 'MANUAL' });
        center({ latitude, longitude });
    }

    function beginMove() {
        abortGps();
        attempt.current++;
        gesture.current = true;
        pendingCamera.current = null;
        setMoving(true);
        setLocating(false);
        setError('');
    }

    async function finishMove(region: Region, isGesture: boolean) {
        longitudeDelta.current = region.longitudeDelta;
        if (!isGesture || !gesture.current) return;
        const current = attempt.current;
        gesture.current = false;
        try {
            // Android's region is derived from the visible bounds. The camera target is directly under the pin.
            const camera = await map.current?.getCamera();
            if (current === attempt.current) setCandidate(locationSchema.parse({ latitude: camera?.center.latitude, longitude: camera?.center.longitude, source: 'MANUAL' }));
        } catch {
            if (current === attempt.current) {
                setCandidate(null);
                setError('Toque no mapa para marcar o local da ocorrência.');
            }
        } finally {
            if (current === attempt.current) setMoving(false);
        }
    }

    async function locate() {
        if (gpsRequest.current || AppState.currentState === 'background') return;
        attempt.current++;
        const controller = new AbortController();
        gpsRequest.current = controller;
        setLocating(true);
        setError('');
        try {
            const permission = await GPS.requestForegroundPermissionsAsync();
            if (controller.signal.aborted) return;
            if (!permission.granted) {
                setError('Localização sem permissão. Toque no mapa para escolher o ponto.');
                return;
            }
            const { coords } = await readDevicePosition(controller.signal);
            if (controller.signal.aborted) return;
            const point = locationSchema.parse({ latitude: coords.latitude, longitude: coords.longitude, source: 'GPS' });
            setCandidate(point);
            center(point);
        } catch {
            if (!controller.signal.aborted) setError('GPS indisponível. Toque no mapa para escolher o ponto.');
        } finally {
            if (gpsRequest.current === controller) {
                gpsRequest.current = null;
                setLocating(false);
            }
        }
    }

    const status = moving ? 'Ajustando o ponto…' : candidate?.source === 'GPS' ? 'Localização do aparelho' : candidate ? 'Local escolhido no mapa' : 'Onde aconteceu?';
    return (
        <Modal visible presentationStyle="fullScreen" onRequestClose={cancel}>
            <SafeAreaView style={styles.screen}>
                <View style={styles.header}>
                    <MotionPressable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={cancel} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
                        <Icon name="back" color={colors.teal} size={22} />
                    </MotionPressable>
                    <Text accessibilityRole="header" style={styles.title}>
                        Escolher localização
                    </Text>
                </View>
                <View style={styles.map}>
                    <MapView
                        ref={map}
                        testID="location-map"
                        provider={PROVIDER_GOOGLE}
                        userInterfaceStyle="light"
                        toolbarEnabled={false}
                        zoomControlEnabled={false}
                        rotateEnabled={false}
                        pitchEnabled={false}
                        style={StyleSheet.absoluteFill}
                        initialRegion={initialRegion}
                        onMapReady={() => {
                            ready.current = true;
                            if (pendingCamera.current) map.current?.setCamera(pendingCamera.current);
                            pendingCamera.current = null;
                        }}
                        onRegionChangeStart={(_region, details) => {
                            if (details?.isGesture) beginMove();
                        }}
                        onRegionChangeComplete={(region, details) => void finishMove(region, !!details?.isGesture)}
                        onPress={(event) => tap(event?.nativeEvent?.coordinate)}
                    />
                    <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.pin}>
                        <Svg width={36} height={44} viewBox="0 0 36 44">
                            <Path d="M18 42C15 38 2 25 2 18a16 16 0 1 1 32 0c0 7-13 20-16 24Z" fill={colors.teal} stroke={colors.surface} strokeWidth={2.5} />
                            <Circle cx={18} cy={17} r={5} fill={colors.surface} />
                        </Svg>
                    </View>
                    <MotionPressable accessibilityRole="button" accessibilityLabel={locating ? 'Buscando GPS…' : 'Usar GPS'} accessibilityState={{ disabled: locating || moving, busy: locating }} disabled={locating || moving} onPress={() => void locate()} style={({ pressed }) => [styles.gps, pressed && styles.pressed]}>
                        {locating ? <ActivityIndicator color={colors.teal} size="small" /> : <Icon name="pin" color={colors.teal} size={21} />}
                        <Text style={styles.gpsText}>GPS</Text>
                    </MotionPressable>
                </View>
                <View style={styles.footer}>
                    <Text accessibilityLiveRegion="polite" style={mobileStyles.heading}>
                        {status}
                    </Text>
                    <Text style={mobileStyles.meta}>Mova o mapa até o pino indicar o local, ou toque no ponto desejado.</Text>
                    {!!error && (
                        <Text accessibilityLiveRegion="polite" style={mobileStyles.error}>
                            {error}
                        </Text>
                    )}
                    <ActionButton label="Confirmar ponto" disabled={!candidate || locating || moving} onPress={() => candidate && confirm(candidate)} />
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    header: { paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
    back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
    pressed: { backgroundColor: colors.pale },
    title: { ...mobileStyles.heading, flex: 1 },
    map: { flex: 1, backgroundColor: colors.canvas },
    pin: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -42 },
    gps: { position: 'absolute', right: 16, bottom: 16, minHeight: 48, borderRadius: 24, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, elevation: 3 },
    gpsText: { color: colors.teal, fontSize: 15, fontWeight: '700' },
    footer: { paddingHorizontal: 18, paddingVertical: 14, gap: 10, borderTopWidth: 1, borderColor: colors.line },
});
