// Anchor the server's request timestamp at the start of the round trip so transit
// never extends a photo's lifetime. Some monotonic clocks pause during deep sleep.
export const serverTimeHeader = 'X-MyCity-Server-Time';
let readTime: (() => number) | null = null;
let requestNumber = 0;
let lastAccepted = 0;
const listeners = new Set<() => void>();

export const serverTimeReader = () => readTime;
export function subscribeServerTime(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export async function fetchWithServerTime(...args: Parameters<typeof fetch>) {
    const request = ++requestNumber;
    const start = performance.now();
    const wallStart = Date.now();
    const response = await fetch(...args);
    const stamp = response.headers?.get(serverTimeHeader);
    if (request > lastAccepted && (response.ok || response.status === 304) && stamp && /^\d+$/.test(stamp) && Number.isSafeInteger(Number(stamp))) {
        lastAccepted = request;
        const receivedAt = Number(stamp);
        let elapsed = 0;
        readTime = () => {
            const wallElapsed = Date.now() - wallStart;
            const monotonicElapsed = performance.now() - start;
            // A wall clock moved backwards cannot account for time spent asleep.
            // Allow for platform clock precision, then hide until a fresh response.
            elapsed = Math.max(elapsed, monotonicElapsed, wallElapsed);
            if (wallElapsed < elapsed - 1000) elapsed = Infinity;
            return receivedAt + elapsed;
        };
        listeners.forEach((notify) => notify());
    }
    return response;
}
