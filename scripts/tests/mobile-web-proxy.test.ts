import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const servers: Server[] = [];
async function listen(server: Server) {
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}
afterEach(async () => {
    for (const server of servers.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()));
});
it('encaminha API e multipart com o Bearer do app, preserva revalidação e isola o cookie do painel', async () => {
    const { previewProxy } = require('../../apps/mobile/preview-proxy.cjs');
    const api = await listen(
        createServer(async (req, res) => {
            let body = '';
            for await (const chunk of req) body += chunk;
            res.setHeader('Set-Cookie', 'fixture=discard');
            res.setHeader('ETag', '"test"');
            res.end(JSON.stringify({ path: req.url, method: req.method, authorization: req.headers.authorization, cookie: req.headers.cookie, body }));
        }),
    );
    const proxy = previewProxy(api, (_req: unknown, res: { end: (body: string) => void }) => res.end('Metro'));
    const url = await listen(createServer(proxy));
    expect(await (await fetch(url + '/index.bundle')).text()).toBe('Metro');
    const response = await fetch(url + '/api/v1/reports/fixture?keep=1', { method: 'PATCH', headers: { authorization: 'Bearer synthetic', cookie: 'manager=fixture', 'content-type': 'multipart/form-data; boundary=demo' }, body: '--demo\r\nfixture\r\n--demo--' });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('etag')).toBe('"test"');
    expect(await response.json()).toEqual({ path: '/api/v1/reports/fixture?keep=1', method: 'PATCH', authorization: 'Bearer synthetic', body: '--demo\r\nfixture\r\n--demo--' });
});
