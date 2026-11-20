import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiFailure } from './citizen-api';

/** Keeps the last confirmed result while its screen is mounted. */
export function useActiveQuery<T>(load: (signal: AbortSignal) => Promise<T>) {
    const [data, setData] = useState<T>();
    const [unavailable, setUnavailable] = useState(false);
    const [failed, setFailed] = useState(false);
    const retry = useRef<() => void>(() => {});
    const replace = useRef<(next: SetStateAction<T | undefined>) => void>(() => {});
    useEffect(() => {
        let foreground = AppState.currentState == null || AppState.currentState === 'active';
        let request: AbortController | null = null;
        async function refresh() {
            if (!foreground || request) return;
            const controller = new AbortController();
            request = controller;
            try {
                const result = await load(controller.signal);
                if (!controller.signal.aborted) {
                    setData(result);
                    setFailed(false);
                    setUnavailable(false);
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    if (error instanceof ApiFailure && [403, 404].includes(error.status)) {
                        setData(undefined);
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
            setData(next);
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
    }, [load]);
    return { data, failed, unavailable, retry: () => retry.current(), replace: (next: SetStateAction<T | undefined>) => replace.current(next) };
}
