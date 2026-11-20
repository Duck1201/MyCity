import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

const listeners = new Set<() => void>();
let enabled = false;
let stop: (() => void) | undefined;

function observePreference() {
    let active = true;
    let receivedEvent = false;
    function update(reduced: boolean) {
        const next = !reduced;
        if (active && next !== enabled) {
            enabled = next;
            listeners.forEach((notify) => notify());
        }
    }
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
        receivedEvent = true;
        update(reduced);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(
        (reduced) => {
            if (!receivedEvent) update(reduced);
        },
        () => {},
    );
    return () => {
        active = false;
        subscription?.remove();
        enabled = false;
    };
}
function subscribe(notify: () => void) {
    listeners.add(notify);
    stop ??= observePreference();
    return () => {
        listeners.delete(notify);
        if (!listeners.size) {
            stop?.();
            stop = undefined;
        }
    };
}
export function useMotionEnabled() {
    return useSyncExternalStore(
        subscribe,
        () => enabled,
        () => false,
    );
}
