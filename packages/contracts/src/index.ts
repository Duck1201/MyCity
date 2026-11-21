import { z } from 'zod';

export const locationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    source: z.enum(['GPS', 'MANUAL']),
});

export const reportStatusSchema = z.enum(['SENT', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELED']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export const managerTransitionTargets: Readonly<Record<ReportStatus, readonly ReportStatus[]>> = {
    SENT: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['IN_PROGRESS', 'REJECTED', 'SENT'],
    IN_PROGRESS: ['RESOLVED', 'UNDER_REVIEW'],
    RESOLVED: ['UNDER_REVIEW'],
    REJECTED: ['UNDER_REVIEW'],
    CANCELED: ['UNDER_REVIEW'],
};

export function allowedManagerTargets(status: ReportStatus, previousStatus?: ReportStatus | null): readonly ReportStatus[] {
    const inverse = status === 'UNDER_REVIEW' ? 'SENT' : status === 'IN_PROGRESS' ? 'UNDER_REVIEW' : undefined;
    const targets = managerTransitionTargets[status];
    return inverse && previousStatus !== inverse ? targets.filter((target) => target !== inverse) : targets;
}

export type Role = 'CITIZEN' | 'MANAGER';
export type Location = z.infer<typeof locationSchema>;

const initialCategorySchema = z.enum(['POTHOLE', 'WASTE', 'LIGHTING', 'DEBRIS', 'LEAK', 'TREE']);
export const reportCategorySchema = z.union([initialCategorySchema, z.uuidv4()]);
export const categoryIconSchema = z.enum(['road', 'lighting', 'waste', 'water', 'debris', 'trees', 'access', 'cycling', 'transit', 'works', 'walkway', 'signs', 'drainage', 'energy']);
export type CategoryIconKey = z.infer<typeof categoryIconSchema>;
const builtInIcons: Partial<Record<string, CategoryIconKey>> = { POTHOLE: 'road', LIGHTING: 'lighting', WASTE: 'waste', LEAK: 'water', DEBRIS: 'debris', TREE: 'trees' };
export function categoryIconFor(id: string, icon?: string | null): CategoryIconKey {
    return categoryIconSchema.safeParse(icon).data ?? builtInIcons[id] ?? 'signs';
}
export interface ReportCategoryOption {
    icon?: CategoryIconKey;
    reportCount?: number;
    archived: boolean;
    id: string;
    name: string;
}
export const createCategorySchema = z.strictObject({
    icon: categoryIconSchema.optional(),
    name: z
        .string()
        .transform((value) => value.normalize('NFC').trim().replace(/\s+/gu, ' '))
        .pipe(
            z
                .string()
                .min(1)
                .max(80)
                .regex(/[\p{L}\p{N}]/u)
                .refine((value) => ![...value].some((character) => character.charCodeAt(0) < 32)),
        ),
});
export const updateCategorySchema = z.union([createCategorySchema, z.strictObject({ archived: z.boolean() })]);
export type ReportCategory = z.infer<typeof reportCategorySchema>;
export const reportCategoryLabels: Record<ReportCategory, string> = {
    POTHOLE: 'Buraco na via',
    WASTE: 'Lixo não coletado',
    LIGHTING: 'Iluminação pública',
    DEBRIS: 'Entulho irregular',
    LEAK: 'Vazamento de água/esgoto',
    TREE: 'Poda/risco de árvore',
};
export const reportMetadataSchema = z.strictObject({
    clientRequestId: z.string().trim().min(1).max(128),
    category: reportCategorySchema,
    description: z.string().trim().min(1).max(1000),
    location: locationSchema.strict(),
    showIdentity: z.boolean(),
});
export type ReportMetadata = z.infer<typeof reportMetadataSchema>;
export interface ReportPhoto {
    id: string;
    position: number;
    width: number;
    height: number;
    byteSize: number;
    contentPath: string;
    thumbnailPath: string;
}
export interface ReportSummary {
    id: string;
    category: ReportCategory;
    categoryName: string;
    description: string;
    status: ReportStatus;
    location: Location;
    createdAt: string;
    updatedAt: string;
    confirmationCount: number;
    confirmedByMe: boolean;
    isMine: boolean;
    photosExpireAt?: string;
    coverPhoto?: ReportPhoto;
    showIdentity: boolean;
    author?: { name: string; photoUrl: string };
}
export interface ReportDetail extends ReportSummary {
    version: number;
    photos: ReportPhoto[];
    allowedActions: string[];
    // Present while the report is rejected: the justification the manager gave.
    rejectionReason?: string;
}

export interface ReportEvent {
    id: string;
    type: 'CREATED' | 'STATUS_CHANGED' | 'REPLY';
    actorRole: Role;
    fromStatus?: ReportStatus;
    toStatus?: ReportStatus;
    text?: string;
    createdAt: string;
}

export type { ReportNotification } from './notifications.js';

const serviceText = z.string().trim().min(1).max(2000);
export const cancellationSchema = z.strictObject({ expectedVersion: z.number().int().positive().max(2147483647) });
export const transitionSchema = z
    .strictObject({
        targetStatus: reportStatusSchema,
        expectedVersion: z.number().int().positive().max(2147483647),
        reason: serviceText.optional(),
    })
    .refine(({ targetStatus, reason }) => (targetStatus === 'REJECTED') === (reason !== undefined), { path: ['reason'], message: 'Informe justificativa apenas na rejeição.' });
export const replySchema = z.strictObject({ text: serviceText, clientRequestId: z.string().trim().min(1).max(128) });
export type ReportTransition = z.infer<typeof transitionSchema>;
export type ReportReply = z.infer<typeof replySchema>;

export interface ReportMarker {
    id: string;
    latitude: number;
    longitude: number;
    category: ReportCategory;
    categoryName: string;
    status: ReportStatus;
    confirmationCount: number;
}
export type ReportStatusCounts = Record<ReportStatus, number>;

const reportQueryPagination = {
    limit: z
        .string()
        .regex(/^[1-9]\d{0,2}$/)
        .transform(Number)
        .pipe(z.number().max(100))
        .optional()
        .default(20),
    cursor: z.string().min(1).max(256).optional(),
};
const reportQueryFilters = { category: reportCategorySchema.optional(), status: reportStatusSchema.optional() };
const reportQueryScope = z.enum(['mine', 'feed', 'resolved', 'management']);
export const reportListQuerySchema = z.strictObject({ scope: reportQueryScope, ...reportQueryPagination, ...reportQueryFilters, sort: z.enum(['newest', 'priority']).optional() });
const bbox = z.string().transform((s, ctx) => {
    const parts = s.split(',');
    const [west, south, east, north] = parts.map(Number);
    if (parts.length !== 4 || parts.some((p) => !p.trim()) || ![west, south, east, north].every(Number.isFinite) || west! < -180 || east! > 180 || south! < -90 || north! > 90 || west! >= east! || south! >= north!) {
        ctx.addIssue({ code: 'custom', message: 'Área inválida.' });
        return z.NEVER;
    }
    return { west: west!, south: south!, east: east!, north: north! };
});
export const reportMapQuerySchema = z.strictObject({ ...reportQueryPagination, ...reportQueryFilters, bbox: bbox.optional() });
export const reportSummaryQuerySchema = z.strictObject({ category: reportCategorySchema.optional() });

export type { WeatherAlert, WeatherAlertLevel } from './weather-alerts.js';
export const weatherAlertQuerySchema = z.strictObject(reportQueryPagination);

export { cpfDigits, formatCpfInput } from './cpf-input.js';

export * from './management-queue.js';

export type { ManagementOverview } from './management-overview.js';

export { fetchWithServerTime, serverTimeHeader, serverTimeReader, subscribeServerTime } from './server-clock.js';
