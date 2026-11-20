import * as Location from 'expo-location';
import { AppState } from 'react-native';

const positionTimeout = 6000;

export function readDevicePosition(signal: AbortSignal) {
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
        void Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false }, finish, stop).then((registered) => {
            if (settled) registered.remove();
            else subscription = registered;
        }, stop);
    });
}
