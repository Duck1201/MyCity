import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker, type Region } from 'react-native-maps';
import type { ReportMarker } from '@mycity/contracts';
import { categoryLabel } from './category-catalog';
import { Icon } from './components/civic-header';
import { Text } from './components/typography';
import { statusLabels } from './report-overview';
import { colors } from './theme';

type MarkerGroup = { anchor: ReportMarker; x: number; y: number; ids: string[] };
const touchRadius = 48;

function mercatorY(latitude: number) {
    const radians = (Math.max(-85.051129, Math.min(85.051129, latitude)) * Math.PI) / 180;
    return Math.asinh(Math.tan(radians));
}

function groupMarkers(pins: ReportMarker[], region: Region, width: number, height: number): MarkerGroup[] {
    const north = mercatorY(region.latitude + region.latitudeDelta / 2);
    const south = mercatorY(region.latitude - region.latitudeDelta / 2);
    if (width <= 0 || height <= 0 || region.longitudeDelta <= 0 || north === south) {
        return pins.map((anchor) => ({ anchor, x: 0, y: 0, ids: [anchor.id] }));
    }

    const groups: MarkerGroup[] = [];
    const cells = new Map<string, MarkerGroup[]>();
    // Stable anchors prevent marker jumps if the server returns a different page order.
    const ordered = [...pins].sort((a, b) => a.id.localeCompare(b.id));
    for (const point of ordered) {
        const longitudeOffset = ((point.longitude - region.longitude + 540) % 360) - 180;
        const x = (longitudeOffset * width) / region.longitudeDelta;
        const y = ((north - mercatorY(point.latitude)) * height) / (north - south);
        const col = Math.floor(x / touchRadius);
        const row = Math.floor(y / touchRadius);
        let nearest: MarkerGroup | undefined;
        let distance = touchRadius ** 2;
        for (let i = col - 1; i <= col + 1; i++) {
            for (let j = row - 1; j <= row + 1; j++) {
                for (const candidate of cells.get(i + ',' + j) ?? []) {
                    const delta = (candidate.x - x) ** 2 + (candidate.y - y) ** 2;
                    if (delta <= distance) {
                        nearest = candidate;
                        distance = delta;
                    }
                }
            }
        }
        if (nearest) {
            nearest.ids.push(point.id);
            continue;
        }
        const group = { anchor: point, x, y, ids: [point.id] };
        groups.push(group);
        const key = col + ',' + row;
        const bucket = cells.get(key);
        if (bucket) bucket.push(group);
        else cells.set(key, [group]);
    }
    return groups;
}

type Props = { pins: ReportMarker[]; region: Region; width: number; height: number; selectedId?: string | null | undefined; onSelect: (id: string) => void; onGroup: (ids: string[]) => void };

export function MapMarkers({ pins, region, width, height, selectedId, onSelect, onGroup }: Props) {
    const groups = useMemo(() => groupMarkers(pins, region, width, height), [pins, region, width, height]);
    return (
        <>
            {groups.map(({ anchor, ids }) => {
                const coordinate = { latitude: anchor.latitude, longitude: anchor.longitude };
                if (ids.length === 1) {
                    const active = anchor.id === selectedId;
                    return (
                        <Marker key={'pin-' + anchor.id} testID={'report-marker-' + anchor.id} coordinate={coordinate} anchor={{ x: 0.5, y: 1 }} zIndex={active ? 2 : 1} accessibilityLabel={categoryLabel(anchor) + ', ' + statusLabels[anchor.status]} onPress={() => onSelect(anchor.id)}>
                            <View collapsable={false} style={styles.pin}>
                                <View style={[styles.symbol, active && styles.selected]}>
                                    <Icon name="pin" size={20} color={colors.surface} />
                                    {groups.length === 1 && (
                                        <Text numberOfLines={1} style={styles.pinLabel}>
                                            {categoryLabel(anchor)}
                                        </Text>
                                    )}
                                </View>
                                <View style={[styles.tip, active && styles.selected]} />
                            </View>
                        </Marker>
                    );
                }
                const selected = !!selectedId && ids.includes(selectedId);
                return (
                    <Marker key={'group-' + anchor.id} coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} zIndex={selected ? 3 : 2} testID={'report-group-' + anchor.id} accessibilityLabel={ids.length + ' denúncias próximas'} onPress={() => onGroup(ids)}>
                        <View collapsable={false} style={[styles.badge, selected && styles.selected]}>
                            <Text style={styles.count}>{ids.length}</Text>
                        </View>
                    </Marker>
                );
            })}
        </>
    );
}

const styles = StyleSheet.create({
    pin: { alignItems: 'center', justifyContent: 'flex-end', minWidth: 48, minHeight: 48 },
    symbol: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 38, minHeight: 38, maxWidth: 175, paddingHorizontal: 8, backgroundColor: colors.teal, borderRadius: 20, borderWidth: 2, borderColor: colors.surface },
    pinLabel: { color: colors.surface, fontWeight: '700', fontSize: 14, flexShrink: 1 },
    tip: { width: 9, height: 9, transform: [{ rotate: '45deg' }], marginTop: -5, marginBottom: 2, backgroundColor: colors.teal },
    badge: { minWidth: 44, minHeight: 44, paddingHorizontal: 6, borderWidth: 3, borderColor: colors.surface, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.teal },
    selected: { backgroundColor: colors.deepTeal },
    count: { color: colors.surface, fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
