import { fetchWithServerTime } from '@mycity/contracts';
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

// Last confirmed reads of the signed-in manager, kept in memory so returning to a
// screen shows them at once while the network revalidates. It lives inside the
// manager session, so signing out or expiring drops it; nothing is persisted.
const LiveQueryCache = createContext<Map<string, unknown> | null>(null);
const cacheLimit = 64;
export function LiveQueryCacheProvider({ children }: { children: ReactNode }) {
    const [cache] = useState(() => new Map<string, unknown>());
    return createElement(LiveQueryCache.Provider, { value: cache }, children);
}

// Fetches reads the manager is likely to open next into the session cache, so the
// screen renders at once and only revalidates. Failures are ignored: the screen's
// own query reports them when it is opened.
export function useWarm() {
    const cache = useContext(LiveQueryCache);
    const [inFlight] = useState(() => new Set<string>());
    return useCallback(
        (urls: readonly string[]) => {
            if (!cache) return;
            for (const url of urls) {
                if (cache.has(url) || inFlight.has(url)) continue;
                inFlight.add(url);
                void fetchWithServerTime(url, { cache: 'no-cache' })
                    .then(async (response) => {
                        if (!response.ok) return;
                        const data: unknown = await response.json();
                        if (!cache.has(url)) cache.set(url, data);
                    })
                    .catch(() => {})
                    .finally(() => inFlight.delete(url));
            }
        },
        [cache, inFlight],
    );
}

export function useWarmUp(urls: readonly string[]) {
    const warm = useWarm();
    const key = urls.join('\n');
    useEffect(() => {
        if (key) warm(key.split('\n'));
    }, [key, warm]);
}

// Views keep their last confirmed result while a refresh is pending or unavailable.
export function useLiveQuery<T>(url: string | null, onSessionExpired: () => void) {
    const cache = useContext(LiveQueryCache);
    const remember = useCallback(
        (key: string, data: T) => {
            if (!cache) return;
            cache.delete(key);
            cache.set(key, data);
            if (cache.size > cacheLimit) cache.delete(cache.keys().next().value!);
        },
        [cache],
    );
    const [result, setResult] = useState<{ url: string; data: T | undefined; failed: boolean }>();
    const [revision, setRevision] = useState(0);
    const active = useRef<AbortController | null>(null);
    const refresh = useCallback(() => {
        active.current?.abort();
        setRevision((value) => value + 1);
    }, []);
    const replace = (data: T) => {
        active.current?.abort();
        if (!url) return;
        remember(url, data);
        setResult({ url, data, failed: false });
    };

    useEffect(() => {
        if (!url) return;
        const endpoint = url;
        async function read() {
            if (document.hidden) {
                active.current?.abort();
                return;
            }
            if (active.current && !active.current.signal.aborted) return;
            const controller = new AbortController();
            active.current = controller;
            try {
                // Revalidate with the server every time; an unchanged read comes back as 304.
                const response = await fetchWithServerTime(endpoint, { cache: 'no-cache', signal: controller.signal });
                if (controller.signal.aborted) return;
                if (response.status === 401) return onSessionExpired();
                if (!response.ok) throw new Error();
                const data: T = await response.json();
                if (controller.signal.aborted) return;
                remember(endpoint, data);
                setResult({ url: endpoint, data, failed: false });
            } catch {
                if (!controller.signal.aborted) setResult((previous) => ({ url: endpoint, data: previous?.url === endpoint ? previous.data : undefined, failed: true }));
            } finally {
                if (active.current === controller) active.current = null;
            }
        }
        void read();
        const timer = window.setInterval(read, 5000);
        document.addEventListener('visibilitychange', read);
        return () => {
            active.current?.abort();
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', read);
        };
    }, [url, revision, onSessionExpired, remember]);
    const current = result?.url === url ? result.data : undefined;
    const cached = url && current === undefined ? (cache?.get(url) as T | undefined) : undefined;
    const failed = result?.url === url && result.failed;
    return { previousData: result?.url !== url && cached === undefined ? result?.data : undefined, data: current ?? cached, failed, refresh, replace };
}
