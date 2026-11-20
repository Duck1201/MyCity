import type { ReportMetadata, ReportStatus } from '@mycity/contracts';
import type { Database } from '../../database.js';
import { prepareReportInput } from './upload.js';
import { createReportStore } from './store.js';
import { publishReply, setConfirmation, transitionReport } from './service.js';

type Example = {
    authorId: string;
    confirmerId?: string;
    managerId: string;
    metadata: ReportMetadata;
    photos: Buffer[];
    transitions: ReportStatus[];
    reason?: string;
    reply?: string;
};

export async function provisionReportExample(db: Database, directory: string, example: Example) {
    const input = await prepareReportInput(example.metadata, example.photos);
    return createReportStore(db, directory).publish(example.authorId, input, async (tx, reportId) => {
        if (example.confirmerId) await setConfirmation(tx, reportId, example.confirmerId, true);
        let expectedVersion = 1;
        for (const targetStatus of example.transitions) {
            const actor = targetStatus === 'CANCELED' ? { id: example.authorId, role: 'CITIZEN' as const } : { id: example.managerId, role: 'MANAGER' as const };
            await transitionReport(tx, reportId, actor, { targetStatus, expectedVersion, ...(targetStatus === 'REJECTED' && example.reason && { reason: example.reason }) });
            expectedVersion++;
        }
        if (example.reply) await publishReply(tx, reportId, example.managerId, { text: example.reply, clientRequestId: example.metadata.clientRequestId + '-reply' });
    });
}
