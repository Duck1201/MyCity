import type { RefObject } from 'react';
import MapView, { Marker, type Region } from 'react-native-maps';
import { categoryName, type Case } from './fixtures';
import { s } from './presentation';

export type PrototypeMapProps = { records: Case[]; region: RefObject<Region>; selectedGroup?: RefObject<number | null> | undefined; open: (item: Case) => void };

export function PrototypeMap({ records, region, open }: PrototypeMapProps) {
    return (
        <MapView
            accessibilityLabel="Mapa de ocorrências"
            style={s.map}
            initialRegion={region.current}
            onRegionChangeComplete={(next) => {
                region.current = next;
            }}
        >
            {records.map((item) => (
                <Marker key={item.id} coordinate={item.point} title={'MC-' + item.id + ' · ' + categoryName(item.category)} description={item.place} onPress={() => open(item)} />
            ))}
        </MapView>
    );
}
