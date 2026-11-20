import { useCallback, useEffect, useRef, useState } from 'react';

// Views keep their last confirmed result while a refresh is pending or unavailable.
export function useLiveQuery<T>(url: string | null, onSessionExpired: () => void) {
    const [result, setResult] = useState<{ url: string; data: T | undefined; failed: boolean }>();
    const [revision, setRevision] = useState(0);
    const active = useRef<AbortController | null>(null);
    const refresh = useCallback(() => {
        active.current?.abort();
        setRevision((value) => value + 1);
    }, []);
    const replace = (data: T) => {
        active.current?.abort();
        if (url) setResult({ url, data, failed: false });
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
                const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
                if (controller.signal.aborted) return;
                if (response.status === 401) return onSessionExpired();
                if (!response.ok) throw new Error();
                const data: T = await response.json();
                if (!controller.signal.aborted) setResult({ url: endpoint, data, failed: false });
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
    }, [url, revision, onSessionExpired]);
    return { previousData: result?.url !== url ? result?.data : undefined, data: result?.url === url ? result.data : undefined, failed: result?.url === url && result.failed, refresh, replace };
}
