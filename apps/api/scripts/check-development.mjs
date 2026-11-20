import { createServer } from 'node:net';
import { developmentPorts } from '../../../scripts/development-ports.mjs';
import pg from 'pg';

async function checkDatabase() {
    if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL no .env da raiz.');
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2500 });
    try {
        await client.connect();
        await client.query('SELECT id FROM users LIMIT 0');
    } catch (error) {
        if (error.code === '42P01') throw new Error('Banco de desenvolvimento sem a tabela de usuários. Confira o destino e aplique as migrações conforme o README.', { cause: error });
        throw new Error('Não foi possível acessar o PostgreSQL de desenvolvimento. Confira DATABASE_URL e se o banco está em execução.', { cause: error });
    } finally {
        await client.end();
    }
}

async function checkPort(name, port, host) {
    const server = createServer();
    await new Promise((resolve, reject) => {
        server.once('error', (error) => reject(new Error(error.code === 'EADDRINUSE' ? `A porta ${port} (${name}) já está em uso. Se o MyCity já estiver rodando, use o ambiente aberto. Para reiniciá-lo, encerre o processo anterior com Ctrl+C.` : `Não foi possível usar a porta ${port} (${name}): ${error.code}.`)));
        server.listen({ port, host }, () => server.close(resolve));
    });
}
try {
    const { apiPort, webPort } = developmentPorts();
    await checkDatabase();
    await checkPort('API', apiPort);
    if (!process.argv.includes('--api-only')) await checkPort('painel', webPort, 'localhost');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
