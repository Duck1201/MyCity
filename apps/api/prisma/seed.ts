import { config } from 'dotenv';
import { createDatabase } from '../src/database.js';
import { createIdentity } from '../src/modules/identity/index.js';

config({
    path: new URL('../../../.env', import.meta.url).pathname,
    quiet: true,
});
const database = createDatabase(process.env.DATABASE_URL ?? '');
try {
    await createIdentity(database).provisionDemoAccounts(process.env.DEMO_PASSWORD ?? '');
    console.info('Contas de demonstração preparadas; contas existentes preservadas.');
} finally {
    await database.$disconnect();
}
