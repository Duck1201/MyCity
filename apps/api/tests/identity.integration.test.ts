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
            cpf: {
                in: ['00000000001', '00000000002', '00000000003'],
            },
        },
    });
});
afterAll(() => database.$disconnect());

describe('provisionamento das contas de demonstração', () => {
    it('cria dois cidadãos e um gestor autenticáveis sem expor hash', async () => {
        await identity.provisionDemoAccounts(initialPassword);
        for (const [cpf, role] of [
            ['00000000001', 'CITIZEN'],
            ['00000000002', 'CITIZEN'],
            ['00000000003', 'MANAGER'],
        ]) {
            const user = await identity.verifyCredentials(cpf!, initialPassword);
            expect(user).toEqual({ id: expect.any(String), cpf, role });
        }
    });

    it('reexecutar seed preserva identidade e senha existente', async () => {
        const before = await identity.verifyCredentials('00000000003', initialPassword);
        await identity.provisionDemoAccounts('different-test-password-2026');
        expect(await identity.verifyCredentials('00000000003', initialPassword)).toEqual(before);
        expect(await identity.verifyCredentials('00000000003', 'different-test-password-2026')).toBeNull();
    });

    it('credencial errada e conta inexistente não autenticam', async () => {
        expect(await identity.verifyCredentials('00000000003', 'wrong-password')).toBeNull();
        expect(await identity.verifyCredentials('00000000099', initialPassword)).toBeNull();
    });

    it('aceita CPF formatado e rejeita login por e-mail', async () => {
        const user = await identity.verifyCredentials('000.000.000-03', initialPassword);
        expect(user?.cpf).toBe('00000000003');
        expect(await identity.verifyCredentials('gestor@mycity.example', initialPassword)).toBeNull();
    });
    it.each(['123', 'abcdefghijk', '000000000003', '000.000.00003'])('recusa identificador malformado: %s', async (cpf) => {
        expect(await identity.verifyCredentials(cpf, initialPassword)).toBeNull();
    });
});
