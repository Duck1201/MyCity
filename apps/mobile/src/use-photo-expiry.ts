import { serverTimeReader, subscribeServerTime } from '@mycity/contracts';
import { useEffect, useReducer, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

const noClock = () => null;
const noSubscription = () => () => {};

// One timer wakes the view at the nearest deadline, including while reads are offline.
export function usePhotoExpiry(records?: readonly { photosExpireAt?: string | undefined }[]) {
    const [, refresh] = useReducer((revision: number) => revision + 1, 0);
    const hasDeadline = records?.some((record) => !!record.photosExpireAt);
    const readTime = useSyncExternalStore(hasDeadline ? subscribeServerTime : noSubscription, hasDeadline ? serverTimeReader : noClock);
    const now = readTime?.() ?? Infinity;
    let next = Infinity;
    for (const record of records ?? []) {
        const deadline = Date.parse(record.photosExpireAt ?? '');
        if (deadline > now) next = Math.min(next, deadline);
    }
    useEffect(() => {
        if (!Number.isFinite(next) || readTime === null) return;
        const currentTime = readTime;
        let timer: ReturnType<typeof setTimeout>;
        function schedule() {
            clearTimeout(timer);
            const remaining = next - currentTime();
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
    }, [next, readTime]);
    return {
        waitingForTime: readTime === null,
        hidden: (expiresAt?: string) => !!expiresAt && Date.parse(expiresAt) <= now,
    };
}
