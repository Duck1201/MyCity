import type { LatLng, Region } from 'react-native-maps';

export const cityRegion: Region = { latitude: -20.7526, longitude: -42.8818, latitudeDelta: 0.06, longitudeDelta: 0.06 };
export function pointRegion(point: LatLng): Region {
    return { latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 };
}
