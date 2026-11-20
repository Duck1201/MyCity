import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export function readDevelopmentEnv(path) {
    try {
        return parseEnv(readFileSync(path, 'utf8'));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return {};
    }
}

export function readPort(value, name) {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Escolha uma ${name} válida entre 1 e 65535.`);
    return port;
}

export function developmentPorts(local = {}) {
    const apiPort = readPort(process.env.PORT ?? local.PORT ?? 3000, 'PORT');
    const webPort = readPort(process.env.WEB_PORT ?? local.WEB_PORT ?? 8090, 'WEB_PORT');
    if (apiPort === webPort) throw new Error('Escolha valores diferentes para PORT (API) e WEB_PORT (painel).');
    return { apiPort, webPort, proxy: `http://127.0.0.1:${apiPort}` };
}
