import swaggerAutogen from 'swagger-autogen';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const destination = fileURLToPath(new URL('../src/openapi.json', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'mycity-openapi-'));
const envelope = (status) => ({ type: 'object', required: ['data'], properties: { data: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: [status] } } } } });
try {
    const output = join(temporary, 'openapi.json');
    const result = await swaggerAutogen({ openapi: '3.0.3', disableLogs: true })(output, [fileURLToPath(new URL('../src/health.ts', import.meta.url))], {
        info: { title: 'MyCity API', version: '0.1.0', description: 'Contrato gerado das rotas implementadas. CPF/senha, denúncias e gestão ainda estão em especificação. Esta interface só é habilitada no desenvolvimento local.' },
        servers: [{ url: '/', description: 'Mesma origem da documentação' }],
        tags: [{ name: 'Saúde', description: 'Verificações operacionais públicas sem dados pessoais.' }],
        components: {
            '@schemas': {
                Liveness: envelope('alive'),
                Readiness: envelope('ready'),
                Unavailable: { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string', enum: ['UNAVAILABLE'] }, message: { type: 'string', example: 'Serviço temporariamente indisponível.' } } } } },
            },
        },
    });
    if (!result || !result.success) throw new Error('swagger-autogen não gerou o contrato.');
    const formatted = await prettier.format(await readFile(output, 'utf8'), { ...(await prettier.resolveConfig(destination)), filepath: destination });
    if (process.argv.includes('--check')) {
        if ((await readFile(destination, 'utf8')) !== formatted) throw new Error('OpenAPI desatualizado: execute npm run docs:generate -w @mycity/api.');
    } else await writeFile(destination, formatted);
} finally {
    await rm(temporary, { recursive: true, force: true });
}
