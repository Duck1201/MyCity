import { useContext, useSyncExternalStore, useEffect, useRef, useState, type SetStateAction } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiFailure } from './citizen-api';

import { QueryCache } from './query-cache';
export { QueryCacheProvider } from './query-cache';

const noSubscription = () => () => {};
const noCacheVersion = () => 0;

export function useActiveQuery<T>(load: (signal: AbortSignal) => Promise<T>, enabled = true, key?: string) {
    const session = useContext(QueryCache);
    const cache = session?.entries;
    useSyncExternalStore(session?.subscribe ?? noSubscription, session?.snapshot ?? noCacheVersion, noCacheVersion);
    const version = session?.epoch() ?? 0;
    const [lastResult, setResult] = useState<{ version: number; key: string | undefined; value: T | undefined }>();
    const result = lastResult?.version === version ? lastResult : undefined;
    const cached = key ? (cache?.get(key) as T | undefined) : undefined;
    const data = result?.key === key ? (result?.value ?? cached) : (cached ?? result?.value);
    const updating = data !== undefined && result?.key !== key && cached === undefined;
    // A remembered read for this key is on screen until this mount gets the network's answer.
    const revalidating = cached !== undefined && result?.key !== key;
    const currentData = useRef(data);
    useEffect(() => {
        currentData.current = data;
    }, [data]);
    const [unavailable, setUnavailable] = useState(false);
    const [failed, setFailed] = useState(false);
    const retry = useRef<() => void>(() => {});
    const replace = useRef<(next: SetStateAction<T | undefined>) => void>(() => {});
    useEffect(() => {
        if (!enabled) return;
        let foreground = AppState.currentState == null || AppState.currentState === 'active';
        let request: AbortController | null = null;
        async function refresh() {
            if (!foreground || request) return;
            const controller = new AbortController();
            const startedAt = session?.epoch() ?? 0;
            request = controller;
            try {
                const result = await load(controller.signal);
                if (!controller.signal.aborted && startedAt === (session?.epoch() ?? 0)) {
                    if (key) session?.remember(key, result);
                    setResult((previous) => (previous?.version === startedAt && previous.key === key && Object.is(previous.value, result) ? previous : { version: startedAt, key, value: result }));
                    setFailed(false);
                    setUnavailable(false);
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    if (error instanceof ApiFailure && [403, 404].includes(error.status)) {
                        if (session?.epoch() === startedAt) session.invalidate();
                        setResult({ version: session?.epoch() ?? 0, key, value: undefined });
                        setUnavailable(true);
                    }
                    setFailed(true);
                }
            } finally {
                if (request === controller) request = null;
            }
        }
        function pause() {
            request?.abort();
            request = null;
        }
        let timer: ReturnType<typeof setInterval> | undefined;
        function start() {
            void refresh();
            timer = setInterval(() => void refresh(), 5000);
        }
        function stateChanged(state: AppStateStatus) {
            const next = state === 'active';
            if (next === foreground) return;
            foreground = next;
            if (next) start();
            else {
                clearInterval(timer);
                pause();
            }
        }
        retry.current = () => {
            pause();
            void refresh();
        };
        replace.current = (next) => {
            pause();
            const value = typeof next === 'function' ? (next as (prior: T | undefined) => T | undefined)(currentData.current) : next;
            currentData.current = value;
            if (key) session?.remember(key, value);
            setResult({ version: session?.epoch() ?? 0, key, value });
            setFailed(false);
        };
        const listener = AppState.addEventListener('change', stateChanged);
        if (foreground) start();
        return () => {
            foreground = false;
            listener.remove();
            clearInterval(timer);
            pause();
        };
    }, [load, enabled, key, cache, session]);
    return {
        data,
        updating,
        revalidating: revalidating && !failed,
        failed,
        unavailable,
        retry: () => retry.current(),
        replace: (next: SetStateAction<T | undefined>, invalidateRelated = false) => {
            if (version !== (session?.epoch() ?? 0)) return;
            if (invalidateRelated) session?.invalidate();
            replace.current(next);
        },
    };
}
