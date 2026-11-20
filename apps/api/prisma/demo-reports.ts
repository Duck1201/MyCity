import { readFile } from 'node:fs/promises';
import { reportCategoryLabels, type ReportStatus } from '@mycity/contracts';
import type { Database } from '../src/database.js';
import { categoryNameKey, provisionReportExample } from '../src/modules/reports/index.js';

type Actors = { citizenA: string; citizenB: string; manager: string };
type DemoCase = {
    category: string;
    description: string;
    point: [number, number];
    author: 'citizenA' | 'citizenB';
    transitions: ReportStatus[];
    confirmed?: boolean;
    anonymous?: boolean;
    reason?: string;
    reply?: string;
};

const cases: DemoCase[] = [
    { category: 'POTHOLE', description: 'Buraco junto à faixa de pedestres na esquina.', point: [-20.7528, -42.8814], author: 'citizenA', confirmed: true, transitions: ['UNDER_REVIEW'], reply: 'A equipe recebeu a solicitação de vistoria do pavimento.' },
    { category: 'LIGHTING', description: 'Luminária apagada na travessia da praça.', point: [-20.7537, -42.8817], author: 'citizenB', confirmed: true, transitions: [] },
    { category: 'DEBRIS', description: 'Entulho ocupa parte da passagem na calçada.', point: [-20.7552, -42.877], author: 'citizenA', anonymous: true, transitions: ['UNDER_REVIEW', 'IN_PROGRESS'] },
    { category: 'WASTE', description: 'Sacos de lixo acumulados no ponto de coleta.', point: [-20.7504, -42.8792], author: 'citizenB', transitions: ['UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED'] },
    { category: 'LEAK', description: 'Água escorrendo pela sarjeta perto da esquina.', point: [-20.7546, -42.8831], author: 'citizenA', transitions: ['UNDER_REVIEW', 'REJECTED'], reason: 'A vistoria identificou outra ocorrência aberta para o mesmo ponto.' },
    { category: 'TREE', description: 'Galhos baixos sobre a passagem de pedestres.', point: [-20.7513, -42.8789], author: 'citizenB', transitions: ['CANCELED'] },
];

export async function provisionDemoReports(db: Database, directory: string, actors: Actors) {
    const defaults = Object.entries(reportCategoryLabels).map(([id, name], position) => ({ id, name, nameKey: categoryNameKey(name), position }));
    // Preserve customized labels; a conflicting existing name must not be silently reassigned.
    await db.reportCategoryDefinition.createMany({ data: defaults, skipDuplicates: true });
    if ((await db.reportCategoryDefinition.count({ where: { id: { in: defaults.map((c) => c.id) } } })) !== defaults.length) {
        throw new Error('Uma categoria inicial ausente tem o mesmo nome de um grupo existente. Confira o catálogo antes de executar o seed.');
    }
    let created = 0;
    for (const item of cases) {
        const key = item.category.toLowerCase();
        const authorId = actors[item.author];
        const clientRequestId = 'mycity-demo-v1-' + key;
        // Seeding fills missing examples; previously published reports own their photos and history.
        const existing = await db.report.findUnique({
            where: { authorId_clientRequestId: { authorId, clientRequestId }, category: item.category, description: item.description },
            select: { id: true },
        });
        if (existing) continue;
        const photo = await readFile(new URL('./report-images/' + key + '.jpg', import.meta.url));
        const result = await provisionReportExample(db, directory, {
            authorId,
            managerId: actors.manager,
            ...(item.confirmed && { confirmerId: item.author === 'citizenA' ? actors.citizenB : actors.citizenA }),
            metadata: { category: item.category, clientRequestId, description: item.description, showIdentity: !item.anonymous, location: { latitude: item.point[0], longitude: item.point[1], source: 'MANUAL' } },
            photos: [photo],
            transitions: item.transitions,
            ...(item.reason && { reason: item.reason }),
            ...(item.reply && { reply: item.reply }),
        });
        if (result.status === 201) created++;
    }
    return created;
}
