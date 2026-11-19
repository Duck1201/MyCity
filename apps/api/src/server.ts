import { createApp } from './app.js';
import { createDatabase } from './database.js';

const database = createDatabase(process.env.DATABASE_URL ?? '');
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
const server = createApp(database).listen(port, '0.0.0.0', () => {
    console.info(`MyCity API disponível na porta ${port}.`);
});

let shuttingDown = false;
async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(async () => {
        await database.$disconnect();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
