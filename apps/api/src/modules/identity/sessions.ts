import { publicRateLimit } from '../../public-limits.js';
import { createHash, randomBytes } from 'node:crypto';
import express, { type RequestHandler, type Request, type Response } from 'express';
import type { Database } from '../../database.js';
import { createIdentity, credentialHash } from './index.js';
import { createLoginLimits } from './login-limits.js';
import { clearBrowserCache } from '../../http-cache.js';

const lifetime = 24 * 60 * 60 * 1000;
const cookieName = '__Host-mycity';
const cookieOptions = { secure: true, httpOnly: true, sameSite: 'lax', path: '/' } as const;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

function reject(res: Response, status: number, code: string, message: string) {
    res.status(status).json({ error: { code, message }, requestId: res.locals.requestId });
}
function sessionCredential(req: Request) {
    const cookies = (req.get('cookie') ?? '')
        .split(';')
        .map((value) => value.trim())
        .filter((value) => value.startsWith(cookieName + '='));
    const auth = req.get('authorization');
    if (cookies.length > 1 || (cookies.length && auth)) return;
    const token = cookies.length ? cookies[0]!.slice(cookieName.length + 1) : auth?.match(/^Bearer (\S+)$/i)?.[1];
    if (token && /^[a-zA-Z0-9_-]{43}$/.test(token)) return { token, transport: cookies.length ? 'cookie' : 'bearer' };
}

const presentsSession = (req: Request) => !!req.get('authorization') || (req.get('cookie') ?? '').split(';').some((value) => value.trim().startsWith(cookieName + '='));

export function createSessionRoutes(database: Database, origin: string) {
    const router = express.Router();
    const identity = createIdentity(database);
    const reserve = createLoginLimits();
    const fromWeb = (req: Request) => req.get('origin') === origin && req.get('X-MyCity-Client') === 'web';
    const forbidden = (res: Response) => reject(res, 403, 'FORBIDDEN', 'Origem da solicitação não permitida.');
    const unauthenticated = (res: Response) => reject(res, 401, 'UNAUTHENTICATED', 'Sessão inválida ou expirada.');
    const authenticate: RequestHandler = async (req, res, next) => {
        const credential = sessionCredential(req);
        if (!credential) {
            // A session cookie or token that no longer parses still means a session ended here.
            if (presentsSession(req)) clearBrowserCache(res);
            return unauthenticated(res);
        }
        if (credential.transport === 'cookie' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !fromWeb(req)) return forbidden(res);
        const tokenHash = digest(credential.token);
        const session = await database.session.findUnique({ where: { tokenHash }, select: { expiresAt: true, transport: true, credentialHash: true, user: { select: { id: true, role: true, password: true, loginEnabled: true } } } });
        if (!session?.user.loginEnabled || session.credentialHash !== credentialHash(session.user.password) || session.transport !== credential.transport || session.expiresAt.getTime() <= Date.now()) return unauthenticated(clearBrowserCache(res));
        res.locals.user = { id: session.user.id, role: session.user.role };
        res.locals.sessionExpiresAt = session.expiresAt;
        res.locals.tokenHash = tokenHash;
        res.locals.transport = credential.transport;
        next();
    };
    router.post('/api/v1/sessions', publicRateLimit(30), express.json({ limit: '8kb' }), async (req, res) => {
        const { cpf, password, transport } = req.body ?? {};
        if (typeof cpf !== 'string' || cpf.length > 32 || typeof password !== 'string' || !password.length || !['cookie', 'bearer'].includes(transport)) return reject(res, 400, 'INVALID_REQUEST', 'Informe CPF, senha e transporte.');
        if (transport === 'cookie' && !fromWeb(req)) return forbidden(res);
        const attempt = reserve(req.ip ?? 'unknown', cpf.replace(/\D/g, ''));
        if (attempt.retryAfter !== undefined) {
            res.set('Retry-After', String(attempt.retryAfter));
            return reject(res, 429, 'TOO_MANY_REQUESTS', 'Muitas tentativas de login. Aguarde antes de tentar novamente.');
        }
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + lifetime);
        let account;
        try {
            account = await identity.issueSession(cpf, password, { tokenHash: digest(token), expiresAt, transport });
        } finally {
            attempt.finish(Boolean(account));
        }
        if (!account) return reject(res, 401, 'UNAUTHENTICATED', 'CPF ou senha inválidos.');
        if (transport === 'cookie') res.cookie(cookieName, token, { ...cookieOptions, expires: expiresAt });
        res.status(201).json({ data: { user: { id: account.id, role: account.role }, expiresAt, ...(transport === 'bearer' ? { token } : {}) } });
    });
    router.get('/api/v1/me', authenticate, (_req, res) => {
        res.set('X-Session-Expires-At', res.locals.sessionExpiresAt.toISOString()).json({ data: res.locals.user });
    });
    router.delete('/api/v1/sessions/current', authenticate, async (_req, res) => {
        await database.session.deleteMany({ where: { tokenHash: res.locals.tokenHash } });
        if (res.locals.transport === 'cookie') res.clearCookie(cookieName, cookieOptions);
        clearBrowserCache(res).sendStatus(204);
    });
    return { router, authenticate };
}
