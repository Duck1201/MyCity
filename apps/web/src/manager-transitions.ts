import { managerTransitionTargets, type ReportStatus } from '@mycity/contracts';

const standardLabels: Partial<Record<ReportStatus, string>> = {
    SENT: 'Devolver para Enviado',
    UNDER_REVIEW: 'Iniciar análise',
    IN_PROGRESS: 'Iniciar atendimento',
    REJECTED: 'Rejeitar denúncia',
    RESOLVED: 'Marcar como resolvida',
};

export const reopeningHint = 'Ao reabrir, a denúncia e suas fotos voltam ao feed dos cidadãos autenticados.';

export function isReopening(from: ReportStatus, to: ReportStatus) {
    return to === 'UNDER_REVIEW' && (from === 'RESOLVED' || from === 'REJECTED' || from === 'CANCELED');
}

export function managerTransitions(from: ReportStatus) {
    return managerTransitionTargets[from].map((target) => {
        const label = isReopening(from, target) ? 'Reabrir solicitação' : from === 'IN_PROGRESS' && target === 'UNDER_REVIEW' ? 'Voltar para análise' : standardLabels[target]!;
        return { target, label };
    });
}
