import type { ReportCategoryOption, ReportStatus, ReportStatusCounts } from './index.js';

export interface ManagementOverview {
    counts: ReportStatusCounts;
    oldest: { id: string; createdAt: string } | null;
    categories: (ReportCategoryOption & { count: number })[];
    priorities: { id: string; category: string; description: string; status: ReportStatus; confirmationCount: number; createdAt: string; photoPath?: string }[];
}
