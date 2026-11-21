import { managerVisibleReports } from './management-visibility.js';
import { once } from 'node:events';
import { managementQueueSchema, queueExportSchema } from '@mycity/contracts';
import { managementCsv, managementQueue } from './management-queue.js';
import { managementOverview } from './overview.js';
import { Router } from 'express';
import { reportListQuerySchema, reportMapQuerySchema, reportSummaryQuerySchema, type ReportStatusCounts } from '@mycity/contracts';
import type { Database } from '../../database.js';
import type { createReportStore } from './store.js';
import { ReportError } from './upload.js';

function invalidQuery() {
    return new ReportError(400, 'INVALID_REQUEST', 'Filtros ou paginação inválidos.');
}

export function createReportQueryRouter(database: Database, store: ReturnType<typeof createReportStore>) {
    const router = Router();
    router.get('/', async (req, res) => {
        const parsed = reportListQuerySchema.safeParse(req.query);
        if (!parsed.success) throw invalidQuery();
        const { scope, sort } = parsed.data;
        if (scope === 'management' && res.locals.user.role !== 'MANAGER') throw new ReportError(403, 'FORBIDDEN', 'A gestão exige uma conta de gestor.');
        if ((sort === 'priority' && scope !== 'management') || (scope === 'resolved' && sort === 'newest')) throw invalidQuery();
        res.json(await store.list(res.locals.user.id, parsed.data));
    });
    router.get('/queue', async (req, res) => {
        if (res.locals.user.role !== 'MANAGER') throw new ReportError(403, 'FORBIDDEN', 'A fila exige uma conta de gestor.');
        const filters = managementQueueSchema.safeParse(req.query);
        if (!filters.success) throw invalidQuery();
        res.json(await managementQueue(database, filters.data));
    });
    router.get('/queue.csv', async (req, res) => {
        if (res.locals.user.role !== 'MANAGER') throw new ReportError(403, 'FORBIDDEN', 'A exportação exige uma conta de gestor.');
        const filters = queueExportSchema.safeParse(req.query);
        if (!filters.success) throw invalidQuery();
        const disconnect = new AbortController();
        res.once('close', () => disconnect.abort());
        const signal = AbortSignal.any([disconnect.signal, AbortSignal.timeout(300_000)]);
        await managementCsv(database, filters.data, signal, async (etag, chunks) => {
            signal.throwIfAborted();
            res.attachment('ocorrencias.csv').type('text/csv; charset=utf-8').set('ETag', etag);
            if (req.fresh) {
                res.status(304).removeHeader('Content-Type');
                return;
            }
            if (req.method === 'HEAD') return;
            for await (const chunk of chunks) {
                if (!res.write(chunk)) await once(res, 'drain', { signal });
            }
        });
        res.end();
    });
    router.get('/map', async (req, res) => {
        const parsed = reportMapQuerySchema.safeParse(req.query);
        if (!parsed.success) throw invalidQuery();
        res.json(await store.markers(res.locals.user.id, parsed.data));
    });
    router.get('/overview', async (req, res) => {
        if (res.locals.user.role !== 'MANAGER') throw new ReportError(403, 'FORBIDDEN', 'A gestão exige uma conta de gestor.');
        if (Object.keys(req.query).length) throw invalidQuery();
        res.json({ data: await managementOverview(database) });
    });
    router.get('/summary', async (req, res) => {
        if (res.locals.user.role !== 'MANAGER') throw new ReportError(403, 'FORBIDDEN', 'A gestão exige uma conta de gestor.');
        const parsed = reportSummaryQuerySchema.safeParse(req.query);
        if (!parsed.success) throw invalidQuery();
        const rows = await database.report.groupBy({ by: ['status'], where: { ...managerVisibleReports, ...(parsed.data.category && { category: parsed.data.category }) }, _count: { _all: true } });
        const data: ReportStatusCounts = { SENT: 0, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 };
        for (const row of rows) data[row.status] = row._count._all;
        res.json({ data });
    });
    return router;
}
