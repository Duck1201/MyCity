import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it.each(['web', 'mobile'])('o comando de desenvolvimento %s recebe as configurações públicas efetivas', (client) => {
    const root = mkdtempSync(join(tmpdir(), 'mycity-dev-client-'));
    try {
        const workspace = join(root, 'apps', client);
        mkdirSync(workspace, { recursive: true });
        symlinkSync(resolve('scripts'), join(root, 'scripts'));
        writeFileSync(join(root, '.env'), 'WEB_PORT=8422\nPORT=3122\nDEMO_MANAGER_PASSWORD=local-fixture\n');
        const program = client === 'web' ? 'vite' : 'expo';
        writeFileSync(join(root, program), '#!/usr/bin/env node\nconsole.log(JSON.stringify({args:process.argv.slice(2), proxy:process.env.MYCITY_API_PROXY, port:process.env.EXPO_PUBLIC_API_PORT, url:process.env.EXPO_PUBLIC_API_URL, secret:process.env.DEMO_MANAGER_PASSWORD}))', { mode: 0o700 });
        copyFileSync('package.json', join(root, 'package.json'));
        copyFileSync('apps/' + client + '/package.json', join(workspace, 'package.json'));
        const env: NodeJS.ProcessEnv = { ...process.env, PATH: root + ':' + process.env.PATH, npm_config_loglevel: 'silent' };
        for (const name of ['PORT', 'WEB_PORT', 'MYCITY_API_PROXY', 'DEMO_MANAGER_PASSWORD', 'EXPO_PUBLIC_API_PORT', 'EXPO_PUBLIC_API_URL']) delete env[name];
        const run = () => {
            const result = spawnSync('npm', ['run', 'dev:' + client, '--', '--example'], { cwd: root, env, encoding: 'utf8' });
            expect(result.status, result.stderr).toBe(0);
            return JSON.parse(result.stdout);
        };
        const first = run();
        expect(first.secret).toBeUndefined();
        if (client === 'web') {
            expect(first.args).toEqual(['--host', 'localhost', '--port', '8422', '--strictPort', '--example']);
            expect(first.proxy).toBe('http://127.0.0.1:3122');
            env.PORT = '3123';
            expect(run().proxy).toBe('http://127.0.0.1:3123');
        } else {
            expect(first.args).toEqual(['start', '--example']);
            expect(first.port).toBe('3122');
            env.EXPO_PUBLIC_API_PORT = '3133';
            env.EXPO_PUBLIC_API_URL = 'http://localhost:3144/api/v1';
            expect(run()).toMatchObject({ port: '3133', url: env.EXPO_PUBLIC_API_URL });
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
