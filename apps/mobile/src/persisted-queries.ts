import { Directory, File, Paths } from 'expo-file-system';

// The citizen's own reads survive an app restart so screens open with content
// while the network revalidates. The cache directory may be cleared by the
// system, which is fine for a cache. Community feed and map are not kept.
const maxAge = 7 * 24 * 60 * 60 * 1000;
const folder = () => new Directory(Paths.cache, 'mycity-queries');
const fileFor = (owner: string) => (/^[\w-]{1,64}$/.test(owner) ? new File(folder(), owner + '.json') : undefined);

export const keepsOnDevice = (key: string) => !key.startsWith('/reports/map') && !/[?&]scope=feed\b/.test(key);

type Saved = { owner: string; entries: [key: string, value: unknown, savedAt: number][] };

export async function readPersistedQueries(owner: string) {
    const restored = new Map<string, unknown>();
    try {
        const file = fileFor(owner);
        if (!file?.exists) return restored;
        const saved = JSON.parse(await file.text()) as Saved;
        if (saved.owner !== owner) return restored;
        const now = Date.now();
        for (const [key, value, savedAt] of saved.entries) if (keepsOnDevice(key) && now - savedAt <= maxAge) restored.set(key, value);
    } catch {
        // An unreadable cache is the same as no cache.
    }
    return restored;
}

export function writePersistedQueries(owner: string, entries: Map<string, { value: unknown; savedAt: number }>) {
    try {
        const file = fileFor(owner);
        if (!file) return;
        const directory = folder();
        if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
        const kept = [...entries].filter(([key, entry]) => keepsOnDevice(key) && entry.value !== undefined).map(([key, entry]): Saved['entries'][number] => [key, entry.value, entry.savedAt]);
        file.write(JSON.stringify({ owner, entries: kept } satisfies Saved));
    } catch {
        // Persisting is best effort; the in-memory session cache still works.
    }
}

export function clearPersistedQueries() {
    try {
        const directory = folder();
        if (directory.exists) directory.delete();
    } catch {
        // Nothing to remove.
    }
}
