import { expect, it, vi } from 'vitest';
import { fetchWithServerTime, serverTimeHeader, serverTimeReader } from '../src/server-clock.js';

it('waits for a fresh server sample after the civil clock moves backwards', async () => {
    const server = 1_000_000;
    const wall = vi.spyOn(Date, 'now').mockReturnValue(500_000);
    vi.spyOn(performance, 'now').mockReturnValue(100);
    const response = (stamp: number) => new Response(null, { headers: { [serverTimeHeader]: String(stamp) } });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(server));
    vi.stubGlobal('fetch', fetcher);
    try {
        await fetchWithServerTime('/reports');
        wall.mockReturnValue(700_000);
        expect(serverTimeReader()?.()).toBe(server + 200_000);
        wall.mockReturnValue(500_000);
        expect(serverTimeReader()?.()).toBe(Infinity);
        let finish!: (result: Response) => void;
        fetcher.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve))).mockResolvedValueOnce(response(server + 5000));
        const pending = fetchWithServerTime('/reports');
        await fetchWithServerTime('/reports');
        finish(response(server));
        await pending;
        expect(serverTimeReader()?.()).toBe(server + 5000);
    } finally {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    }
});
