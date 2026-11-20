import { z } from 'zod';
import type { ReportStatus, ReportStatusCounts } from './index.js';

const date = z.iso.date().refine((day) => day >= '0001-01-01');
const hasNoNullByte = (text: string) => !text.includes('\0');
const filters = {
    q: z.string().trim().max(160).refine(hasNoNullByte).optional(),
    category: z.string().min(1).max(128).refine(hasNoNullByte).optional(),
    status: z.enum(['pending', 'SENT', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELED']).optional(),
    de: date.optional(),
    ate: date.optional(),
    ordem: z.enum(['prioridade', 'antigas', 'recentes']).optional(),
};
const orderedDates = (input: { de?: string | undefined; ate?: string | undefined }) => !input.de || !input.ate || input.de <= input.ate;
export const queueExportSchema = z.strictObject(filters).refine(orderedDates);
export const managementQueueSchema = z.strictObject({ ...filters, pagina: z.coerce.number().int().min(1).max(2147483647).default(1), limit: z.coerce.number().int().min(1).max(100).default(5) }).refine(orderedDates);
export type QueueFilters = z.infer<typeof queueExportSchema>;
export type ManagementQueueRequest = z.infer<typeof managementQueueSchema>;
export interface ManagementQueueRow {
    id: string;
    category: string;
    categoryName: string;
    description: string;
    latitude: number;
    longitude: number;
    status: ReportStatus;
    createdAt: string;
    confirmationCount: number;
    coverPhotoId: string | null;
}
export interface ManagementQueuePage {
    data: ManagementQueueRow[];
    counts: ReportStatusCounts;
    page: number;
    total: number;
}

export function csvLine(values: (number | string)[]) {
    return values
        .map((value) => {
            const text = String(value);
            const safe = typeof value === 'string' && /^(?:[\t\r\n]|\s*[=+@\-＝＋＠－])/u.test(text) ? "'" + text : text;
            return '"' + safe.replaceAll('"', '""') + '"';
        })
        .join(';');
}
