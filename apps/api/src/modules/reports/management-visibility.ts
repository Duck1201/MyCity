import { Prisma } from '../../generated/prisma/client.js';

export const managerInteraction = { actor: { role: 'MANAGER' }, type: { in: ['REPLY', 'STATUS_CHANGED'] } } satisfies Prisma.ReportEventWhereInput;

export const managerVisibleReports = { OR: [{ status: { not: 'CANCELED' } }, { events: { some: managerInteraction } }] } satisfies Prisma.ReportWhereInput;

// Ranked and streamed queries use the same history rule before counting or paginating.
export const managerVisibleSql = Prisma.sql`(r.status <> 'canceled' OR EXISTS (
    SELECT 1 FROM report_events e JOIN users u ON u.id = e.actor_id
    WHERE e.report_id = r.id AND u.role = 'manager' AND e.type IN ('REPLY', 'STATUS_CHANGED')
))`;
