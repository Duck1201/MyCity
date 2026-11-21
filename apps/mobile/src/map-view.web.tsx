import { createContext, useContext, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LatLng, Region } from 'react-native-maps';
import { OfflineStreets, extent } from './offline-streets.web';
import { Text } from './components/typography';

const RegionContext = createContext<Region | null>(null);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
function longitude(value: number) {
    return Math.abs(value) <= 180 ? value : ((((value + 180) % 360) + 360) % 360) - 180;
}
type Camera = { center: LatLng; zoom?: number };
type MapHandle = { animateToRegion: (region: Region, duration?: number) => void; setCamera: (camera: Partial<Camera>) => void; getCamera: () => Promise<Camera> };
type RegionChange = (region: Region, details: { isGesture: boolean }) => void;
type MapProps = {
    ref?: Ref<MapHandle>;
    children?: ReactNode;
    testID?: string;
    style?: StyleProp<ViewStyle>;
    initialRegion: Region;
    onMapReady?: () => void;
    onPress?: (event: { nativeEvent: { coordinate: LatLng } }) => void;
    onRegionChangeStart?: RegionChange;
    onRegionChangeComplete?: RegionChange;
};

export const PROVIDER_GOOGLE = undefined;
export default function MapView({ ref, children, style, testID, initialRegion, onMapReady, onPress, onRegionChangeStart, onRegionChangeComplete }: MapProps) {
    const [view, setView] = useState(initialRegion);
    const current = useRef(initialRegion);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const ready = useRef(false);
    const drag = useRef<{ id: number; x: number; y: number; origin: Region; moved: boolean } | null>(null);

    function position(center: LatLng, span: number, regionSize = size) {
        const ratio = regionSize.width && regionSize.height ? (regionSize.height / regionSize.width) * Math.cos((clamp(center.latitude, -85, 85) * Math.PI) / 180) : initialRegion.latitudeDelta / initialRegion.longitudeDelta;
        const longitudeDelta = clamp(span, 0.00025, Math.min(360, 180 / ratio));
        const latitudeDelta = longitudeDelta * ratio;
        return { latitude: clamp(center.latitude, -90 + latitudeDelta / 2, 90 - latitudeDelta / 2), longitude: longitude(center.longitude), latitudeDelta, longitudeDelta };
    }
    function display(next: Region) {
        current.current = next;
        setView(next);
    }
    function complete(next: Region, isGesture: boolean) {
        display(next);
        onRegionChangeComplete?.(next, { isGesture });
    }
    function navigate(next: Region) {
        onRegionChangeStart?.(current.current, { isGesture: true });
        complete(next, true);
    }
    function zoom(factor: number) {
        navigate(position(current.current, current.current.longitudeDelta * factor));
    }
    useImperativeHandle(ref, () => ({
        animateToRegion: (next) => complete(position(next, next.longitudeDelta), false),
        setCamera: ({ center = current.current, zoom: level }) => complete(position(center, level === undefined ? current.current.longitudeDelta : (360 * (size.width || 360)) / (256 * 2 ** level)), false),
        getCamera: async () => ({ center: { latitude: current.current.latitude, longitude: current.current.longitude } }),
    }));
    useEffect(() => {
        if (size.width && size.height && !ready.current) {
            ready.current = true;
            onMapReady?.();
        }
    }, [size, onMapReady]);

    const [west, south, east, north] = extent;
    const outside = view.longitude - view.longitudeDelta / 2 > east || view.longitude + view.longitudeDelta / 2 < west || view.latitude - view.latitudeDelta / 2 > north || view.latitude + view.latitudeDelta / 2 < south;
    return (
        <View
            testID={testID}
            style={[style, styles.map]}
            onLayout={({ nativeEvent: { layout } }) => {
                if (!layout.width || !layout.height || (layout.width === size.width && layout.height === size.height)) return;
                const dimensions = { width: layout.width, height: layout.height };
                setSize(dimensions);
                complete(position(current.current, current.current.longitudeDelta, dimensions), false);
            }}
        >
            <div
                role="group"
                aria-label="Explorar mapa"
                tabIndex={0}
                style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
                onKeyDown={(event) => {
                    const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
                    const step = delta[event.key];
                    if (step) navigate(position({ latitude: view.latitude + step[1] * view.latitudeDelta * 0.2, longitude: view.longitude + step[0] * view.longitudeDelta * 0.2 }, view.longitudeDelta));
                    else if (event.key === '+' || event.key === '=') zoom(0.5);
                    else if (event.key === '-') zoom(2);
                    else if (event.key === 'Enter') onPress?.({ nativeEvent: { coordinate: { latitude: view.latitude, longitude: view.longitude } } });
                    else return;
                    event.preventDefault();
                }}
                onPointerDown={(event) => {
                    if (event.button !== 0 || !event.isPrimary) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: current.current, moved: false };
                }}
                onPointerMove={(event) => {
                    const start = drag.current;
                    if (!start || event.pointerId !== start.id) return;
                    const dx = event.clientX - start.x,
                        dy = event.clientY - start.y;
                    if (!start.moved && Math.hypot(dx, dy) < 4) return;
                    if (!start.moved) onRegionChangeStart?.(start.origin, { isGesture: true });
                    start.moved = true;
                    display(position({ latitude: start.origin.latitude + (dy / size.height) * start.origin.latitudeDelta, longitude: start.origin.longitude - (dx / size.width) * start.origin.longitudeDelta }, start.origin.longitudeDelta));
                }}
                onPointerUp={(event) => {
                    const start = drag.current;
                    if (!start || event.pointerId !== start.id) return;
                    drag.current = null;
                    if (start.moved) return complete(current.current, true);
                    const rect = event.currentTarget.getBoundingClientRect();
                    onPress?.({ nativeEvent: { coordinate: { latitude: view.latitude + (0.5 - (event.clientY - rect.top) / rect.height) * view.latitudeDelta, longitude: longitude(view.longitude + ((event.clientX - rect.left) / rect.width - 0.5) * view.longitudeDelta) } } });
                }}
                onLostPointerCapture={(event) => {
                    if (drag.current?.id !== event.pointerId) return;
                    if (drag.current.moved) complete(current.current, true);
                    drag.current = null;
                }}
            >
                {!!size.width && !!size.height && <OfflineStreets region={view} width={size.width} height={size.height} />}
            </div>
            <RegionContext.Provider value={view}>{children}</RegionContext.Provider>
            <View style={styles.zoom}>
                <Pressable accessibilityRole="button" accessibilityLabel="Aproximar mapa" style={styles.control} onPress={() => zoom(0.5)}>
                    <Text style={styles.sign}>+</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Afastar mapa" style={styles.control} onPress={() => zoom(2)}>
                    <Text style={styles.sign}>−</Text>
                </Pressable>
            </View>
            <div style={{ position: 'absolute', bottom: 2, right: 3, font: '11px Nunito, sans-serif', color: '#355348', background: '#fffffff0', padding: '2px 4px' }}>
                {outside && <Text style={styles.credit}>Fora da base de ruas de Viçosa · </Text>}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                    <Text style={styles.credit}>© OpenStreetMap contributors</Text>
                </a>
            </div>
        </View>
    );
}

type MarkerProps = { coordinate: LatLng; anchor?: { x: number; y: number }; children?: ReactNode; pinColor?: string; zIndex?: number; testID?: string; title?: string; accessibilityLabel?: string; onPress?: () => void };
export function Marker({ coordinate, anchor = { x: 0.5, y: 0.5 }, children, pinColor, zIndex, testID, title, accessibilityLabel, onPress }: MarkerProps) {
    const region = useContext(RegionContext);
    if (!region) return null;
    const x = 0.5 + longitude(coordinate.longitude - region.longitude) / region.longitudeDelta;
    const y = 0.5 - (coordinate.latitude - region.latitude) / region.latitudeDelta;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return (
        <Pressable testID={testID} accessibilityRole={onPress ? 'button' : 'image'} accessibilityLabel={accessibilityLabel ?? title} onPress={onPress} style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, zIndex: zIndex ?? 1, transform: [{ translateX: `${-anchor.x * 100}%` }, { translateY: `${-anchor.y * 100}%` }] }}>
            {children ?? <View style={[styles.dot, { backgroundColor: pinColor ?? '#235e70' }]} />}
        </Pressable>
    );
}
const styles = StyleSheet.create({
    map: { overflow: 'hidden', backgroundColor: '#e8e6df' },
    zoom: { position: 'absolute', top: 12, right: 12, backgroundColor: 'white', borderColor: '#bed1cb', borderWidth: 1, borderRadius: 8, zIndex: 5 },
    credit: { fontSize: 11, color: '#355348' },
    control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    sign: { color: '#245858', fontSize: 24 },
    dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: 'white' },
});
