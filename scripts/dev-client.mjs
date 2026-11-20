import { spawnSync } from 'node:child_process';
import { developmentPorts, readDevelopmentEnv, readPort } from './development-ports.mjs';

const [client, ...args] = process.argv.slice(2);
try {
    const local = readDevelopmentEnv('../../.env');
    const { apiPort, webPort, proxy } = developmentPorts(local);
    const env = { ...process.env };
    // Only the API process needs database credentials and demo passwords.
    for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'POSTGRES_PASSWORD', 'DEMO_PASSWORD', 'DEMO_MANAGER_PASSWORD', 'DEMO_CITIZEN_A_PASSWORD', 'DEMO_CITIZEN_B_PASSWORD']) delete env[key];
    let command;
    if (client === 'web') {
        env.MYCITY_API_PROXY ??= proxy;
        command = ['vite', '--host', 'localhost', '--port', String(webPort), '--strictPort'];
    } else if (client === 'mobile') {
        env.EXPO_PUBLIC_API_PORT = String(readPort(env.EXPO_PUBLIC_API_PORT ?? local.EXPO_PUBLIC_API_PORT ?? apiPort, 'EXPO_PUBLIC_API_PORT'));
        const url = env.EXPO_PUBLIC_API_URL ?? local.EXPO_PUBLIC_API_URL;
        if (url !== undefined) env.EXPO_PUBLIC_API_URL = url;
        command = ['expo', 'start'];
    } else {
        throw new Error('Cliente de desenvolvimento desconhecido.');
    }
    const [program, ...options] = command;
    const result = spawnSync(program, [...options, ...args], { stdio: 'inherit', env });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? (result.signal === 'SIGINT' ? 130 : 1);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
