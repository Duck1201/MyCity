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

it.each(['example.invalid:55432/mycity', '127.0.0.1:55433/mycity_test'])('setup:local recusa o destino %s sem exibir a senha', (target) => {
    const run = spawnSync('npm', ['run', 'setup:local'], {
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: 'postgresql://mycity:private-fixture@' + target },
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('banco local mycity do Docker Compose');
    expect(run.stderr).not.toContain('private-fixture');
    expect(run.stdout).not.toContain('Preparando o ambiente local');
    expect(run.stdout).not.toContain('Aplicando migrações');
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
