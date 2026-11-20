import { records } from '../../web/src/prototype/demo';
import { cases } from '../src/prototype/fixtures';

it('apresenta os mesmos protocolos, fotos, locais, situações e totais da fila de gestão', () => {
    expect(cases).toHaveLength(records.length);
    for (const row of records) {
        const item = cases.find((candidate) => 'MC-' + candidate.id === row.id);
        expect(item).toMatchObject({ category: row.category, photo: row.photo, photos: row.photos, description: row.description, place: row.address, status: row.status, confirmationCount: row.count });
    }
    expect(
        cases
            .filter((item) => item.mine)
            .map((item) => item.id)
            .sort(),
    ).toEqual([1038, 1042]);
});
