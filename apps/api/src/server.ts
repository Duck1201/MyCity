import { createApp } from './app.js';
import { createDatabase } from './database.js';
import { apiListenHost } from './documentation-policy.js';
import { purgeExpiredPhotos } from './modules/reports/index.js';

const database = createDatabase(process.env.DATABASE_URL ?? '');
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
const documentationOptions = { environment: process.env.NODE_ENV ?? 'production', enableDocs: process.env.API_DOCS_ENABLED === 'true' };
const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
const server = createApp(database, { ...documentationOptions, webOrigin: process.env.WEB_ORIGIN ?? `http://localhost:${process.env.WEB_PORT ?? 8090}`, proxyHops: Number(process.env.PROXY_HOPS ?? 0), uploadDir }).listen(port, apiListenHost(documentationOptions), () => {
    console.info(`MyCity API disponível na porta ${port}.`);
});

let cleanup: Promise<unknown> | undefined;
function runCleanup() {
    cleanup ??= purgeExpiredPhotos(database, uploadDir)
        .catch(() => console.error('Falha na limpeza das fotos expiradas.'))
        .finally(() => {
            cleanup = undefined;
        });
}
runCleanup();
const cleanupTimer = setInterval(runCleanup, 60 * 60 * 1000).unref();

let shuttingDown = false;
async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(cleanupTimer);
    server.close(async () => {
        await cleanup;
        await database.$disconnect();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
