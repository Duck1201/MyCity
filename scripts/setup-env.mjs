import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const password = randomBytes(24).toString('hex');
const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
try {
    await writeFile(new URL('../.env', import.meta.url), template.replaceAll('replace_with_random_hex', password).replace('replace_with_demo_password', randomBytes(24).toString('base64url')), { flag: 'wx', mode: 0o600 });
    console.info('.env local criado com credenciais aleatórias.');
} catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.info('.env existente preservado.');
}
