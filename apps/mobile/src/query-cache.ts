import { createContext, createElement, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { clearPersistedQueries, persistGeneration, readPersistedQueries, writePersistedQueries } from './persisted-queries';

const entryLimit = 96;

class SessionCache {
    readonly entries = new Map<string, unknown>();
    // Last ETag and body per GET path, so a poll can be answered with 304.
    readonly validators = new Map<string, { etag: string; body: unknown }>();
    private readonly savedAt = new Map<string, number>();
    // epoch changes only when cached reads stop being valid; revision also
    // changes when restored reads arrive, so views re-render without dropping
    // a response that is already on its way.
    private epochValue = 0;
    private revision = 0;
    private readonly listeners = new Set<() => void>();
    private pendingWrite: ReturnType<typeof setTimeout> | undefined;
    private persistSince = persistGeneration();

    constructor(private readonly owner?: string) {}

    snapshot = () => this.revision;
    epoch = () => this.epochValue;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    remember(key: string, value: unknown) {
        this.entries.delete(key);
        this.entries.set(key, value);
        this.savedAt.set(key, Date.now());
        if (this.entries.size > entryLimit) {
            const oldest = this.entries.keys().next().value!;
            this.entries.delete(oldest);
            this.savedAt.delete(oldest);
        }
        this.schedulePersist();
    }

    validate(path: string, etag: string, body: unknown) {
        this.validators.delete(path);
        this.validators.set(path, { etag, body });
        if (this.validators.size > entryLimit) this.validators.delete(this.validators.keys().next().value!);
    }

    invalidate() {
        this.entries.clear();
        this.savedAt.clear();
        this.validators.clear();
        this.epochValue++;
        this.revision++;
        this.listeners.forEach((listener) => listener());
        if (this.owner) {
            clearTimeout(this.pendingWrite);
            clearPersistedQueries();
            this.persistSince = persistGeneration();
        }
    }

    async restore() {
        if (!this.owner) return;
        const started = this.epochValue;
        const restored = await readPersistedQueries(this.owner);
        if (started !== this.epochValue || !restored.size) return;
        let added = false;
        for (const [key, value] of restored) {
            if (this.entries.has(key)) continue;
            this.entries.set(key, value);
            added = true;
        }
        if (!added) return;
        this.revision++;
        this.listeners.forEach((listener) => listener());
    }

    dispose() {
        clearTimeout(this.pendingWrite);
    }

    private schedulePersist() {
        if (!this.owner) return;
        clearTimeout(this.pendingWrite);
        this.pendingWrite = setTimeout(() => {
            const owner = this.owner!;
            const snapshot = new Map([...this.entries].map(([key, value]) => [key, { value, savedAt: this.savedAt.get(key) ?? Date.now() }]));
            writePersistedQueries(owner, snapshot, this.persistSince);
        }, 500);
    }
}

export const QueryCache = createContext<SessionCache | null>(null);
// owner is the signed-in citizen; without it the cache stays in memory only.
export function QueryCacheProvider({ children, owner }: { children: ReactNode; owner?: string | null | undefined }) {
    const [cache] = useState(() => new SessionCache(Platform.OS === 'web' ? undefined : (owner ?? undefined)));
    useEffect(() => {
        void cache.restore();
        return () => cache.dispose();
    }, [cache]);
    return createElement(QueryCache.Provider, { value: cache }, children);
}
