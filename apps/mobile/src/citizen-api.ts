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
            const response = await fetch(apiBase + path, { method, headers: { Authorization: 'Bearer ' + token, ...(body && { 'Content-Type': 'application/json' }) }, ...(body && { body: JSON.stringify(body) }), signal });
            if (signal.aborted) throw new Error('Consulta cancelada.');
            if (response.status === 401 && !expired.current) {
                expired.current = true;
                onSessionExpired();
            }
            if (response.status === 403 || response.status === 404) cache?.invalidate();
            if (!response.ok) throw new ApiFailure(response.status);
            return (await response.json()) as T;
        },
        [apiBase, token, onSessionExpired, cache],
    );
}
