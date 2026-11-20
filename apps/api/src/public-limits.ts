import type { RequestHandler } from 'express';
import { networkKey } from './network-key.js';

export function publicRateLimit(maxRequests: number): RequestHandler {
    const sources = new Map<string, { until: number; requests: number }>();
    return (req, res, next) => {
        const now = Date.now();
        // Windows are inserted in expiry order and never extended by later requests.
        for (const [key, window] of sources) {
            if (window.until > now) break;
            sources.delete(key);
        }
        const key = networkKey(req.ip ?? 'unknown');
        let window = sources.get(key);
        if (!window && sources.size < 4096) {
            window = { until: now + 60_000, requests: 0 };
            sources.set(key, window);
        }
        if (!window || window.requests >= maxRequests) {
            const until = window?.until ?? sources.values().next().value!.until;
            res.set('Cache-Control', 'no-store').set('Retry-After', String(Math.ceil((until - now) / 1000)));
            res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas solicitações. Aguarde antes de tentar novamente.' }, requestId: res.locals.requestId });
            return;
        }
        window.requests++;
        next();
    };
}
