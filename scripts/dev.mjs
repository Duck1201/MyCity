import { developmentPorts, readDevelopmentEnv } from './development-ports.mjs';
import concurrently from 'concurrently';

// Forward only public connection settings from the root .env to client tooling.
const { apiPort, webPort, proxy } = developmentPorts(readDevelopmentEnv('.env'));
console.info(`MyCity em desenvolvimento · Painel http://localhost:${webPort} · API http://localhost:${apiPort}`);
const { result } = concurrently(
    [
        { name: 'API', command: 'npm run dev:api' },
        { name: 'WEB', command: 'npm run dev:web', env: { MYCITY_API_PROXY: proxy } },
    ],
    { killOthersOn: ['success', 'failure'], killTimeout: 3000, successCondition: 'first', prefix: 'name' },
);
try {
    await result;
} catch {
    process.exitCode = 1;
}
