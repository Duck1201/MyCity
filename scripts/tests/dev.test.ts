import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('npm run dev inicia somente API e web e encerra o outro processo se um deles falhar', () => {
    const project = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(project.scripts.dev).toBe('node scripts/dev.mjs');
    const dir = mkdtempSync(join(tmpdir(), 'mycity-dev-processes-'));
    try {
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { 'dev:api': 'node child.cjs api', 'dev:web': 'node child.cjs web', 'dev:mobile': 'node child.cjs mobile' } }));
        writeFileSync(join(dir, '.env'), 'PORT=3087\nDEMO_MANAGER_PASSWORD=private-fixture-only\n');
        writeFileSync(
            join(dir, 'child.cjs'),
            `
            const fs=require('node:fs'), name=process.argv[2];
            fs.writeFileSync(name, JSON.stringify({pid:process.pid,proxy:process.env.MYCITY_API_PROXY,leaked:process.env.DEMO_MANAGER_PASSWORD==='private-fixture-only'}));
            setInterval(()=>{if(name==='web' && ['api','web'].every(n=>fs.existsSync(n)))process.exit(7);},25);
        `,
        );
        const env = { ...process.env };
        delete env.PORT;
        env.MYCITY_API_PROXY = 'http://external.invalid';
        const run = spawnSync(process.execPath, [resolve('scripts/dev.mjs')], { cwd: dir, env, encoding: 'utf8', timeout: 4000 });
        expect(run.error).toBeUndefined();
        expect(run.status).toBe(1);
        expect(existsSync(join(dir, 'mobile'))).toBe(false);
        for (const name of ['api', 'web']) {
            const child = JSON.parse(readFileSync(join(dir, name), 'utf8'));
            expect(child.leaked).toBe(false);
            if (name === 'web') expect(child.proxy).toBe('http://127.0.0.1:3087');
            expect(() => process.kill(child.pid, 0)).toThrow();
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

it('interrompe a inicialização com diagnóstico sem exibir as credenciais de um banco indisponível', () => {
    const project = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(project.scripts.predev).toContain('check-development.mjs');
    const run = spawnSync(process.execPath, ['apps/api/scripts/check-development.mjs'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://no_user:hidden_test_secret@127.0.0.1:1/no_db' } });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('PostgreSQL');
    expect(run.stderr).not.toContain('hidden_test_secret');
});

it.each(['0', '3122', 'invalid'])('detecta WEB_PORT=%s inválida ou igual à PORT antes de acessar o banco', (webPort) => {
    const run = spawnSync(process.execPath, ['apps/api/scripts/check-development.mjs'], { encoding: 'utf8', env: { ...process.env, PORT: '3122', WEB_PORT: webPort, DATABASE_URL: 'postgresql://localhost:1/no_db' } });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('WEB_PORT');
});
