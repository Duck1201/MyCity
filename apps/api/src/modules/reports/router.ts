import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import express, { type ErrorRequestHandler, type RequestHandler, type Request, type Response } from 'express';
import type { Database } from '../../database.js';
import { transitionSchema, replySchema, cancellationSchema } from '@mycity/contracts';
import { createReportQueryRouter } from './query-router.js';
import { createService } from './service.js';
import { createReportStore, reportNotFound } from './store.js';
import { thumbnailFile } from './thumbnail.js';
import { editableReport, editReport } from './edit.js';
import { ReportError, parseEditUpload, parseUpload } from './upload.js';

function pagination(req: Request, allowedParams: string[]) {
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    const cursor = req.query.cursor;
    if (Object.keys(req.query).some((k) => !allowedParams.includes(k)) || !Number.isInteger(limit) || limit < 1 || limit > 100 || (cursor !== undefined && (typeof cursor !== 'string' || !cursor))) throw new ReportError(400, 'INVALID_REQUEST', 'Paginação inválida.');
    return { limit, cursor };
}
const requireCitizen: RequestHandler = (_req, res, next) => {
    if (res.locals.user.role !== 'CITIZEN') throw new ReportError(403, 'FORBIDDEN', 'Esta ação exige uma conta de cidadão.');
    next();
};
const requireManager: RequestHandler = (_req, res, next) => {
    if (res.locals.user.role !== 'MANAGER') throw new ReportError(403, 'FORBIDDEN', 'O atendimento exige uma conta de gestor.');
    next();
};

export function createReportsRouter(database: Database, uploadDir: string) {
    const router = express.Router();
    const service = createService(database);
    const store = createReportStore(database, uploadDir);
    let activeUploads = 0;
    const windows = new Map<string, { until: number; attempts: number }>();
    router.use((_req, res, next) => {
        if (!res.locals.user) throw new ReportError(401, 'UNAUTHENTICATED', 'Entre para continuar.');
        next();
    });
    const admitUpload: RequestHandler = (req, res, next) => {
        if (!req.is('multipart/form-data')) throw new ReportError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envie as fotos por multipart.');
        const now = Date.now();
        for (const [id, window] of windows) if (window.until <= now) windows.delete(id);
        const id: string = res.locals.user.id;
        const window = windows.get(id) ?? { until: now + 15 * 60_000, attempts: 0 };
        if (window.attempts >= 30 || activeUploads >= 4) {
            res.set('Retry-After', String(activeUploads >= 4 ? 5 : Math.ceil((window.until - now) / 1000)));
            throw new ReportError(429, 'TOO_MANY_REQUESTS', 'Aguarde antes de tentar enviar outra denúncia.');
        }
        windows.set(id, window);
        window.attempts++;
        activeUploads++;
        let released = false;
        const release = () => {
            if (!released) {
                released = true;
                activeUploads--;
            }
        };
        res.locals.releaseUpload = release;
        // A disconnected client may leave the parser waiting, but a completed body
        // still occupies memory while pictures are decoded and committed.
        req.once('aborted', release);
        next();
    };
    const rawUpload = express.raw({ type: 'multipart/form-data', limit: '16mb', inflate: false });
    router.post('/', requireCitizen, admitUpload, rawUpload, async (req, res) => {
        try {
            const input = await parseUpload(req.headers, req.body);
            const { status, data } = await store.publish(res.locals.user.id, input);
            res.status(status).json({ data });
        } finally {
            res.locals.releaseUpload();
        }
    });
    router.patch(
        '/:id',
        requireCitizen,
        async (req: Request<{ id: string }>, res, next) => {
            await editableReport(database, req.params.id, res.locals.user.id);
            next();
        },
        admitUpload,
        rawUpload,
        async (req: Request<{ id: string }>, res) => {
            try {
                const input = await parseEditUpload(req.headers, req.body);
                res.json({ data: await editReport(database, uploadDir, req.params.id, res.locals.user.id, input) });
            } finally {
                res.locals.releaseUpload();
            }
        },
    );
    router.use(createReportQueryRouter(database, store));
    router.post('/:id/transitions', requireManager, express.json({ limit: '32kb' }), async (req: Request<{ id: string }>, res) => {
        const parsed = transitionSchema.safeParse(req.body);
        if (!parsed.success) throw new ReportError(422, 'VALIDATION_ERROR', 'Confira a ação, a versão e a justificativa.');
        res.json({ data: await service.transition(req.params.id, res.locals.user, parsed.data) });
    });
    router
        .route('/:id/confirmation')
        .put(requireCitizen, async (req, res) => {
            res.json({ data: await service.confirm(req.params.id, res.locals.user.id, true) });
        })
        .delete(requireCitizen, async (req, res) => {
            res.json({ data: await service.confirm(req.params.id, res.locals.user.id, false) });
        });
    router.post('/:id/cancellation', requireCitizen, express.json({ limit: '4kb' }), async (req: Request<{ id: string }>, res) => {
        const parsed = cancellationSchema.safeParse(req.body);
        if (!parsed.success) throw new ReportError(422, 'VALIDATION_ERROR', 'Informe a versão da denúncia.');
        res.json({ data: await service.transition(req.params.id, res.locals.user, { targetStatus: 'CANCELED', expectedVersion: parsed.data.expectedVersion }) });
    });
    router.post('/:id/reopening', requireCitizen, express.json({ limit: '4kb' }), async (req: Request<{ id: string }>, res) => {
        const parsed = cancellationSchema.safeParse(req.body);
        if (!parsed.success) throw new ReportError(422, 'VALIDATION_ERROR', 'Informe a versão da denúncia.');
        res.json({ data: await service.transition(req.params.id, res.locals.user, { targetStatus: 'SENT', expectedVersion: parsed.data.expectedVersion }) });
    });
    router.post('/:id/replies', requireManager, express.json({ limit: '32kb' }), async (req: Request<{ id: string }>, res) => {
        const parsed = replySchema.safeParse(req.body);
        if (!parsed.success) throw new ReportError(422, 'VALIDATION_ERROR', 'Informe um texto de até 2.000 caracteres e a identificação do envio.');
        const { status, data } = await service.reply(req.params.id, res.locals.user.id, parsed.data);
        res.status(status).json({ data });
    });
    router.get('/:id/history', async (req, res) => {
        const { limit, cursor } = pagination(req, ['limit', 'cursor', 'order']);
        const order = req.query.order ?? 'oldest';
        if (order !== 'oldest' && order !== 'newest') throw new ReportError(400, 'INVALID_REQUEST', 'Ordem de histórico inválida.');
        res.json(await service.history(req.params.id, res.locals.user, limit, cursor, order));
    });
    router.get('/:id', async (req, res) => {
        res.json({ data: await store.get(req.params.id, res.locals.user) });
    });
    const sendPhoto = async (req: Request<{ id: string; photoId: string }>, res: Response, thumbnail: boolean) => {
        const report = await store.get(req.params.id, res.locals.user);
        const photo = report.photos.find((p) => p.id === req.params.photoId);
        if (!photo) throw reportNotFound();
        const root = resolve(uploadDir, report.id);
        // Photos predating thumbnails fall back to the original until the backfill runs.
        const file = thumbnail && (await stat(resolve(root, thumbnailFile(photo.id))).catch(() => undefined))?.isFile() ? thumbnailFile(photo.id) : photo.id + '.jpg';
        if (report.photosExpireAt && Date.parse(report.photosExpireAt) <= Date.now()) throw reportNotFound();
        res.type('jpeg')
            .set('X-Content-Type-Options', 'nosniff')
            .sendFile(file, { root, cacheControl: false, headers: { 'Cache-Control': res.locals.transport === 'bearer' ? 'no-store' : 'private, no-cache' } });
    };
    router.get('/:id/photos/:photoId', (req, res) => sendPhoto(req, res, false));
    router.get('/:id/photos/:photoId/thumb', (req, res) => sendPhoto(req, res, true));
    const errors: ErrorRequestHandler = (error, _req, res, next) => {
        res.locals.releaseUpload?.();
        if (res.headersSent) {
            next(error);
            return;
        }
        let failure = new ReportError(500, 'INTERNAL_ERROR', 'Não foi possível concluir a operação.');
        if (error instanceof ReportError) failure = error;
        else if (error.type === 'entity.too.large') failure = new ReportError(413, 'PAYLOAD_TOO_LARGE', 'Envio acima do limite permitido.');
        else if (error.type === 'entity.parse.failed') failure = new ReportError(400, 'INVALID_REQUEST', 'JSON inválido.');
        else if (error.type === 'encoding.unsupported') failure = new ReportError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Codificação inválida.');
        res.status(failure.status).json({ error: { code: failure.code, message: failure.message }, requestId: res.locals.requestId ?? randomUUID() });
    };
    router.use(errors);
    return router;
}
