import { readFile } from 'node:fs/promises';
import type { Database } from '../src/database.js';

const accounts = [
    { key: 'citizenA', cpf: '00000000001', name: 'Marina Lopes', file: 'citizen-a.jpg' },
    { key: 'citizenB', cpf: '00000000002', name: 'André Costa', file: 'citizen-b.jpg' },
    { key: 'manager', cpf: '00000000003', name: 'Helena Duarte', file: 'manager.jpg' },
] as const;
export async function provisionDemoProfiles(db: Database) {
    const profiles = await Promise.all(
        accounts.map(async ({ key, cpf, name, file }) => {
            const photo = await readFile(new URL('./profiles/' + file, import.meta.url));
            return { key, cpf, name, photoUrl: 'data:image/jpeg;base64,' + photo.toString('base64') };
        }),
    );
    return db.$transaction(async (tx) => {
        const ids = { citizenA: '', citizenB: '', manager: '' };
        for (const { key, cpf, name, photoUrl } of profiles) {
            const user = await tx.user.findUniqueOrThrow({ where: { cpf }, select: { id: true } });
            ids[key] = user.id;
            await tx.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, name, photoUrl }, update: {} });
        }
        return ids;
    });
}
