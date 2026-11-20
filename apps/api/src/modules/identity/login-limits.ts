import { networkKey } from '../../network-key.js';

// The demo runs one API process. Reserve attempts synchronously before doing password work.
export function createLoginLimits() {
    const windowMs = 15 * 60_000;
    const sources = new Map<string, { until: number; attempts: number; failures: Map<string, number> }>();
    let active = 0;
    let nextCleanup = 0;
    return function reserve(ip: string, cpf: string) {
        const now = Date.now();
        if (now >= nextCleanup) {
            for (const [key, entry] of sources) if (entry.until <= now) sources.delete(key);
            nextCleanup = now + 60_000;
        }
        const key = networkKey(ip);
        let entry = sources.get(key);
        if (active >= 4 || (!entry && sources.size >= 4096)) return { retryAfter: 5 };
        if (!entry || entry.until <= now) {
            entry = { until: now + windowMs, attempts: 0, failures: new Map() };
            sources.set(key, entry);
        }
        const failures = entry.failures.get(cpf) ?? 0;
        if (entry.attempts >= 60 || failures >= 5) return { retryAfter: Math.ceil((entry.until - now) / 1000) };
        active++;
        entry.attempts++;
        entry.failures.set(cpf, failures + 1);
        const accepted = entry;
        return {
            finish(success: boolean) {
                active--;
                if (!success) return;
                accepted.failures.set(cpf, Math.max(0, (accepted.failures.get(cpf) ?? 1) - 1));
            },
        };
    };
}
