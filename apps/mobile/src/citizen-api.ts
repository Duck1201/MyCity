import { fetchWithServerTime } from '@mycity/contracts';
import { useCallback, useContext, useRef } from 'react';
import { QueryCache } from './query-cache';
export type CitizenRequest = <T>(path: string, signal: AbortSignal, method?: 'GET' | 'PUT' | 'DELETE' | 'POST', body?: object) => Promise<T>;
export class ApiFailure extends Error {
    constructor(readonly status: number) {
        super('Falha na solicitação.');
    }
}

export function useCitizenRequest(apiBase: string, token: string, onSessionExpired: () => void): CitizenRequest {
    const cache = useContext(QueryCache);
    const expired = useRef(false);
    return useCallback(
        async <T>(path: string, signal: AbortSignal, method: 'GET' | 'PUT' | 'POST' | 'DELETE' = 'GET', body?: object) => {
            const known = method === 'GET' ? cache?.validators.get(path) : undefined;
            const headers: Record<string, string> = { Authorization: 'Bearer ' + token, ...(body && { 'Content-Type': 'application/json' }), ...(known && { 'If-None-Match': known.etag }) };
            const response = await fetchWithServerTime(apiBase + path, { method, headers, ...(body && { body: JSON.stringify(body) }), signal });
            if (signal.aborted) throw new Error('Consulta cancelada.');
            if (response.status === 401 && !expired.current) {
                expired.current = true;
                onSessionExpired();
            }
            if (response.status === 403 || response.status === 404) cache?.invalidate();
            // Unchanged since the last read: reuse that body instead of downloading it again.
            if (response.status === 304 && known) return known.body as T;
            if (!response.ok) throw new ApiFailure(response.status);
            const parsed = (await response.json()) as T;
            const etag = method === 'GET' ? response.headers?.get('ETag') : null;
            if (etag) cache?.validate(path, etag, parsed);
            return parsed;
        },
        [apiBase, token, onSessionExpired, cache],
    );
}
