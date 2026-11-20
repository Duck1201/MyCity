import type { ReportStatus } from '@mycity/contracts';
export const statusNames: Record<ReportStatus, string> = { SENT: 'Enviado', UNDER_REVIEW: 'Em análise', IN_PROGRESS: 'Em andamento', RESOLVED: 'Resolvido', REJECTED: 'Rejeitado', CANCELED: 'Cancelado' };
export const statusKeys = Object.keys(statusNames) as ReportStatus[];
