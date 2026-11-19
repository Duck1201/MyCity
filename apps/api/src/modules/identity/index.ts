import type { Database } from '../../database.js';
import { hashPassword, verifyPassword } from './password.js';

export function createIdentity(database: Database) {
    return {
        async provisionDemoAccounts(password: string) {
            if (!password || password.startsWith('replace_with_')) {
                throw new Error('Defina DEMO_PASSWORD antes de executar o seed.');
            }
            const accounts = [
                { email: 'cidadao.a@mycity.example', role: 'CITIZEN' },
                { email: 'cidadao.b@mycity.example', role: 'CITIZEN' },
                { email: 'gestor@mycity.example', role: 'MANAGER' },
            ] as const;
            const hashes = await Promise.all(accounts.map(() => hashPassword(password)));
            await database.$transaction(
                accounts.map((account, index) =>
                    database.user.upsert({
                        where: { email: account.email },
                        update: {},
                        create: { ...account, passwordHash: hashes[index]! },
                    }),
                ),
            );
        },
        async verifyCredentials(email: string, password: string) {
            const user = await database.user.findUnique({
                where: { email: email.trim().toLowerCase() },
            });
            const valid = await verifyPassword(password, user?.passwordHash);
            if (!user || !valid) return null;
            return { id: user.id, email: user.email, role: user.role };
        },
    };
}
