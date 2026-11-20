import { createHash } from 'node:crypto';
import type { Database } from '../../database.js';
import { hashPassword, verifyPassword } from './password.js';

export class DemoPasswordError extends Error {}

type DemoPasswords = { citizenA: string; citizenB: string; manager: string };

function demoAccounts(passwords: DemoPasswords, localDevelopment: boolean) {
    const accounts = [
        { cpf: '00000000001', role: 'CITIZEN', secret: passwords.citizenA },
        { cpf: '00000000002', role: 'CITIZEN', secret: passwords.citizenB },
        { cpf: '00000000003', role: 'MANAGER', secret: passwords.manager },
    ] as const;
    const secrets = accounts.map((account) => account.secret);
    if (secrets.some((secret) => !secret?.trim() || secret.trim().startsWith('replace_with_')) || (!localDevelopment && new Set(secrets).size !== accounts.length)) {
        throw new DemoPasswordError(localDevelopment ? 'Preencha as três senhas de demonstração com valores próprios.' : 'Configure três senhas de demonstração distintas antes de continuar.');
    }
    return accounts;
}

export const credentialHash = (encoded: string) => createHash('sha256').update(encoded).digest('hex');

export function createIdentity(database: Database) {
    async function writeDemoAccounts(passwords: DemoPasswords, mode: 'seed' | 'rotate' | 'sync', localDevelopment = false) {
        const accounts = demoAccounts(passwords, localDevelopment);
        return database.$transaction(
            async (tx) => {
                const existing = await tx.user.findMany({
                    where: { cpf: { in: accounts.map(({ cpf }) => cpf) } },
                    select: { cpf: true, password: true, loginEnabled: true },
                });
                if (mode === 'rotate' && existing.length !== accounts.length) {
                    throw new DemoPasswordError('A rotação exige as três contas já provisionadas.');
                }
                for (const { cpf, role, secret } of accounts) {
                    const current = existing.find((user) => user.cpf === cpf);
                    if (mode === 'seed' && current) continue;
                    if (mode === 'sync' && (!current?.loginEnabled || (await verifyPassword(secret, current.password)))) continue;
                    for (const user of existing) {
                        if (user.cpf === cpf) continue;
                        if (localDevelopment && accounts.some((other) => other.cpf === user.cpf && other.secret === secret)) continue;
                        if (await verifyPassword(secret, user.password)) {
                            throw new DemoPasswordError('Uma das senhas configuradas já pertence a outra conta de demonstração.');
                        }
                    }
                    const password = await hashPassword(secret);
                    if (mode === 'seed') {
                        await tx.user.create({ data: { cpf, role, password, loginEnabled: true }, select: { id: true } });
                    } else {
                        const user = await tx.user.update({ where: { cpf }, data: { password, loginEnabled: true }, select: { id: true } });
                        await tx.session.deleteMany({ where: { userId: user.id } });
                    }
                }
                return accounts.length - existing.length;
            },
            { isolationLevel: 'Serializable' },
        );
    }

    async function verifiedUser(cpf: string, password: string) {
        const input = cpf.trim();
        if (!/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(input)) return null;
        const normalizedCpf = input.replace(/[.-]/g, '');
        const user = await database.user.findUnique({
            where: { cpf: normalizedCpf },
        });
        const valid = await verifyPassword(password, user?.password);
        if (!user?.loginEnabled || !valid) return null;
        return user;
    }

    return {
        syncDevelopmentPasswords(passwords: DemoPasswords) {
            return writeDemoAccounts(passwords, 'sync', true);
        },
        async provisionDemoAccounts(passwords: DemoPasswords, { localDevelopment = false } = {}) {
            await writeDemoAccounts(passwords, 'seed', localDevelopment);
        },
        async rotateDemoPasswords(passwords: DemoPasswords) {
            await writeDemoAccounts(passwords, 'rotate');
        },
        async verifyCredentials(cpf: string, password: string) {
            const user = await verifiedUser(cpf, password);
            return user ? { id: user.id, cpf: user.cpf, role: user.role } : null;
        },
        async issueSession(cpf: string, password: string, session: { tokenHash: string; expiresAt: Date; transport: 'cookie' | 'bearer' }) {
            const user = await verifiedUser(cpf, password);
            if (!user) return null;
            return database.$transaction(async (tx) => {
                const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE id = ${user.id} AND password = ${user.password} AND login_enabled FOR SHARE`;
                if (!locked.length) return null;
                await tx.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
                await tx.session.create({ data: { ...session, userId: user.id, credentialHash: credentialHash(user.password) } });
                return { id: user.id, role: user.role };
            });
        },
    };
}

export { readPublicProfiles } from './profiles.js';
