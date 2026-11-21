import { categoryLabel } from './category-catalog';
import { mobileStyles, colors, statusTint } from './theme';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import * as Location from 'expo-location';
import { readDevicePosition } from './device-position';
import { cityRegion, pointRegion } from './map-region';
import { ActivityIndicator, Animated, AppState, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from './components/civic-header';
import { MotionPressable } from './components/motion-pressable';
import { useMotionEnabled } from './components/use-motion-enabled';
import { Text } from './components/typography';
import MapView, { Marker, PROVIDER_GOOGLE, type LatLng, type Region } from './map-view';
import { locationSchema, type ReportMarker } from '@mycity/contracts';
import { statusLabels } from './report-overview';
import { activeStatuses, Filters, filteredPath, type ReportFilters } from './report-filters';
import type { CitizenRequest } from './citizen-api';
import { useActiveQuery } from './use-active-query';
import { ActionButton } from './components/action-button';
import { MapMarkers } from './map-markers';
import { confirmationLabel } from './report-confirmation';

type Bounds = [west: number, south: number, east: number, north: number];

function boundsFor(region: Region): Bounds[] {
    const south = Math.max(-90, region.latitude - region.latitudeDelta / 2);
    const north = Math.min(90, region.latitude + region.latitudeDelta / 2);
    const bbox = (west: number, east: number): Bounds => [west, south, east, north];
    if (region.longitudeDelta >= 360) return [bbox(-180, 180)];
    const west = region.longitude - region.longitudeDelta / 2;
    const east = region.longitude + region.longitudeDelta / 2;
    if (west < -180) return [bbox(west + 360, 180), bbox(-180, east)];
    if (east > 180) return [bbox(west, 180), bbox(-180, east - 360)];
    return [bbox(west, east)];
}
function queryBounds([west, south, east, north]: Bounds) {
    const cellsPerDegree = 100;
    const down = (value: number) => Math.floor(value * cellsPerDegree) / cellsPerDegree;
    const up = (value: number) => Math.ceil(value * cellsPerDegree) / cellsPerDegree;
    return [down(west), down(south), up(east), up(north)].join(',');
}

type MarkersPage = { data: ReportMarker[]; page: { nextCursor: string | null } };
export type MapViewport = { region: Region; deviceLocation: LatLng | null; selectedId?: string | null };
const emptyGroup: ReadonlySet<string> = new Set();
export function CommunityMap({ request, filters, setFilters, viewport, setViewport, showList, setShowList, open }: { request: CitizenRequest; filters: ReportFilters; setFilters: (v: ReportFilters) => void; viewport: MapViewport | null; setViewport: Dispatch<SetStateAction<MapViewport | null>>; showList: boolean; setShowList: (show: boolean) => void; open: (id: string) => void }) {
    const map = useRef<MapView>(null);
    const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
    const [groupIds, setGroupIds] = useState<ReadonlySet<string>>(() => new Set());
    const motion = useMotionEnabled();
    const cameraIntent = useRef(0);
    const mapReady = useRef(false);
    const cameraTarget = useRef<Region | null>(null);
    const attempt = useRef<AbortController | null>(null);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState('');
    const centerOnDevice = useCallback(async () => {
        if (attempt.current) return;
        const controller = new AbortController();
        attempt.current = controller;
        const intent = cameraIntent.current;
        setLocating(true);
        setLocationError('');
        let deviceLocation: LatLng | null = null;
        let destination: Region | undefined;
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (controller.signal.aborted) return;
            if (!permission.granted) {
                setLocationError('Localização sem permissão. Você pode explorar o mapa manualmente.');
                return;
            }
            if (AppState.currentState === 'background') throw new Error('Localização indisponível.');
            const { coords } = await readDevicePosition(controller.signal);
            if (controller.signal.aborted) return;
            const { latitude, longitude } = locationSchema.parse({ latitude: coords.latitude, longitude: coords.longitude, source: 'GPS' });
            deviceLocation = { latitude, longitude };
            if (intent !== cameraIntent.current) return;
            destination = pointRegion(deviceLocation);
            if (mapReady.current) map.current?.animateToRegion(destination, 0);
            else cameraTarget.current = destination;
        } catch {
            if (!controller.signal.aborted) setLocationError('GPS indisponível. Você pode explorar o mapa manualmente.');
        } finally {
            if (!controller.signal.aborted) {
                attempt.current = null;
                setViewport((current) => ({ ...current, region: destination ?? current?.region ?? cityRegion, deviceLocation: deviceLocation ?? current?.deviceLocation ?? null }));
                setLocating(false);
            }
        }
    }, [setViewport]);
    useEffect(() => {
        if (!viewport) void centerOnDevice();
    }, [viewport, centerOnDevice]);
    useEffect(
        () => () => {
            attempt.current?.abort();
            attempt.current = null;
        },
        [],
    );

    const visible = boundsFor(viewport?.region ?? cityRegion);
    const area = visible.map(queryBounds).join(';');
    const path = filteredPath('/reports/map', filters);
    const load = useCallback(
        async (signal: AbortSignal) => {
            const markers = new Map<string, ReportMarker>();
            for (const bbox of area.split(';')) {
                const cursors = new Set<string>();
                const base = path + (path.includes('?') ? '&' : '?') + 'bbox=' + encodeURIComponent(bbox);
                let cursor: string | null = null;
                do {
                    const url = cursor ? base + '&cursor=' + encodeURIComponent(cursor) : base;
                    const result: MarkersPage = await request<MarkersPage>(url, signal);
                    result.data.forEach((point) => markers.set(point.id, point));
                    cursor = result.page.nextCursor;
                    if (cursor && cursors.has(cursor)) throw Error('Página do mapa repetida.');
                    if (cursor) cursors.add(cursor);
                } while (cursor && !signal.aborted);
            }
            return { area, path, markers: Array.from(markers.values()) };
        },
        [area, path, request],
    );
    const query = useActiveQuery(load, true, path + ':' + area);
    const current = query.data?.path === path && query.data.area === area;
    const pins = query.data?.markers.filter(({ latitude, longitude }) => visible.some(([west, south, east, north]) => longitude >= west && longitude <= east && latitude >= south && latitude <= north));
    const selected = pins?.find((point) => point.id === viewport?.selectedId);
    const group = pins?.filter((point) => groupIds.has(point.id)) ?? [];
    const select = useCallback(
        (id: string | null) => {
            cameraIntent.current++;
            setGroupIds(emptyGroup);
            setViewport((previous) => ({ region: cityRegion, deviceLocation: null, ...previous, selectedId: id }));
        },
        [setViewport],
    );
    const inspecting = !showList && (!!selected || group.length > 0);
    useEffect(() => {
        if (!inspecting || Platform.OS === 'web') return;
        const handler = BackHandler.addEventListener('hardwareBackPress', () => {
            select(null);
            return true;
        });
        return () => handler.remove();
    }, [inspecting, select]);
    function explore() {
        cameraIntent.current++;
        cameraTarget.current = null;
    }
    const summary = !pins ? 'Carregando pontos…' : !current ? 'Exibindo o resultado anterior.' : pins.length === 0 ? 'Nenhuma denúncia nesta área' : pins.length === 1 ? '1 denúncia nesta área' : pins.length + ' denúncias nesta área';
    const outsideCity = !visible.some(([west, south, east, north]) => cityRegion.longitude >= west && cityRegion.longitude <= east && cityRegion.latitude >= south && cityRegion.latitude <= north);
    function showCity() {
        explore();
        select(null);
        setViewport((previous) => ({ ...previous, deviceLocation: previous?.deviceLocation ?? null, region: cityRegion }));
        map.current?.animateToRegion(cityRegion, motion ? 200 : 0);
    }
    const tools = (
        <View pointerEvents="box-none" style={styles.tools}>
            <View style={styles.filterButton}>
                <Filters
                    request={request}
                    filters={filters}
                    statuses={[...activeStatuses, 'RESOLVED']}
                    onChange={(next) => {
                        select(null);
                        setFilters(next);
                    }}
                />
            </View>
            <MotionPressable
                accessibilityRole="button"
                accessibilityLabel={showList ? 'Ver mapa' : 'Ver lista'}
                style={styles.mode}
                onPress={() => {
                    mapReady.current = false;
                    cameraTarget.current = null;
                    setGroupIds(emptyGroup);
                    setShowList(!showList);
                }}
            >
                <Icon name={showList ? 'map' : 'feed'} size={18} />
                <Text style={styles.modeText}>{showList ? 'Mapa' : 'Lista'}</Text>
            </MotionPressable>
        </View>
    );
    const feedback = (
        <View style={styles.feedback}>
            <Text accessibilityLiveRegion="polite" style={styles.count}>
                {locating ? 'Buscando sua localização…' : summary}
            </Text>
            {!!locationError && (
                <Text accessibilityLiveRegion="polite" style={mobileStyles.meta}>
                    {locationError}
                </Text>
            )}
            {query.failed ? (
                <>
                    <Text style={mobileStyles.meta}>Não foi possível atualizar os pontos do mapa.</Text>
                    <ActionButton variant="secondary" label="Tentar novamente" onPress={query.retry} />
                </>
            ) : (
                outsideCity && current && !pins?.length && <ActionButton variant="secondary" label="Ver Viçosa" onPress={showCity} />
            )}
        </View>
    );
    return (
        <View style={styles.page}>
            {showList && (
                <View style={styles.listHeader}>
                    <Text style={mobileStyles.heading} accessibilityRole="header">
                        Denúncias nesta área
                    </Text>
                    {tools}
                    {feedback}
                </View>
            )}
            {showList ? (
                <ScrollView style={styles.map} contentContainerStyle={styles.list}>
                    {pins?.map((m) => (
                        <MotionPressable key={m.id} accessibilityRole="button" style={styles.listItem} onPress={() => open(m.id)}>
                            <Text style={mobileStyles.label}>{categoryLabel(m)}</Text>
                            <Text style={mobileStyles.meta}>
                                {statusLabels[m.status]} · {confirmationLabel(m.confirmationCount)}
                            </Text>
                        </MotionPressable>
                    ))}
                </ScrollView>
            ) : (
                <View
                    style={styles.map}
                    onLayout={({
                        nativeEvent: {
                            layout: { width, height },
                        },
                    }) => setMapSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))}
                >
                    <MapView
                        ref={map}
                        toolbarEnabled={false}
                        rotateEnabled={false}
                        pitchEnabled={false}
                        poiClickEnabled={false}
                        customMapStyle={basemapStyle}
                        onPress={(event) => {
                            if (event.nativeEvent.action !== 'marker-press' && (selected || group.length)) select(null);
                        }}
                        moveOnMarkerPress={false}
                        showsMyLocationButton={false}
                        showsUserLocation={false}
                        userInterfaceStyle="light"
                        zoomControlEnabled={false}
                        testID="community-map"
                        provider={PROVIDER_GOOGLE}
                        initialRegion={viewport?.region ?? cityRegion}
                        style={StyleSheet.absoluteFill}
                        onMapReady={() => {
                            mapReady.current = true;
                            if (cameraTarget.current) map.current?.animateToRegion(cameraTarget.current, 0);
                            cameraTarget.current = null;
                        }}
                        onRegionChangeStart={(_, details) => {
                            if (details?.isGesture) explore();
                        }}
                        onRegionChangeComplete={(region, details) => {
                            if (details?.isGesture) explore();
                            if (region.latitudeDelta > 0 && region.longitudeDelta > 0) setViewport((previous) => ({ deviceLocation: null, ...previous, region }));
                        }}
                    >
                        {viewport?.deviceLocation && <Marker testID="device-location" coordinate={viewport.deviceLocation} pinColor={colors.deepTeal} title="Sua localização" />}
                        <MapMarkers
                            pins={pins ?? []}
                            region={viewport?.region ?? cityRegion}
                            {...mapSize}
                            selectedId={viewport?.selectedId ?? null}
                            onSelect={select}
                            onGroup={(ids) => {
                                select(null);
                                setGroupIds(new Set(ids));
                            }}
                        />
                    </MapView>
                    <View pointerEvents="box-none" style={styles.overlayTools}>
                        {tools}
                    </View>
                    {!selected && !group.length && (
                        <View pointerEvents="box-none" style={styles.summaryPosition}>
                            {feedback}
                        </View>
                    )}
                    {!inspecting && (
                        <MotionPressable accessibilityRole="button" accessibilityLabel="Minha localização" disabled={locating} accessibilityState={{ busy: locating, disabled: locating }} style={styles.locate} onPress={() => void centerOnDevice()}>
                            {locating ? <ActivityIndicator color={colors.teal} /> : <Icon name="pin" size={22} />}
                        </MotionPressable>
                    )}
                    {group.length > 0 && (
                        <View style={styles.card}>
                            <View style={styles.groupHeading}>
                                <Text accessibilityRole="header" style={styles.category}>
                                    {group.length} denúncias próximas
                                </Text>
                                <MotionPressable accessibilityRole="button" accessibilityLabel="Fechar grupo" onPress={() => select(null)} style={styles.close}>
                                    <Text style={styles.closeLabel}>×</Text>
                                </MotionPressable>
                            </View>
                            <ScrollView>
                                {group.map((point) => (
                                    <MotionPressable key={point.id} accessibilityRole="button" style={styles.groupRow} onPress={() => select(point.id)}>
                                        <View style={styles.category}>
                                            <Text style={mobileStyles.label}>{categoryLabel(point)}</Text>
                                            <Text style={mobileStyles.meta}>
                                                {statusLabels[point.status]} · {confirmationLabel(point.confirmationCount)}
                                            </Text>
                                        </View>
                                        <Icon name="next" size={18} />
                                    </MotionPressable>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                    {selected && <MarkerSummary key={selected.id} marker={selected} motion={motion} open={open} close={() => select(null)} />}
                </View>
            )}
        </View>
    );
}

function MarkerSummary({ marker, motion, open, close }: { marker: ReportMarker; motion: boolean; open: (id: string) => void; close: () => void }) {
    const [progress] = useState(() => new Animated.Value(motion ? 0 : 1));
    useEffect(() => {
        if (!motion) {
            progress.setValue(1);
            return;
        }
        const animation = Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' });
        animation.start();
        return () => progress.stopAnimation();
    }, [motion, progress]);
    function dismiss() {
        if (!motion) return close();
        Animated.timing(progress, { toValue: 0, duration: 120, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
            if (finished) close();
        });
    }
    return (
        <Animated.View style={[styles.card, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
            <ScrollView contentContainerStyle={styles.cardBody}>
                <View style={styles.cardHeading}>
                    <Text accessibilityRole="header" style={styles.category}>
                        {categoryLabel(marker)}
                    </Text>
                    <MotionPressable accessibilityRole="button" accessibilityLabel="Fechar resumo" onPress={dismiss} style={styles.close}>
                        <Text style={styles.closeLabel}>×</Text>
                    </MotionPressable>
                </View>
                <Text style={mobileStyles.meta}>
                    <Text style={statusTint(marker.status)}>{statusLabels[marker.status]}</Text> · {confirmationLabel(marker.confirmationCount)}
                </Text>
                <ActionButton label="Ver denúncia" onPress={() => open(marker.id)} />
            </ScrollView>
        </Animated.View>
    );
}

const basemapStyle = [
    { featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.canvas },
    listHeader: { padding: 14, gap: 8 },
    overlayTools: { position: 'absolute', left: 12, top: 12, right: 74 },
    tools: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    filterButton: { flexShrink: 1, backgroundColor: colors.surface, borderRadius: 10, elevation: 3 },
    mode: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 7, borderRadius: 10, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, elevation: 3 },
    modeText: { color: colors.teal, fontSize: 15, fontWeight: '700' },
    feedback: { borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
    count: { ...mobileStyles.meta, color: colors.ink, fontWeight: '700' },
    summaryPosition: { position: 'absolute', bottom: 32, left: 12, right: 84, alignItems: 'flex-start' },
    groupHeading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
    groupRow: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: colors.line },
    map: { flex: 1, minHeight: 0, backgroundColor: colors.canvas },
    locate: { position: 'absolute', right: 20, bottom: 84, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 24, elevation: 3 },
    card: { position: 'absolute', left: 12, right: 12, bottom: 82, maxHeight: '48%', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, elevation: 4 },
    cardBody: { padding: 12, gap: 5 },
    cardHeading: { flexDirection: 'row', alignItems: 'center' },
    category: { ...mobileStyles.heading, flex: 1 },
    close: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    closeLabel: { color: colors.muted, fontSize: 26 },
    list: { padding: 12, paddingBottom: 88, gap: 8 },
    listItem: { ...mobileStyles.card },
});
