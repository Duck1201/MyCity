import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { expect, it } from 'vitest';

it('setup cria uma única conexão na configuração do desenvolvimento', () => {
    const template = parseEnv(readFileSync('.env.example', 'utf8'));
    expect(new URL(template.DATABASE_URL!).pathname).toBe('/mycity');
    expect(template).not.toHaveProperty('TEST_DATABASE_URL');
});
it('o runner de integração ignora a .env de desenvolvimento e usa seu próprio alvo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mycity-test-env-'));
    try {
        writeFileSync(join(dir, '.env'), 'DATABASE_URL=postgresql://localhost/mycity\nTEST_DATABASE_URL=postgresql://localhost/mycity\nDEMO_MANAGER_PASSWORD=local-canary\n');
        writeFileSync(join(dir, 'npm'), '#!/bin/sh\nprintf "%s %s\\n" "$DATABASE_URL" "$DEMO_MANAGER_PASSWORD" >> calls\n', { mode: 0o700 });
        const env = { ...process.env, PATH: dir + ':' + process.env.PATH };
        delete env.TEST_DATABASE_URL;
        env.DEMO_MANAGER_PASSWORD = 'exported-canary';
        const run = spawnSync(process.execPath, [resolve('scripts/integration.mjs')], { cwd: dir, env, encoding: 'utf8' });
        expect(run.status).toBe(0);
        expect(existsSync(join(dir, 'calls'))).toBe(true);
        const calls = readFileSync(join(dir, 'calls'), 'utf8').trimEnd().split('\n');
        expect(calls).toHaveLength(2);
        for (const call of calls) {
            expect(call).not.toContain('exported-canary');
            expect(new URL(call.trim()).pathname).toBe('/mycity_test');
            expect(call).not.toContain('local-canary');
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
