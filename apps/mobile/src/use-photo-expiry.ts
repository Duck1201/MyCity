import { serverTimeOffset, subscribeServerTime } from '@mycity/contracts';
import { useEffect, useReducer, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

// One timer wakes the view at the nearest deadline, including while reads are offline.
export function usePhotoExpiry(records?: readonly { photosExpireAt?: string | undefined }[]) {
    const [, refresh] = useReducer((revision: number) => revision + 1, 0);
    const offset = useSyncExternalStore(subscribeServerTime, serverTimeOffset);
    const now = offset === null ? Infinity : performance.now() + offset;
    let next = Infinity;
    for (const record of records ?? []) {
        const deadline = Date.parse(record.photosExpireAt ?? '');
        if (deadline > now) next = Math.min(next, deadline);
    }
    useEffect(() => {
        if (!Number.isFinite(next) || offset === null) return;
        const due = next - offset;
        let timer: ReturnType<typeof setTimeout>;
        function schedule() {
            clearTimeout(timer);
            const remaining = due - performance.now();
            if (remaining <= 0) refresh();
            else timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647));
        }
        schedule();
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') schedule();
        });
        return () => {
            clearTimeout(timer);
            subscription.remove();
        };
    }, [next, offset]);
    return {
        waitingForTime: offset === null,
        hidden: (expiresAt?: string) => !!expiresAt && Date.parse(expiresAt) <= now,
    };
}
