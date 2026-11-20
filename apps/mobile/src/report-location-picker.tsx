import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, type LatLng, type Region } from 'react-native-maps';
import * as GPS from 'expo-location';
import { locationSchema, type Location } from '@mycity/contracts';
import { ActionButton } from './components/action-button';
import { Text } from './components/typography';
import { cityRegion, pointRegion } from './map-region';
import { colors, mobileStyles } from './theme';

type Props = { saved: Location | null; confirm: (point: Location) => void; cancel: () => void };

export function ReportLocationPicker({ saved, confirm, cancel }: Props) {
    const [candidate, setCandidate] = useState(saved);
    const [locating, setLocating] = useState(false);
    const [error, setError] = useState('');
    const map = useRef<MapView>(null);
    const ready = useRef(false);
    const pendingRegion = useRef<Region | null>(null);
    const attempt = useRef(0);
    useEffect(
        () => () => {
            attempt.current++;
        },
        [],
    );

    function selectManual(point: LatLng) {
        attempt.current++;
        pendingRegion.current = null;
        setLocating(false);
        setError('');
        setCandidate({ latitude: point.latitude, longitude: point.longitude, source: 'MANUAL' });
    }
    async function locate() {
        const current = ++attempt.current;
        setLocating(true);
        setError('');
        try {
            const permission = await GPS.requestForegroundPermissionsAsync();
            if (current !== attempt.current) return;
            if (!permission.granted) throw new Error();
            const { coords } = await GPS.getCurrentPositionAsync({ mayShowUserSettingsDialog: false });
            if (current !== attempt.current) return;
            const point = locationSchema.parse({ latitude: coords.latitude, longitude: coords.longitude, source: 'GPS' });
            setCandidate(point);
            const region = pointRegion(point);
            if (ready.current) map.current?.animateToRegion(region, 0);
            else pendingRegion.current = region;
        } catch {
            if (current === attempt.current) setError('GPS indisponível. Toque no mapa para escolher o ponto.');
        } finally {
            if (current === attempt.current) setLocating(false);
        }
    }

    return (
        <Modal visible presentationStyle="fullScreen" onRequestClose={cancel}>
            <SafeAreaView style={styles.screen}>
                <View style={styles.header}>
                    <Text accessibilityRole="header" style={mobileStyles.heading}>
                        Escolher localização
                    </Text>
                    <ActionButton variant="secondary" label="Cancelar" onPress={cancel} />
                </View>
                <MapView
                    testID="location-map"
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={saved ? pointRegion(saved) : cityRegion}
                    onMapReady={() => {
                        ready.current = true;
                        if (pendingRegion.current) {
                            map.current?.animateToRegion(pendingRegion.current, 0);
                            pendingRegion.current = null;
                        }
                    }}
                    ref={map}
                    onPress={(event) => {
                        if (event.nativeEvent.action !== 'marker-press') selectManual(event.nativeEvent.coordinate);
                    }}
                >
                    {candidate && <Marker draggable coordinate={candidate} onDragEnd={(event) => selectManual(event.nativeEvent.coordinate)} />}
                </MapView>
                <View style={styles.footer}>
                    <Text accessibilityLiveRegion="polite" style={error ? mobileStyles.error : mobileStyles.body}>
                        {error || (candidate ? `${candidate.source === 'GPS' ? 'Ponto do GPS' : 'Ponto selecionado'}: ${candidate.latitude.toFixed(5)}, ${candidate.longitude.toFixed(5)}` : 'Toque no mapa para marcar o local da ocorrência.')}
                    </Text>
                    <View style={styles.actions}>
                        <ActionButton variant="secondary" label={locating ? 'Buscando GPS…' : 'Usar GPS'} pending={locating} onPress={() => void locate()} />
                        <ActionButton label="Confirmar ponto" pending={!candidate || locating} onPress={() => candidate && confirm(candidate)} />
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    header: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
    map: { flex: 1 },
    footer: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    actions: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
});
