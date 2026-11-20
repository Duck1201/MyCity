import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { config } from 'dotenv';
import pg from 'pg';
import { resetTarget } from './reset-target.js';
import { removeResetPhotos } from './report-files.js';

config({ path: new URL('../../../.env', import.meta.url).pathname, quiet: true });

const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
function prisma(target: URL, ...args: string[]) {
    const child = spawnSync(process.execPath, [prismaCli, ...args], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: target.href } });
    if (child.error || child.status !== 0) {
        throw new Error('Prisma interrompeu a operação. Confira a saída acima.');
    }
}

async function reset() {
    const target = resetTarget(process.env.DATABASE_URL ?? '');
    if (process.argv.length !== 2) {
        throw new Error('Execute npm run db:reset sem argumentos.');
    }
    console.info(`Reset de desenvolvimento: ${target.hostname}:${target.port}/mycity (schema public). Todos os dados desse schema serão apagados. As migrações serão reaplicadas.`);
    const connection = new pg.Client({ connectionString: target.href, connectionTimeoutMillis: 2500 });
    try {
        await connection.connect();
        const {
            rows: [state],
        } = await connection.query<{ exclusive: boolean; photos: boolean }>(`
            SELECT NOT EXISTS (
                SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
                  AND backend_type='client backend' AND pid<>pg_backend_pid()
            ) AS exclusive, to_regclass('public.report_photos') IS NOT NULL AS photos
        `);
        if (!state?.exclusive) throw new Error('Encerre o npm run dev e outras conexões ao banco mycity antes do reset.');
        const photos = state.photos ? (await connection.query<{ id: string; reportId: string }>('SELECT id, report_id AS "reportId" FROM public.report_photos')).rows : [];
        // Skip the interactive prompt; Prisma handles consent for automated agents.
        prisma(target, 'migrate', 'reset', '--force');
        await removeResetPhotos(process.env.UPLOAD_DIR ?? './uploads', photos);
        console.info('Banco zerado com as migrações aplicadas. Para carregar exemplos, execute npm run db:seed.');
    } finally {
        await connection.end();
    }
}

try {
    await reset();
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Não foi possível concluir o reset.');
    process.exitCode = 1;
}
