import { categoryLabel } from './category-catalog';
import { mobileStyles, colors } from './theme';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './components/typography';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { type ReportMarker } from '@mycity/contracts';
import { statusLabels } from './report-overview';
import { activeStatuses, Filters, filteredPath, type ReportFilters } from './report-filters';
import type { CitizenRequest } from './citizen-api';
import { useActiveQuery } from './use-active-query';
import { ActionButton } from './components/action-button';
import { confirmationLabel } from './report-confirmation';

export const brazilView: Region = { latitude: -14.2, longitude: -51.9, latitudeDelta: 45, longitudeDelta: 50 };
function boundsFor(region: Region) {
    const south = Math.max(-90, region.latitude - region.latitudeDelta / 2);
    const north = Math.min(90, region.latitude + region.latitudeDelta / 2);
    const bbox = (west: number, east: number) => [west, south, east, north].join(',');
    if (region.longitudeDelta >= 360) return [bbox(-180, 180)];
    const west = region.longitude - region.longitudeDelta / 2;
    const east = region.longitude + region.longitudeDelta / 2;
    if (west < -180) return [bbox(west + 360, 180), bbox(-180, east)];
    if (east > 180) return [bbox(west, 180), bbox(-180, east - 360)];
    return [bbox(west, east)];
}
type MarkersPage = { data: ReportMarker[]; page: { nextCursor: string | null } };
export function CommunityMap({ request, filters, setFilters, region, setRegion, open }: { request: CitizenRequest; filters: ReportFilters; setFilters: (v: ReportFilters) => void; region: Region; setRegion: (r: Region) => void; open: (id: string) => void }) {
    const area = boundsFor(region).join(';');
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
    const query = useActiveQuery(load);
    const markers = query.data?.path === path && query.data.area === area ? query.data.markers : undefined;
    return (
        <ScrollView contentContainerStyle={styles.page}>
            <Text accessibilityRole="header" style={styles.title}>
                Mapa de denúncias
            </Text>
            <Filters request={request} filters={filters} statuses={[...activeStatuses, 'RESOLVED']} onChange={setFilters} />
            <MapView
                testID="community-map"
                provider={PROVIDER_GOOGLE}
                initialRegion={region}
                style={styles.map}
                onRegionChangeComplete={(r) => {
                    if (r.latitudeDelta > 0 && r.longitudeDelta > 0) setRegion(r);
                }}
            >
                {markers?.map((m) => (
                    <Marker key={m.id} testID={'report-marker-' + m.id} coordinate={{ latitude: m.latitude, longitude: m.longitude }} title={categoryLabel(m)} description={statusLabels[m.status]} onPress={() => open(m.id)} />
                ))}
            </MapView>
            {query.failed && (
                <View>
                    <Text accessibilityLiveRegion="polite" style={mobileStyles.error}>
                        Não foi possível atualizar os pontos do mapa.
                    </Text>
                    <ActionButton label="Tentar novamente" onPress={query.retry} />
                </View>
            )}
            {markers ? <Text accessibilityLiveRegion="polite">{markers.length === 0 ? 'Nenhuma denúncia nesta área' : markers.length === 1 ? '1 denúncia nesta área' : markers.length + ' denúncias nesta área'}</Text> : !query.failed && <Text accessibilityLiveRegion="polite">Carregando pontos…</Text>}
            {markers?.map((m) => (
                <Pressable key={m.id} accessibilityRole="button" style={styles.listItem} onPress={() => open(m.id)}>
                    <Text style={styles.label}>{categoryLabel(m)}</Text>
                    <Text>
                        {statusLabels[m.status]} · {confirmationLabel(m.confirmationCount)}
                    </Text>
                    <Text style={mobileStyles.meta}>Protocolo {m.id}</Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}
const styles = StyleSheet.create({ page: mobileStyles.page, title: mobileStyles.title, map: { height: 325 }, listItem: { padding: 12, paddingLeft: 16, backgroundColor: colors.surface, borderLeftWidth: 3, borderColor: colors.teal, gap: 4 }, label: mobileStyles.label });
