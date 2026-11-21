import { allowedManagerTargets, type ReportStatus, type Role } from '@mycity/contracts';

export function isOpenReportStatus(status: ReportStatus) {
    return status === 'SENT' || status === 'UNDER_REVIEW' || status === 'IN_PROGRESS';
}

export function managerActions(status: ReportStatus, previousStatus?: ReportStatus | null) {
    return [...allowedManagerTargets(status, previousStatus), 'REPLY'];
}

export function canTransition(input: { from: ReportStatus; to: ReportStatus; role: Role; isAuthor: boolean; previousStatus?: ReportStatus | null | undefined }): boolean {
    if (input.role === 'MANAGER') return allowedManagerTargets(input.from, input.previousStatus).includes(input.to);
    return input.isAuthor && input.to === 'CANCELED' && (input.from === 'SENT' || input.from === 'UNDER_REVIEW');
}

export function photosAvailable(deadline: Date | null) {
    return deadline === null || deadline.getTime() > Date.now();
}
