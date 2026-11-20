import { spawnSync } from 'node:child_process';
import { createServer, type AddressInfo } from 'node:net';
import { once } from 'node:events';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../src/database.js';
import { createIdentity } from '../src/modules/identity/index.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', '127.0.0.1', 'test-db'].includes(url.hostname)) {
    throw new Error('Este teste exige o banco local isolado mycity_test.');
}
const database = createDatabase(url.toString());
const identity = createIdentity(database);
const passwords = { citizenA: 'first-test-password', citizenB: 'second-test-password', manager: 'manager-test-password' };
const replacements = { citizenA: 'new-first-test', citizenB: 'new-second-test', manager: 'new-manager-test' };

beforeEach(async () => {
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
    it('recusa o provisionamento legado com senha compartilhada', async () => {
        // @ts-expect-error A chamada antiga também precisa falhar em runtime.
        await expect(identity.provisionDemoAccounts(passwords.manager)).rejects.toThrow();
    });

    it('cria dois cidadãos e um gestor autenticáveis sem expor hash', async () => {
        await identity.provisionDemoAccounts(passwords);
        for (const [cpf, role, password] of [
            ['00000000001', 'CITIZEN', passwords.citizenA],
            ['00000000002', 'CITIZEN', passwords.citizenB],
            ['00000000003', 'MANAGER', passwords.manager],
        ]) {
            const user = await identity.verifyCredentials(cpf!, password!);
            expect(user).toEqual({ id: expect.any(String), cpf, role });
            for (const other of Object.values(passwords).filter((value) => value !== password)) {
                expect(await identity.verifyCredentials(cpf!, other)).toBeNull();
            }
        }
    });

    it.each(['', '   ', 'replace_with_random_password', passwords.manager])('rejeita configuração incompleta, de exemplo ou repetida (%#) antes de gravar', async (citizenA) => {
        await expect(identity.provisionDemoAccounts({ ...passwords, citizenA })).rejects.toThrow();
        expect(await database.user.count({ where: { cpf: { in: ['00000000001', '00000000002', '00000000003'] } } })).toBe(0);
    });

    it('reexecutar seed preserva identidade e senha existente', async () => {
        await identity.provisionDemoAccounts(passwords);
        const before = await identity.verifyCredentials('00000000003', passwords.manager);
        await identity.provisionDemoAccounts(replacements);
        expect(await identity.verifyCredentials('00000000003', passwords.manager)).toEqual(before);
        expect(await identity.verifyCredentials('00000000003', replacements.manager)).toBeNull();
    });

    it('ao iniciar o desenvolvimento, somente a senha alterada e suas sessões são substituídas', async () => {
        await identity.provisionDemoAccounts(passwords);
        const app = createApp(database);
        const login = (cpf: string, password: string) => request(app).post('/api/v1/sessions').send({ cpf, password, transport: 'bearer' });
        const me = (token: string) =>
            request(app)
                .get('/api/v1/me')
                .set('Authorization', 'Bearer ' + token);
        const manager = await login('00000000003', passwords.manager).expect(201);
        const citizen = await login('00000000001', passwords.citizenA).expect(201);
        const configured = { ...passwords, manager: replacements.manager };
        const probe = createServer().listen(0, '127.0.0.1');
        await once(probe, 'listening');
        const port = (probe.address() as AddressInfo).port;
        probe.close();
        await once(probe, 'close');
        const startup = spawnSync('npm', ['run', 'predev'], {
            cwd: new URL('../', import.meta.url),
            env: { ...process.env, PORT: String(port), WEB_PORT: '8090', DEMO_CITIZEN_A_PASSWORD: passwords.citizenA, DEMO_CITIZEN_B_PASSWORD: passwords.citizenB, DEMO_MANAGER_PASSWORD: configured.manager },
            encoding: 'utf8',
        });
        expect(startup.status, startup.stderr).toBe(0);
        await login('00000000003', passwords.manager).expect(401);
        const current = await login('00000000003', configured.manager).expect(201);
        await me(manager.body.data.token).expect(401);
        await me(citizen.body.data.token).expect(200);
        await identity.syncDevelopmentPasswords(configured);
        await me(current.body.data.token).expect(200);
    });

    it('aceita a mesma senha configurada para os três CPFs no desenvolvimento local', async () => {
        await identity.provisionDemoAccounts(passwords);
        const shared = { citizenA: passwords.citizenA, citizenB: passwords.citizenA, manager: passwords.citizenA };
        await identity.syncDevelopmentPasswords(shared);
        for (const cpf of ['00000000001', '00000000002', '00000000003']) {
            expect(await identity.verifyCredentials(cpf, shared.manager)).toMatchObject({ cpf, role: cpf.endsWith('3') ? 'MANAGER' : 'CITIZEN' });
        }
    });

    it('provisiona as três contas com a mesma senha quando o seed é local', async () => {
        const shared = { citizenA: passwords.manager, citizenB: passwords.manager, manager: passwords.manager };
        await identity.provisionDemoAccounts(shared, { localDevelopment: true });
        for (const cpf of ['00000000001', '00000000002', '00000000003']) {
            expect(await identity.verifyCredentials(cpf, shared.manager)).toMatchObject({ cpf });
        }
    });

    it('sincronização respeita contas ausentes e desabilitadas', async () => {
        expect(await identity.syncDevelopmentPasswords(passwords)).toBe(3);
        await identity.provisionDemoAccounts(passwords);
        await database.user.delete({ where: { cpf: '00000000003' } });
        const legacy = await database.user.update({ where: { cpf: '00000000002' }, data: { loginEnabled: false } });
        expect(await identity.syncDevelopmentPasswords(replacements)).toBe(1);
        expect(await identity.verifyCredentials('00000000001', replacements.citizenA)).toBeTruthy();
        expect(await database.user.findUnique({ where: { cpf: legacy.cpf } })).toEqual(legacy);
        expect(await database.user.findUnique({ where: { cpf: '00000000003' } })).toBeNull();
    });

    it('rejeita configuração inválida sem alterar as demais credenciais', async () => {
        await identity.provisionDemoAccounts(passwords);
        await expect(identity.syncDevelopmentPasswords({ ...replacements, manager: passwords.citizenB })).rejects.toThrow('outra conta');
        await expect(identity.syncDevelopmentPasswords({ ...replacements, manager: '' })).rejects.toThrow('Preencha');
        expect(await identity.verifyCredentials('00000000001', passwords.citizenA)).toBeTruthy();
    });

    it('rotação explícita substitui a senha legada preservando as três identidades', async () => {
        await identity.provisionDemoAccounts(passwords);
        const manager = await database.user.findUniqueOrThrow({ where: { cpf: '00000000003' } });
        const cpfs = ['00000000001', '00000000002', '00000000003'];
        await database.user.updateMany({ where: { cpf: { in: cpfs } }, data: { password: manager.password } });
        const before = await Promise.all(cpfs.map((cpf) => identity.verifyCredentials(cpf, passwords.manager)));
        expect(before.every(Boolean)).toBe(true);
        await identity.rotateDemoPasswords(replacements);
        for (const [index, password] of [replacements.citizenA, replacements.citizenB, replacements.manager].entries()) {
            expect(await identity.verifyCredentials(cpfs[index]!, password)).toEqual(before[index]);
            expect(await identity.verifyCredentials(cpfs[index]!, passwords.manager)).toBeNull();
        }
    });

    it('impede reutilizar na rotação uma senha já conhecida por outra conta', async () => {
        await identity.provisionDemoAccounts(passwords);
        await expect(identity.rotateDemoPasswords({ ...replacements, manager: passwords.citizenB })).rejects.toThrow();
        expect(await identity.verifyCredentials('00000000003', passwords.manager)).toBeTruthy();
    });

    it('seed parcial impede criar o gestor com uma senha preservada de cidadão', async () => {
        await identity.provisionDemoAccounts(passwords);
        await database.user.delete({ where: { cpf: '00000000003' } });
        await expect(identity.provisionDemoAccounts({ ...replacements, manager: passwords.citizenA })).rejects.toThrow();
        expect(await identity.verifyCredentials('00000000003', passwords.citizenA)).toBeNull();
    });

    it('rotação em base incompleta preserva senhas e não cria a conta ausente', async () => {
        await identity.provisionDemoAccounts(passwords);
        await database.user.delete({ where: { cpf: '00000000003' } });
        await expect(identity.rotateDemoPasswords(replacements)).rejects.toThrow();
        expect(await identity.verifyCredentials('00000000001', passwords.citizenA)).toBeTruthy();
        expect(await identity.verifyCredentials('00000000002', passwords.citizenB)).toBeTruthy();
        expect(await identity.verifyCredentials('00000000003', replacements.manager)).toBeNull();
    });

    it('credencial errada e conta inexistente não autenticam', async () => {
        await identity.provisionDemoAccounts(passwords);
        expect(await identity.verifyCredentials('00000000003', 'wrong-password')).toBeNull();
        expect(await identity.verifyCredentials('00000000099', passwords.manager)).toBeNull();
    });

    it('aceita CPF formatado e rejeita login por e-mail', async () => {
        await identity.provisionDemoAccounts(passwords);
        const user = await identity.verifyCredentials('000.000.000-03', passwords.manager);
        expect(user?.cpf).toBe('00000000003');
        expect(await identity.verifyCredentials('gestor@mycity.example', passwords.manager)).toBeNull();
    });
    it.each(['123', 'abcdefghijk', '000000000003', '000.000.00003'])('recusa identificador malformado: %s', async (cpf) => {
        await identity.provisionDemoAccounts(passwords);
        expect(await identity.verifyCredentials(cpf, passwords.manager)).toBeNull();
    });
});
