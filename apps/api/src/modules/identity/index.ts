import type { Database } from '../../database.js';
import { hashPassword, verifyPassword } from './password.js';

export function createIdentity(database: Database) {
    return {
        async provisionDemoAccounts(password: string) {
            if (!password || password.startsWith('replace_with_')) {
                throw new Error('Defina DEMO_PASSWORD antes de executar o seed.');
            }
            const accounts = [
                { cpf: '00000000001', role: 'CITIZEN' },
                { cpf: '00000000002', role: 'CITIZEN' },
                { cpf: '00000000003', role: 'MANAGER' },
            ] as const;
            const hashes = await Promise.all(accounts.map(() => hashPassword(password)));
            await database.$transaction(
                accounts.map((account, index) =>
                    database.user.upsert({
                        where: { cpf: account.cpf },
                        update: {},
                        create: { ...account, password: hashes[index]! },
                    }),
                ),
            );
        },
        async verifyCredentials(cpf: string, password: string) {
            const input = cpf.trim();
            if (!/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(input)) return null;
            const normalizedCpf = input.replace(/[.-]/g, '');
            const user = await database.user.findUnique({
                where: { cpf: normalizedCpf },
            });
            const valid = await verifyPassword(password, user?.password);
            if (!user || !valid) return null;
            return { id: user.id, cpf: user.cpf, role: user.role };
        },
    };
}
