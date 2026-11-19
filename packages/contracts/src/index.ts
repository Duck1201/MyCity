import { z } from 'zod';

export const locationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    source: z.enum(['GPS', 'MANUAL']),
});

export const reportStatusSchema = z.enum(['SENT', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELED']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type Role = 'CITIZEN' | 'MANAGER';
export type Location = z.infer<typeof locationSchema>;
