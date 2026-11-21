import * as GPS from 'expo-location';
import { AppState, Platform } from 'react-native';
import { readDevicePosition } from './device-position';

function whenActive<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    if (signal.aborted) return Promise.reject(new Error('Localização cancelada.'));
    if (AppState.currentState === 'active') return operation();
    return new Promise<T>((resolve, reject) => {
        const listener = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                listener.remove();
                signal.removeEventListener('abort', abort);
                resolve(operation());
            }
        });
        function abort() {
            listener.remove();
            reject(new Error('Localização cancelada.'));
        }
        signal.addEventListener('abort', abort, { once: true });
    });
}

// Some browsers provide geolocation and its permission prompt without supporting Permissions.query.
function readBrowserPosition(signal: AbortSignal) {
    const gps = navigator.geolocation;
    let watch: number | undefined;
    let abort: () => void;
    return new Promise<GeolocationPosition | null>((resolve, reject) => {
        abort = () => resolve(null);
        if (signal.aborted) return abort();
        signal.addEventListener('abort', abort, { once: true });
        watch = gps.watchPosition(resolve, (error) => (error.code === error.PERMISSION_DENIED ? resolve(null) : reject(error)), { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 });
    }).finally(() => {
        signal.removeEventListener('abort', abort);
        if (watch !== undefined) gps.clearWatch(watch);
    });
}

export async function readReportPosition(signal: AbortSignal, onReading: () => void) {
    let permission: GPS.LocationPermissionResponse;
    try {
        permission = await whenActive(signal, GPS.getForegroundPermissionsAsync);
    } catch (error) {
        if (signal.aborted || Platform.OS !== 'web') throw error;
        return whenActive(signal, () => {
            onReading();
            return readBrowserPosition(signal);
        });
    }
    if (!permission.granted && permission.canAskAgain) {
        permission = await whenActive(signal, GPS.requestForegroundPermissionsAsync);
    }
    if (!permission.granted) return null;
    return whenActive(signal, () => {
        onReading();
        return readDevicePosition(signal);
    });
}
