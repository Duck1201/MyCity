import type { ReportStatus, Role } from '@mycity/contracts';

const managerTransitions: Record<ReportStatus, readonly ReportStatus[]> = {
    SENT: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['IN_PROGRESS', 'REJECTED'],
    IN_PROGRESS: ['RESOLVED'],
    RESOLVED: [],
    REJECTED: [],
    CANCELED: [],
};

export function canTransition(input: { from: ReportStatus; to: ReportStatus; role: Role; isAuthor: boolean }): boolean {
    if (input.role === 'MANAGER') return managerTransitions[input.from].includes(input.to);
    return input.isAuthor && input.to === 'CANCELED' && (input.from === 'SENT' || input.from === 'UNDER_REVIEW');
}
