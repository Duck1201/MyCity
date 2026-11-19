import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../src/database.js';
import { createIdentity } from '../src/modules/identity/index.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', '127.0.0.1', 'test-db'].includes(url.hostname)) {
    throw new Error('Este teste exige o banco local isolado mycity_test.');
}
const database = createDatabase(url.toString());
const identity = createIdentity(database);
const initialPassword = 'first-test-password-2026';

beforeAll(async () => {
    await database.user.deleteMany({
        where: {
            email: {
                in: ['cidadao.a@mycity.example', 'cidadao.b@mycity.example', 'gestor@mycity.example'],
            },
        },
    });
});
afterAll(() => database.$disconnect());

describe('provisionamento das contas de demonstração', () => {
    it('cria dois cidadãos e um gestor autenticáveis sem expor hash', async () => {
        await identity.provisionDemoAccounts(initialPassword);
        for (const [email, role] of [
            ['cidadao.a@mycity.example', 'CITIZEN'],
            ['cidadao.b@mycity.example', 'CITIZEN'],
            ['gestor@mycity.example', 'MANAGER'],
        ]) {
            const user = await identity.verifyCredentials(email!, initialPassword);
            expect(user).toEqual({ id: expect.any(String), email, role });
        }
    });

    it('reexecutar seed preserva identidade e senha existente', async () => {
        const before = await identity.verifyCredentials('gestor@mycity.example', initialPassword);
        await identity.provisionDemoAccounts('different-test-password-2026');
        expect(await identity.verifyCredentials('gestor@mycity.example', initialPassword)).toEqual(before);
        expect(await identity.verifyCredentials('gestor@mycity.example', 'different-test-password-2026')).toBeNull();
    });

    it('credencial errada e conta inexistente não autenticam', async () => {
        expect(await identity.verifyCredentials('gestor@mycity.example', 'wrong-password')).toBeNull();
        expect(await identity.verifyCredentials('unknown@mycity.example', initialPassword)).toBeNull();
    });
});
