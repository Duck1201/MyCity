import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { resetTarget } from '../../apps/api/prisma/reset-target.js';

const secret = 'fixture-password-never-print';

function reset(databaseUrl: string, extra: Record<string, string> = {}) {
    return spawnSync('npm', ['run', 'db:reset'], {
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: databaseUrl, ...extra },
    });
}

it.each(['postgresql://user:' + secret + '@example.org/mycity', 'postgresql://user:' + secret + '@localhost/mycity_test', 'postgresql://user:' + secret + '@localhost/mycity?schema=work', 'postgresql://user:' + secret + '@localhost/mycity?host=example.org'])('recusa destino fora do banco de desenvolvimento antes de conectar (caso %#)', (databaseUrl) => {
    const result = reset(databaseUrl);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('O reset exige o banco local mycity');
    expect(result.stderr + result.stdout).not.toContain(secret);
});

it('recusa o reset em ambiente de produção, inclusive com endereço de loopback', () => {
    const result = reset('postgresql://user:' + secret + '@127.0.0.1:1/mycity', { NODE_ENV: 'production' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('O reset exige o banco local mycity');
    expect(result.stderr + result.stdout).not.toContain(secret);
});

it('tenta conectar ao alvo local mesmo sem terminal interativo', () => {
    const result = reset('postgresql://user:' + secret + '@127.0.0.1:1/mycity');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ECONNREFUSED');
    expect(result.stdout).toContain('127.0.0.1:1/mycity');
    expect(result.stderr + result.stdout).not.toContain(secret);
});

it('mantém o reset separado dos comandos de inicialização e do seed', () => {
    const root = JSON.parse(readFileSync('package.json', 'utf8'));
    const api = JSON.parse(readFileSync('apps/api/package.json', 'utf8'));
    expect(root.scripts['db:reset']).toBe('npm run db:reset -w @mycity/api');
    for (const name of ['predev', 'dev', 'db:seed']) expect(root.scripts[name]).not.toContain('reset');
    expect(api.scripts['db:seed']).not.toContain('reset');
});

it('fixa a mesma porta do alvo para inventário e migrações mesmo quando a URL omite a porta', () => {
    expect(resetTarget('postgresql://localhost/mycity').port).toBe('5432');
    expect(resetTarget('postgresql://localhost:55432/mycity').port).toBe('55432');
});
