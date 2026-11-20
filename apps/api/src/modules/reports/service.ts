import type { ReportEvent, ReportTransition, ReportReply, Role } from '@mycity/contracts';
import type { Database } from '../../database.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { notifyStatusChange } from '../notifications/index.js';
import { canTransition, isOpenForConfirmation } from './rules.js';
import { ReportError } from './upload.js';
import { visibleReports, reportNotFound, readDetail, latestStatusChange, previousStatusOf } from './store.js';

const publicEvent = {
    id: true,
    type: true,
    actor: { select: { role: true } },
    fromStatus: true,
    toStatus: true,
    text: true,
    createdAt: true,
} satisfies Prisma.ReportEventSelect;
function eventDto(row: Prisma.ReportEventGetPayload<{ select: typeof publicEvent }>): ReportEvent {
    if (row.type !== 'REPLY' && row.type !== 'CREATED' && row.type !== 'STATUS_CHANGED') throw new Error('Tipo de evento desconhecido.');
    return { id: row.id, type: row.type, actorRole: row.actor.role, ...(row.fromStatus && { fromStatus: row.fromStatus }), ...(row.toStatus && { toStatus: row.toStatus }), ...(row.text && { text: row.text }), createdAt: row.createdAt.toISOString() };
}

// Every service writer takes this lock before checking the version or appending history.
async function lockReport(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM reports WHERE id = ${id} FOR UPDATE`;
    if (!rows.length) throw reportNotFound();
}
async function eventTime(tx: Prisma.TransactionClient, reportId: string) {
    // Timestamps persist at millisecond precision. Consecutive writes must also sort causally.
    const latest = await tx.reportEvent.findFirst({ where: { reportId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    return new Date(Math.max(Date.now(), (latest?.createdAt.getTime() ?? 0) + 1));
}

export async function setConfirmation(tx: Prisma.TransactionClient, reportId: string, citizenId: string, confirmed: boolean) {
    await lockReport(tx, reportId);
    const report = await tx.report.findFirst({ where: { id: reportId, ...visibleReports({ id: citizenId, role: 'CITIZEN' }) }, select: { authorId: true, status: true } });
    if (!report) throw reportNotFound();
    if (report.authorId === citizenId) throw new ReportError(403, 'FORBIDDEN', 'O autor não pode confirmar a própria denúncia.');
    if (!isOpenForConfirmation(report.status)) throw new ReportError(409, 'REPORT_CLOSED', 'A denúncia está encerrada.');
    const key = { reportId, userId: citizenId };
    if (confirmed) await tx.reportConfirmation.upsert({ where: { reportId_userId: key }, create: key, update: {} });
    else await tx.reportConfirmation.deleteMany({ where: key });
    return { confirmed, confirmationCount: await tx.reportConfirmation.count({ where: { reportId } }) };
}

export async function transitionReport(tx: Prisma.TransactionClient, reportId: string, actor: { id: string; role: Role }, input: ReportTransition) {
    await lockReport(tx, reportId);
    const report = await tx.report.findFirst({ where: { id: reportId, ...visibleReports(actor) }, select: { authorId: true, status: true, version: true, events: actor.role === 'MANAGER' && latestStatusChange } });
    if (!report) throw reportNotFound();
    if (actor.role === 'CITIZEN' && report.authorId !== actor.id) throw new ReportError(403, 'FORBIDDEN', 'Somente o autor pode cancelar a denúncia.');
    if (report.version !== input.expectedVersion) throw new ReportError(409, 'VERSION_CONFLICT', 'A denúncia foi atualizada. Consulte o estado atual.');
    if (!canTransition({ from: report.status, to: input.targetStatus, role: actor.role, previousStatus: previousStatusOf(report), isAuthor: actor.id === report.authorId })) throw new ReportError(409, 'INVALID_TRANSITION', 'Esta mudança de status não está disponível.');
    await tx.report.update({ where: { id: reportId }, data: { status: input.targetStatus, version: { increment: 1 } } });
    const event = await tx.reportEvent.create({ data: { reportId, actorId: actor.id, type: 'STATUS_CHANGED', fromStatus: report.status, toStatus: input.targetStatus, ...(input.reason && { text: input.reason }), createdAt: await eventTime(tx, reportId) }, select: { id: true, createdAt: true } });
    await notifyStatusChange(tx, { reportId, eventId: event.id, recipientId: report.authorId, status: input.targetStatus, createdAt: event.createdAt });
    return readDetail(tx, reportId, actor);
}

export async function publishReply(tx: Prisma.TransactionClient, reportId: string, actorId: string, input: ReportReply) {
    await lockReport(tx, reportId);
    const prior = await tx.reportEvent.findUnique({ where: { reportId_actorId_clientRequestId: { reportId, actorId, clientRequestId: input.clientRequestId } }, select: publicEvent });
    if (prior) {
        if (prior.text !== input.text) throw new ReportError(409, 'IDEMPOTENCY_CONFLICT', 'Este envio já foi usado com outro texto.');
        return { status: 200, data: eventDto(prior) };
    }
    const row = await tx.reportEvent.create({ data: { reportId, actorId, type: 'REPLY', text: input.text, clientRequestId: input.clientRequestId, createdAt: await eventTime(tx, reportId) }, select: publicEvent });
    return { status: 201, data: eventDto(row) };
}

export function createService(db: Database) {
    return {
        confirm(reportId: string, citizenId: string, confirmed: boolean) {
            return db.$transaction((tx) => setConfirmation(tx, reportId, citizenId, confirmed));
        },
        transition(reportId: string, actor: { id: string; role: Role }, input: ReportTransition) {
            return db.$transaction((tx) => transitionReport(tx, reportId, actor, input));
        },
        reply(reportId: string, actorId: string, input: ReportReply) {
            return db.$transaction((tx) => publishReply(tx, reportId, actorId, input));
        },
        async history(reportId: string, viewer: { id: string; role: Role }, limit: number, cursor?: string, order: 'oldest' | 'newest' = 'oldest') {
            const filter = { id: reportId, ...visibleReports(viewer) };
            if (!(await db.report.findFirst({ where: filter, select: { id: true } }))) throw reportNotFound();
            const where = { reportId, report: filter };
            if (cursor && !(await db.reportEvent.findFirst({ where: { ...where, id: cursor }, select: { id: true } }))) throw new ReportError(400, 'INVALID_CURSOR', 'Página inválida.');
            const direction = order === 'newest' ? 'desc' : 'asc';
            const events = await db.reportEvent.findMany({ where, select: publicEvent, orderBy: [{ createdAt: direction }, { id: direction }], take: limit + 1, ...(cursor && { cursor: { id: cursor }, skip: 1 }) });
            const data = events.slice(0, limit).map(eventDto);
            return { data, page: { nextCursor: events.length > limit ? data.at(-1)!.id : null } };
        },
    };
}
