import { spawnSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';

try {
    loadEnvFile('.env');
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://mycity_test:local_test_only@127.0.0.1:55433/mycity_test';
const parsed = new URL(url);
if (parsed.pathname !== '/mycity_test' || !['localhost', '127.0.0.1', 'test-db'].includes(parsed.hostname)) {
    throw new Error('Integração exige banco local dedicado mycity_test.');
}
const env = { ...process.env, DATABASE_URL: url };
for (const args of [
    ['run', 'db:migrate', '-w', '@mycity/api'],
    ['run', 'test:integration', '-w', '@mycity/api'],
]) {
    const result = spawnSync('npm', args, { stdio: 'inherit', env });
    if (result.status !== 0) process.exit(result.status ?? 1);
}
