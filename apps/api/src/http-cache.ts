import type { Request, RequestHandler, Response } from 'express';

// Reads may be kept by the browser only to revalidate them: Express answers a
// matching If-None-Match with 304, which saves the payload on every poll.
// Writes and every error response stay out of the cache. The Android app
// (Bearer) keeps its own validators and clears them on sign-out, so its HTTP
// stack must not store anything: Clear-Site-Data does not reach it.
export const fromApp = (req: Request) => /^Bearer\s/i.test(req.headers.authorization ?? '');
export const httpCachePolicy: RequestHandler = (req, res, next) => {
    const readable = req.method === 'GET' || req.method === 'HEAD';
    res.set('Cache-Control', readable && !fromApp(req) ? 'private, no-cache' : 'no-store');
    if (readable) {
        const writeHead = res.writeHead;
        res.writeHead = function (this: Response, ...args: Parameters<Response['writeHead']>) {
            const status = typeof args[0] === 'number' ? args[0] : this.statusCode;
            if (status >= 400) this.setHeader('Cache-Control', 'no-store');
            return writeHead.apply(this, args);
        } as Response['writeHead'];
    }
    next();
};

// Asks the browser to drop the origin's HTTP cache, including revalidated API
// reads and private photos, once their session is over.
export const clearBrowserCache = (res: Response) => res.set('Clear-Site-Data', '"cache"');
