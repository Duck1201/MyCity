import { expect, it } from 'vitest';
import { managementQueueSchema, queueExportSchema, reportMetadataSchema } from '../src/index.js';

const valid = { clientRequestId: 'request-1', category: 'POTHOLE', location: { latitude: 0, longitude: 0, source: 'MANUAL' }, description: ' Rua principal ', showIdentity: false };
it('normaliza descrição e exige consentimento explícito, categoria válida e texto útil', () => {
    expect(reportMetadataSchema.parse(valid)).toEqual({ ...valid, description: 'Rua principal' });
    for (const invalid of [{ description: ' ' }, { description: 'x'.repeat(1001) }, { category: 'OTHER' }, { showIdentity: undefined }, { showIdentity: 'false' }, { clientRequestId: '' }, { authorId: 'untrusted' }]) {
        expect(reportMetadataSchema.safeParse({ ...valid, ...invalid }).success).toBe(false);
    }
});

it('recusa datas e termos que não podem ser consultados no PostgreSQL', () => {
    for (const query of [{ de: '0000-01-01' }, { q: 'poste\u0000' }, { category: 'grupo\u0000' }]) {
        expect(managementQueueSchema.safeParse(query).success).toBe(false);
        expect(queueExportSchema.safeParse(query).success).toBe(false);
    }
});
