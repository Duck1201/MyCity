import * as Location from 'expo-location';
import { AppState } from 'react-native';

const positionTimeout = 6000;

export function readDevicePosition(signal: AbortSignal, { allowRecentFix = false } = {}) {
    return new Promise<Location.LocationObject>((resolve, reject) => {
        let subscription: Location.LocationSubscription | undefined;
        let settled = false;
        function finish(position?: Location.LocationObject) {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            signal.removeEventListener('abort', stop);
            appState.remove();
            subscription?.remove();
            if (position) resolve(position);
            else reject(new Error('Localização indisponível.'));
        }
        const stop = () => finish();
        const timeout = setTimeout(stop, positionTimeout);
        const appState = AppState.addEventListener('change', (state) => {
            if (state === 'background') stop();
        });
        signal.addEventListener('abort', stop, { once: true });
        async function acquire() {
            if (signal.aborted) return stop();
            if (allowRecentFix) {
                if (!(await Location.hasServicesEnabledAsync())) return stop();
                if (settled) return;
                const recent = await Location.getLastKnownPositionAsync({ maxAge: 30000, requiredAccuracy: 100 }).catch(() => null);
                if (settled) return;
                if (recent) return finish(recent);
            }
            const options = allowRecentFix ? { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 } : { accuracy: Location.Accuracy.Balanced };
            const registered = await Location.watchPositionAsync({ ...options, mayShowUserSettingsDialog: false }, finish, stop);
            if (settled) registered.remove();
            else subscription = registered;
        }
        void acquire().catch(stop);
    });
}
