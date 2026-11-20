import pg from 'pg';
import { provisionDemoReports } from './demo-reports.js';
import { provisionDemoProfiles } from './profiles.js';
import { config } from 'dotenv';
import { createDatabase } from '../src/database.js';
import { createIdentity, DemoPasswordError } from '../src/modules/identity/index.js';

config({
    path: new URL('../../../.env', import.meta.url).pathname,
    quiet: true,
});
const connectionString = process.env.DATABASE_URL ?? '';
const action = process.argv.slice(2).join(' ');
const target = URL.canParse(connectionString) ? new URL(connectionString) : null;
const localDevelopment = !!target && process.env.NODE_ENV !== 'production' && ['postgres:', 'postgresql:'].includes(target.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) && ['/mycity', '/mycity_test'].includes(target.pathname) && ['', '?schema=public'].includes(target.search) && !target.hash;
if (action === '--sync-development-passwords' && !localDevelopment) {
    console.info('Este destino exige rotação explícita das senhas de demonstração.');
    process.exit(0);
}
const database = createDatabase(connectionString);
const lock = new pg.Client({ connectionString, connectionTimeoutMillis: 2000 });
try {
    // Serialize all provisioning commands, including filesystem updates.
    await lock.connect();
    await lock.query("SELECT pg_advisory_lock(hashtext('mycity-demo-provision'))");
    const identity = createIdentity(database);
    const passwords = {
        citizenA: process.env.DEMO_CITIZEN_A_PASSWORD ?? '',
        citizenB: process.env.DEMO_CITIZEN_B_PASSWORD ?? '',
        manager: process.env.DEMO_MANAGER_PASSWORD ?? '',
    };
    if (action === '--sync-development-passwords') {
        const missing = await identity.syncDevelopmentPasswords(passwords);
        if (missing) console.info('Existem contas de demonstração ausentes. Para provisioná-las, execute npm run db:seed.');
    } else if (action === '--sync-deployment-passwords') {
        await identity.syncDeploymentPasswords(passwords);
    } else if (action === '--rotate-passwords') {
        await identity.rotateDemoPasswords(passwords);
        await provisionDemoProfiles(database);
        console.info('Senhas das três contas de demonstração atualizadas.');
    } else if (process.argv.length === 2) {
        await identity.provisionDemoAccounts(passwords, { localDevelopment });
        const accounts = await provisionDemoProfiles(database);
        const created = await provisionDemoReports(database, process.env.UPLOAD_DIR ?? './uploads', accounts);
        console.info(`Seed concluído. Contas e perfis preparados; novas denúncias de exemplo: ${created}.`);
    } else {
        throw new Error('Argumentos de provisionamento inválidos.');
    }
} catch (error) {
    if (action !== '--sync-development-passwords') throw error;
    console.error(error instanceof DemoPasswordError ? error.message : 'Falha ao sincronizar as senhas de demonstração. Confira a conexão e as migrações do banco de desenvolvimento.');
    process.exitCode = 1;
} finally {
    await Promise.all([database.$disconnect(), lock.end()]);
}
