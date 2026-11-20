import type { ReportStatus } from './index.js';

export interface ReportNotification {
    id: string;
    reportId: string;
    reportEventId: string;
    type: 'STATUS_CHANGED';
    fromStatus?: ReportStatus;
    status: ReportStatus;
    createdAt: string;
    readAt: string | null;
}
