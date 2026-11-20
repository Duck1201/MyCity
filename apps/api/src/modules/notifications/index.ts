import { Router } from 'express';
import type { Database } from '../../database.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ReportNotification, ReportStatus } from '@mycity/contracts';

type StatusChange = { eventId: string; reportId: string; recipientId: string; status: ReportStatus; createdAt: Date };
export function notifyStatusChange(tx: Pick<Prisma.TransactionClient, 'notification'>, change: StatusChange) {
    return tx.notification.create({ data: change, select: { id: true } });
}

const fields = { id: true, reportId: true, eventId: true, event: { select: { fromStatus: true } }, status: true, createdAt: true, readAt: true } as const;
function dto(row: Prisma.NotificationGetPayload<{ select: typeof fields }>): ReportNotification {
    return { id: row.id, reportId: row.reportId, reportEventId: row.eventId, type: 'STATUS_CHANGED', ...(row.event.fromStatus && { fromStatus: row.event.fromStatus }), status: row.status, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null };
}
export function createNotificationsRouter(database: Database) {
    const router = Router();
    router.use((_req, res, next) => {
        if (res.locals.user.role !== 'CITIZEN') {
            res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Os avisos são pessoais do cidadão.' }, requestId: res.locals.requestId });
            return;
        }
        next();
    });
    router.get('/', async (req, res) => {
        const recipientId: string = res.locals.user.id;
        const { cursor, unreadOnly } = req.query;
        const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
        if (Object.keys(req.query).some((key) => !['limit', 'cursor', 'unreadOnly'].includes(key)) || (req.query.limit !== undefined && typeof req.query.limit !== 'string') || !Number.isInteger(limit) || limit < 1 || limit > 100 || (unreadOnly !== undefined && unreadOnly !== 'true' && unreadOnly !== 'false') || (cursor !== undefined && (typeof cursor !== 'string' || !cursor))) {
            res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Parâmetros de consulta inválidos.' }, requestId: res.locals.requestId });
            return;
        }
        if (cursor && !(await database.notification.findFirst({ where: { id: cursor, recipientId }, select: { id: true } }))) {
            res.status(400).json({ error: { code: 'INVALID_CURSOR', message: 'Página inválida.' }, requestId: res.locals.requestId });
            return;
        }
        const rows = await database.notification.findMany({
            where: { recipientId, ...(unreadOnly === 'true' && { readAt: null }) },
            select: fields,
            take: limit + 1,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        });
        const data = rows.slice(0, limit).map(dto);
        res.json({ data, page: { nextCursor: rows.length > limit ? data.at(-1)!.id : null } });
    });
    router.put('/:id/read', async (req, res) => {
        const where = { id: req.params.id, recipientId: res.locals.user.id as string };
        const [, row] = await database.$transaction([database.notification.updateMany({ where: { ...where, readAt: null }, data: { readAt: new Date() } }), database.notification.findFirst({ where, select: fields })]);
        if (!row) {
            res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Aviso não encontrado.' }, requestId: res.locals.requestId });
            return;
        }
        res.json({ data: dto(row) });
    });
    return router;
}
