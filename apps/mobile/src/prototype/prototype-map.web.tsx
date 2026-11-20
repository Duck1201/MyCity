import { useRef, useState, type KeyboardEvent } from 'react';
import { OfflineStreets, extent } from './offline-streets.web';
import { Icon } from './civic-header';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/typography';
import { categoryName, type Case } from './fixtures';
import type { PrototypeMapProps } from './prototype-map';

const markerName = (item: Case) => 'Abrir ocorrência MC-' + item.id + ', ' + categoryName(item.category);
type Bounds = PrototypeMapProps['region']['current'];
type Group = { x: number; y: number; cases: Case[] };
const height = 310;
const minZoomSpan = 0.001;
const [west, south, east, north] = extent;
function constrain(viewport: Bounds, width: number) {
    const ratio = width / height / Math.cos((viewport.latitude * Math.PI) / 180);
    const latitudeDelta = Math.min(north - south, (east - west) / ratio, Math.max(minZoomSpan, viewport.latitudeDelta));
    const longitudeDelta = latitudeDelta * ratio;
    return { latitudeDelta, longitudeDelta, latitude: Math.max(south + latitudeDelta / 2, Math.min(north - latitudeDelta / 2, viewport.latitude)), longitude: Math.max(west + longitudeDelta / 2, Math.min(east - longitudeDelta / 2, viewport.longitude)) };
}

function fit(records: Case[], width: number): Bounds {
    const latitudes = records.map((item) => item.point.latitude);
    const longitudes = records.map((item) => item.point.longitude);
    const south = Math.min(...latitudes),
        north = Math.max(...latitudes);
    const west = Math.min(...longitudes),
        east = Math.max(...longitudes);
    return { latitude: (north + south) / 2, longitude: (west + east) / 2, latitudeDelta: Math.max(0.003, (north - south) * 1.55, ((east - west) * 1.55 * height * Math.cos(((north + south) * Math.PI) / 360)) / width), longitudeDelta: Math.max(0.003, (east - west) * 1.55) };
}

function mapGroups(records: Case[], viewport: Bounds, width: number) {
    const groups: Group[] = [];
    for (const item of records) {
        const x = 0.5 + (item.point.longitude - viewport.longitude) / viewport.longitudeDelta;
        const y = 0.5 - (item.point.latitude - viewport.latitude) / viewport.latitudeDelta;
        if (x < 0 || x > 1 || y < 0 || y > 1) continue;
        const near = groups.find((group) => Math.abs(group.x - x) * width < 42 && Math.abs(group.y - y) * height < 42);
        if (near) near.cases.push(item);
        else groups.push({ x, y, cases: [item] });
    }
    return groups;
}
function Tool({ label, icon, onPress, disabled = false }: { label: string; icon: string; onPress: () => void; disabled?: boolean }) {
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.tool, pressed && styles.pressed, disabled && styles.disabled]}>
            <Text style={styles.toolText}>{icon}</Text>
        </Pressable>
    );
}

export function PrototypeMap({ records, region, selectedGroup, open }: PrototypeMapProps) {
    const [selected, setSelected] = useState<number | null>(selectedGroup?.current ?? null);
    const [view, setViewport] = useState(region.current);
    const drag = useRef<{ x: number; y: number; start: Bounds } | null>(null);
    const [width, setWidth] = useState(320);
    const viewport = constrain(view, width);
    const groups = mapGroups(records, viewport, width);
    const selection = groups.find((group) => group.cases[0]!.id === selected && group.cases.length > 1);
    function selectGroup(value: number | null) {
        if (selectedGroup) selectedGroup.current = value;
        setSelected(value);
    }
    function move(next: Bounds) {
        region.current = constrain(next, width);
        setViewport(region.current);
        selectGroup(null);
    }
    function zoom(factor: number) {
        move({ ...viewport, latitudeDelta: viewport.latitudeDelta * factor });
    }
    function keyboard(event: KeyboardEvent<HTMLDivElement>) {
        const shift: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
        const delta = shift[event.key];
        if (!delta) return;
        event.preventDefault();
        move({ ...viewport, longitude: viewport.longitude + delta[0] * viewport.longitudeDelta * 0.22, latitude: viewport.latitude + delta[1] * viewport.latitudeDelta * 0.22 });
    }
    return (
        <View style={styles.map}>
            <View
                style={styles.plot}
                onLayout={(e) => {
                    const measured = e.nativeEvent.layout.width;
                    if (measured > 0) setWidth(measured);
                }}
            >
                <div
                    role="group"
                    aria-label="Deslocar mapa de Viçosa"
                    tabIndex={0}
                    onKeyDown={keyboard}
                    style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
                    onPointerDown={(e) => {
                        if (!e.isPrimary || e.button !== 0) return;
                        drag.current = { x: e.clientX, y: e.clientY, start: viewport };
                        e.currentTarget.setPointerCapture(e.pointerId);
                        e.currentTarget.style.cursor = 'grabbing';
                    }}
                    onPointerMove={(e) => {
                        const from = drag.current;
                        if (!from || !e.isPrimary) return;
                        move({ ...from.start, longitude: from.start.longitude - ((e.clientX - from.x) / width) * from.start.longitudeDelta, latitude: from.start.latitude + ((e.clientY - from.y) / height) * from.start.latitudeDelta });
                    }}
                    onLostPointerCapture={(e) => {
                        drag.current = null;
                        e.currentTarget.style.cursor = 'grab';
                    }}
                >
                    <OfflineStreets region={viewport} width={width} height={height} markers={groups} />
                </div>
                <Text pointerEvents="none" style={styles.north}>
                    ↑ N
                </Text>
                <View pointerEvents="none" style={styles.scale}>
                    <Text style={styles.scaleLabel}>{Math.round(viewport.longitudeDelta * 111320 * Math.cos((viewport.latitude * Math.PI) / 180) * 0.2)} m</Text>
                </View>
                {groups.map((group) => {
                    const first = group.cases[0]!;
                    const shared = group.cases.length > 1;
                    const same = group.cases.every((item) => item.point.latitude === first.point.latitude && item.point.longitude === first.point.longitude);
                    const name = shared ? group.cases.length + (same ? ' ocorrências neste ponto' : ' ocorrências próximas') : markerName(first);
                    return (
                        <Pressable key={first.id} accessibilityRole="button" accessibilityLabel={name} accessibilityHint={shared ? 'Mostra as ocorrências deste grupo' : first.place} onPress={() => (shared ? selectGroup(selected === first.id ? null : first.id) : open(first))} style={[styles.pin, { left: `${group.x * 100}%`, top: `${group.y * 100}%` }]}>
                            {shared ? <Text style={styles.cluster}>{group.cases.length}</Text> : <View style={styles.pinDot} />}
                        </Pressable>
                    );
                })}
                <View style={styles.controls}>
                    <Tool label="Aproximar mapa" icon="+" disabled={viewport.latitudeDelta <= minZoomSpan} onPress={() => zoom(1 / 1.6)} />
                    <Tool label="Afastar mapa" icon="−" disabled={constrain({ ...viewport, latitudeDelta: viewport.latitudeDelta * 1.6 }, width).latitudeDelta === viewport.latitudeDelta} onPress={() => zoom(1.6)} />
                    <Pressable accessibilityRole="button" accessibilityLabel="Enquadrar ocorrências" disabled={!records.length} onPress={() => move(fit(records, width))} style={styles.tool}>
                        <Icon name="pin" size={18} />
                    </Pressable>
                </View>
            </View>
            <View style={styles.legend}>
                <Text style={styles.caption}>Ocorrências demonstrativas</Text>
                <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')} style={[styles.caption, { textDecorationLine: 'underline' }]}>
                    © OpenStreetMap contributors
                </Text>
            </View>
            {records.length > 0 && !groups.length && <Text style={styles.caption}>Nenhuma ocorrência nesta área. Use Enquadrar para localizar os registros do filtro.</Text>}
            {selection?.cases.map((item) => (
                <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={markerName(item)} onPress={() => open(item)} style={styles.choice}>
                    <Text style={styles.choiceText}>
                        MC-{item.id} · {categoryName(item.category)}
                    </Text>
                    <Text style={styles.place}>{item.place}</Text>
                </Pressable>
            ))}
        </View>
    );
}
const styles = StyleSheet.create({
    map: { borderRadius: 10, borderColor: '#bccdd9', borderWidth: 1, backgroundColor: 'white', overflow: 'hidden' },
    plot: { height, backgroundColor: '#e8e6df', overflow: 'hidden' },
    north: { position: 'absolute', top: 10, left: 12, backgroundColor: '#ffffffec', color: '#334c5e', paddingHorizontal: 6, borderRadius: 4, fontSize: 12, fontWeight: '700' },
    scale: { position: 'absolute', bottom: 10, left: 12, width: '20%', borderBottomWidth: 2, borderColor: '#475c64', alignItems: 'center', backgroundColor: '#ffffffd9' },
    scaleLabel: { fontSize: 10, color: '#28434b' },
    pin: { position: 'absolute', height: 44, width: 44, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: '-50%' }, { translateY: '-50%' }] },
    pinDot: { height: 20, width: 20, borderWidth: 3, borderColor: 'white', borderRadius: 10, borderBottomLeftRadius: 2, backgroundColor: '#20578f', transform: [{ rotate: '-45deg' }], boxShadow: '0 1px 4px #243b5666' },
    cluster: { minWidth: 32, height: 32, lineHeight: 28, textAlign: 'center', borderWidth: 2, borderColor: 'white', borderRadius: 16, color: 'white', backgroundColor: '#174672', fontWeight: '800', fontSize: 15 },
    legend: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingVertical: 7, paddingHorizontal: 10 },
    caption: { fontSize: 11, color: '#536876' },
    controls: { position: 'absolute', right: 8, top: 8, backgroundColor: 'white', borderRadius: 7, borderWidth: 1, borderColor: '#bccbd3', overflow: 'hidden' },
    tool: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    toolText: { fontSize: 21, fontWeight: '700', color: '#254e71' },
    disabled: { opacity: 0.4 },
    pressed: { backgroundColor: '#e7eff5' },
    choice: { minHeight: 44, justifyContent: 'center', borderTopWidth: 1, borderColor: '#d5dfe8', padding: 10 },
    choiceText: { fontSize: 14, fontWeight: '700', color: '#24578e' },
    place: { fontSize: 13, color: '#455b72' },
});
