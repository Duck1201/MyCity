const http = require('node:http');

function previewProxy(target, next) {
    const upstream = new URL(target);
    if (upstream.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname)) throw Error('A prévia exige uma API local.');
    return (req, res, nextMiddleware) => {
        if (!req.url.startsWith('/api/')) return next(req, res, nextMiddleware);
        const headers = {};
        // Cookies are shared across localhost ports. The citizen uses only the app's Bearer session.
        for (const name of ['authorization', 'content-type', 'content-length', 'if-none-match', 'accept', 'range']) {
            if (req.headers[name] !== undefined) headers[name] = req.headers[name];
        }
        const outgoing = http.request(upstream, { path: req.url, method: req.method, headers }, (incoming) => {
            const headers = { ...incoming.headers };
            delete headers['set-cookie'];
            res.writeHead(incoming.statusCode, headers);
            incoming.on('error', () => res.destroy());
            incoming.pipe(res);
        });
        outgoing.on('error', () => {
            if (res.headersSent) return res.destroy();
            res.writeHead(502, { 'Cache-Control': 'no-store' }).end('API local indisponível.');
        });
        res.once('close', () => outgoing.destroy());
        req.pipe(outgoing);
    };
}
module.exports = { previewProxy };
