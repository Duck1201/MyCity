import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const file = '.env.production.local';
const attributes = lstatSync(file);
if (!attributes.isFile() || (attributes.mode & 0o777) !== 0o600 || spawnSync('git', ['check-ignore', '-q', '--', file]).status !== 0) {
    throw new Error('O arquivo de produção deve estar ignorado pelo Git e ter permissão 0600.');
}
const values = parseEnv(readFileSync(file, 'utf8'));
const selected = ['POSTGRES_PASSWORD', 'API_DATABASE_PASSWORD', 'DEMO_CITIZEN_A_PASSWORD', 'DEMO_CITIZEN_B_PASSWORD', 'DEMO_MANAGER_PASSWORD', 'WEB_ORIGIN'];
const payload = JSON.stringify(Object.fromEntries(selected.map((name) => [name, values[name]])));
const validator = fileURLToPath(new URL('./deployment-env.py', import.meta.url));
const checked = spawnSync('python3', [validator, 'check'], { input: payload, stdio: ['pipe', 'ignore', 'inherit'] });
if (checked.status !== 0) process.exit(1);
const published = spawnSync('gh', ['secret', 'set', 'EC2_RUNTIME_ENV', '--repo', 'Duck1201/MyCity', '--env', 'demonstration'], { input: payload, stdio: ['pipe', 'inherit', 'inherit'] });
process.exitCode = published.status ?? 1;
