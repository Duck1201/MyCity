import { reportCategoryLabels, type ReportStatus } from '@mycity/contracts';
import { photosForReport } from './images/report-photos';
import type { CategoryIcon } from './category-symbol';

import { statusNames } from '../report-status-labels';
export { statusKeys, statusNames } from '../report-status-labels';
export const pending = (status: ReportStatus) => ['SENT', 'UNDER_REVIEW', 'IN_PROGRESS'].includes(status);
export type Category = { id: string; name: string; icon: CategoryIcon; archived: boolean };
const initialSymbols: Record<string, CategoryIcon> = { POTHOLE: 'road', LIGHTING: 'lighting', WASTE: 'waste', LEAK: 'water', DEBRIS: 'debris', TREE: 'trees' };
export const categories: Category[] = Object.entries(reportCategoryLabels).map(([id, name]) => ({ id, name, icon: initialSymbols[id]!, archived: false }));

const examples = [
    ['POTHOLE', 'Buraco próximo à travessia de pedestres', 'Rua dos Passos'],
    ['LIGHTING', 'Poste apagado ao lado do ponto de ônibus', 'Avenida Santa Rita'],
    ['WASTE', 'Sacos de lixo acumulados na calçada', 'Rua Gomes Barbosa'],
    ['LEAK', 'Água escorrendo pelo meio-fio', 'Rua Padre Serafim'],
    ['DEBRIS', 'Restos de obra bloqueando a passagem', 'Rua Benjamin Araújo'],
    ['TREE', 'Galhos baixos avançando sobre a via', 'Avenida Bueno Brandão'],
    ['WASTE', 'Sacos de lixo deixados após a feira', 'Rua da Feira'],
] as const;
const distribution: [number, ReportStatus, number, number?][] = [
    [0, 'SENT', 18],
    [1, 'UNDER_REVIEW', 12],
    [2, 'IN_PROGRESS', 9],
    [3, 'SENT', 7],
    [0, 'UNDER_REVIEW', 6],
    [1, 'SENT', 6],
    [0, 'UNDER_REVIEW', 4],
    [5, 'SENT', 3],
    [0, 'SENT', 2],
    [2, 'RESOLVED', 4],
    [1, 'RESOLVED', 2],
    [3, 'REJECTED', 0],
    [4, 'CANCELED', 1],
    [5, 'RESOLVED', 3],
    [6, 'SENT', 0, 1049],
];
const initialHistory: Record<ReportStatus, ReportStatus[]> = {
    SENT: ['SENT'],
    UNDER_REVIEW: ['SENT', 'UNDER_REVIEW'],
    IN_PROGRESS: ['SENT', 'UNDER_REVIEW', 'IN_PROGRESS'],
    RESOLVED: ['SENT', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED'],
    REJECTED: ['SENT', 'UNDER_REVIEW', 'REJECTED'],
    CANCELED: ['SENT', 'CANCELED'],
};
export type HistoryEntry = { kind: 'status' | 'reply'; text: string };

export function statusEvent(to: ReportStatus, from?: ReportStatus, reason?: string) {
    if (!from) return statusNames[to];
    const reopen = to === 'UNDER_REVIEW' && !pending(from);
    return (reopen ? 'Reaberta: ' : '') + statusNames[from] + ' → ' + statusNames[to] + (reason ? ' — ' + reason : '');
}

export const demoToday = '2026-11-19';
export const records = distribution.map(([index, status, count, assignedProtocol], position) => {
    const [category, description, street] = examples[index]!;
    const address = street + ', ' + (38 + position * 27);
    const days = 8 - Math.min(position, 8);
    const registered = new Date(demoToday + 'T12:00:00Z');
    registered.setUTCDate(registered.getUTCDate() - days);
    const protocol = assignedProtocol ?? 1048 - position;
    const photos = photosForReport(category, protocol);
    const reply = protocol === 1042 ? 'Equipe encaminhada para vistoria.' : protocol === 1038 ? 'Luminária substituída pela equipe.' : undefined;
    const statusTrail = initialHistory[status];
    const events: HistoryEntry[] = statusTrail.map((value, index) => ({ kind: 'status', text: statusEvent(value, statusTrail[index - 1]) }));
    if (reply) events.push({ kind: 'reply', text: reply });
    return { protocol, statusTrail, id: 'MC-' + protocol, category, categoryName: reportCategoryLabels[category]!, categoryIcon: initialSymbols[category]!, description, address, photo: photos[0], photos, status, count, days, registeredDay: registered.toISOString().slice(0, 10), date: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(registered), events, mine: protocol === 1042 || protocol === 1038 };
});
export type DemoRecord = (typeof records)[number];
export const priority = (left: DemoRecord, right: DemoRecord) => Number(pending(right.status)) - Number(pending(left.status)) || right.count - left.count || right.days - left.days || left.id.localeCompare(right.id);
