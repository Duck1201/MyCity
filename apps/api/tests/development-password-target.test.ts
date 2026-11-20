import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it.each([
    ['postgresql://example.invalid/mycity', 'development'],
    ['postgresql://127.0.0.1:1/other', 'development'],
    ['postgresql://localhost:1/mycity?host=example.invalid', 'development'],
    ['postgresql://localhost:1/mycity', 'production'],
])('exige rotação explícita fora da base local de desenvolvimento (%#)', (url, environment) => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts', '--sync-development-passwords'], {
        cwd: new URL('../', import.meta.url),
        env: { ...process.env, DATABASE_URL: url, NODE_ENV: environment },
        encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('rotação explícita');
    expect(result.stdout + result.stderr).not.toContain(url);
});
