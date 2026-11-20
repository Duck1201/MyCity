import { createContext, createElement, useState, type ReactNode } from 'react';

class SessionCache {
    readonly entries = new Map<string, unknown>();
    private version = 0;
    private readonly listeners = new Set<() => void>();

    snapshot = () => this.version;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    invalidate() {
        this.entries.clear();
        this.version++;
        this.listeners.forEach((listener) => listener());
    }
}

export const QueryCache = createContext<SessionCache | null>(null);
export function QueryCacheProvider({ children }: { children: ReactNode }) {
    const [cache] = useState(() => new SessionCache());
    return createElement(QueryCache.Provider, { value: cache }, children);
}
