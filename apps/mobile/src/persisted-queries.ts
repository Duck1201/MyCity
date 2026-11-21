import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

// The citizen's own reads survive an app restart so screens open with content
// while the network revalidates. The cache directory may be cleared by the
// system, which is fine for a cache. Community lists, the map and other
// people's reports are never written.
const maxAge = 7 * 24 * 60 * 60 * 1000;
const folder = () => new Directory(Paths.cache, 'mycity-queries');
const fileFor = (owner: string) => (/^[\w-]{1,64}$/.test(owner) ? new File(folder(), owner + '.json') : undefined);

// Clearing bumps the generation, so a write scheduled before a sign-out cannot recreate the file.
let generation = 0;
export const persistGeneration = () => generation;

const reportPath = /^\/reports\/([^/?]+)(\/history)?(?:\?|$)/;
const isMine = (value: unknown) => (value as { data?: { isMine?: unknown } } | undefined)?.data?.isMine === true;

export function keptOnDevice<T>(entries: [key: string, value: T][], valueOf: (entry: T) => unknown): [string, T][] {
    const own = new Set(entries.filter(([key, entry]) => reportPath.exec(key)?.[2] === undefined && reportPath.test(key) && isMine(valueOf(entry))).map(([key]) => reportPath.exec(key)![1]));
    return entries.filter(([key]) => {
        if (key.startsWith('/reports?')) return /[?&]scope=mine\b/.test(key);
        const report = reportPath.exec(key);
        if (report) return own.has(report[1]!);
        return !key.startsWith('/reports');
    });
}

type Saved = { owner: string; entries: [key: string, value: unknown, savedAt: number][] };

export async function readPersistedQueries(owner: string) {
    const restored = new Map<string, unknown>();
    try {
        const file = fileFor(owner);
        if (!file?.exists) return restored;
        const saved = JSON.parse(await file.text()) as Saved;
        if (saved.owner !== owner) return restored;
        const now = Date.now();
        const fresh = saved.entries.filter(([, , savedAt]) => now - savedAt <= maxAge).map(([key, value]): [string, unknown] => [key, value]);
        for (const [key, value] of keptOnDevice(fresh, (value) => value)) restored.set(key, value);
    } catch {
        // An unreadable cache is the same as no cache.
    }
    return restored;
}

export function writePersistedQueries(owner: string, entries: Map<string, { value: unknown; savedAt: number }>, since: number) {
    if (since !== generation) return;
    try {
        const file = fileFor(owner);
        if (!file) return;
        const directory = folder();
        if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
        const present = [...entries].filter(([, entry]) => entry.value !== undefined);
        const kept = keptOnDevice(present, (entry) => entry.value).map(([key, entry]): Saved['entries'][number] => [key, entry.value, entry.savedAt]);
        file.write(JSON.stringify({ owner, entries: kept } satisfies Saved));
    } catch {
        // Persisting is best effort; the in-memory session cache still works.
    }
}

export function clearPersistedQueries() {
    if (Platform.OS === 'web') return;
    generation++;
    try {
        const directory = folder();
        if (directory.exists) directory.delete();
    } catch {
        // Nothing to remove.
    }
}
