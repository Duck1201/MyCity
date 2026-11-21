// A response can take time to reach the UI. Anchor the server's request timestamp
// at the start of the round trip so transit never extends a photo's lifetime.
export const serverTimeHeader = 'X-MyCity-Server-Time';
let offset: number | null = null;
const listeners = new Set<() => void>();

export const serverTimeOffset = () => offset;
export function subscribeServerTime(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export async function fetchWithServerTime(...args: Parameters<typeof fetch>) {
    const start = performance.now();
    const response = await fetch(...args);
    const stamp = response.headers?.get(serverTimeHeader);
    if ((response.ok || response.status === 304) && stamp && /^\d+$/.test(stamp) && Number.isSafeInteger(Number(stamp))) {
        const candidate = Number(stamp) - start;
        if (offset === null || candidate > offset) {
            offset = candidate;
            listeners.forEach((notify) => notify());
        }
    }
    return response;
}
