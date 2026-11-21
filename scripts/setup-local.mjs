import { spawnSync } from 'node:child_process';
import { readDevelopmentEnv, readPort } from './development-ports.mjs';

function run(message, hint, command, args, childEnv = process.env) {
    console.info(message);
    const result = spawnSync(command, args, { env: childEnv, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(hint);
}

function assertLocalDatabase(settings) {
    const target = URL.canParse(settings.DATABASE_URL) ? new URL(settings.DATABASE_URL) : null;
    const port = readPort(settings.DATABASE_PORT ?? 55432, 'DATABASE_PORT');
    if (target && settings.NODE_ENV !== 'production' && ['postgresql:', 'postgres:'].includes(target.protocol) && ['127.0.0.1', 'localhost'].includes(target.hostname) && Number(target.port || 5432) === port && target.username === 'mycity' && /^[a-zA-Z0-9_-]+$/.test(settings.POSTGRES_PASSWORD ?? '') && target.password === settings.POSTGRES_PASSWORD && target.pathname === '/mycity' && ['', '?schema=public'].includes(target.search) && !target.hash) return;
    throw new Error('O setup:local exige o banco local mycity do Docker Compose. Revise DATABASE_URL, DATABASE_PORT e POSTGRES_PASSWORD. Para um banco personalizado, siga docs/runbook.md.');
}

try {
    let settings = { ...readDevelopmentEnv('.env'), ...process.env };
    if (settings.DATABASE_URL !== undefined) assertLocalDatabase(settings);
    run('Preparando o ambiente local…', 'Falha no setup. Confira a versão de Node e npm e execute npm ci.', 'npm', ['run', 'setup']);
    if (settings.DATABASE_URL === undefined) {
        settings = { ...readDevelopmentEnv('.env'), ...process.env };
        assertLocalDatabase(settings);
    }
    run('Iniciando o PostgreSQL local…', 'Falha ao iniciar o PostgreSQL. Confira o Docker Compose e se DATABASE_PORT está livre.', 'docker', ['compose', '--env-file', '.env', '-f', 'compose.yaml', 'up', '-d', '--wait', 'db'], settings);
    run('Aplicando migrações…', 'Falha nas migrações. Confira a conexão e as credenciais do banco local.', 'npm', ['run', 'db:migrate'], settings);
    run('Preparando os dados fictícios…', 'Falha ao preparar os exemplos. Confira as senhas de demonstração no .env.', 'npm', ['run', 'db:seed'], settings);
    console.info('Ambiente preparado. Execute npm run dev para abrir o painel. A senha do gestor está em DEMO_MANAGER_PASSWORD no .env.');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
