import { afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { createDatabase } from '../src/database.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', '127.0.0.1', 'test-db'].includes(url.hostname)) throw new Error('Use somente o banco local mycity_test.');
const database = createDatabase(url.toString());
const pool = new Pool({ connectionString: url.toString() });
afterAll(async () => {
    await database.$disconnect();
    await pool.end();
});

it.each(['123', 'abcdefghijk'])('recusa CPF fora do formato de armazenamento: %s', async (cpf) => {
    await expect(pool.query('INSERT INTO users (id,cpf,password,role) VALUES ($1,$2,$3,$4)', [randomUUID(), cpf, 'synthetic-hash', 'citizen'])).rejects.toMatchObject({ code: '23514' });
});

it('mapeia users/user_role e mantém createdAt ao atualizar modifiedAt', async () => {
    const original = await database.user.create({ data: { cpf: '00000000088', password: 'synthetic-hash-fixture', role: 'CITIZEN', modifiedAt: new Date('2000-01-01T00:00:00Z') } });
    try {
        const updated = await database.user.update({ where: { id: original.id }, data: { role: 'MANAGER' } });
        expect(updated.createdAt).toEqual(original.createdAt);
        expect(updated.modifiedAt.getTime()).toBeGreaterThan(original.modifiedAt.getTime());
        const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position");
        expect(columns.rows.map((row) => row.column_name)).toEqual(['id', 'cpf', 'password', 'role', 'created_at', 'modified_at']);
        const persisted = await pool.query('SELECT role::text AS role FROM users WHERE id=$1', [original.id]);
        expect(persisted.rows[0].role).toBe('manager');
    } finally {
        await database.user.delete({ where: { id: original.id } });
    }
});

it.each([false, true])('migração preserva dados ou bloqueia conta sem mapeamento: %s', async (unknownAccount) => {
    const client = await pool.connect();
    const schema = `migration_${randomUUID().replaceAll('-', '')}`;
    try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        await client.query(readFileSync('prisma/migrations/20261119014320_identity/migration.sql', 'utf8'));
        const legacy = [
            { id: 'a', email: 'cidadao.a@mycity.example', passwordHash: 'hash-a', role: 'CITIZEN' },
            { id: 'b', email: 'cidadao.b@mycity.example', passwordHash: 'hash-b', role: 'CITIZEN' },
            { id: 'c', email: 'gestor@mycity.example', passwordHash: 'hash-c', role: 'MANAGER' },
        ];
        if (unknownAccount) legacy.push({ id: 'd', email: 'unmapped@mycity.example', passwordHash: 'hash-d', role: 'CITIZEN' });
        for (const row of legacy) await client.query('INSERT INTO "User" (id,email,"passwordHash",role,"createdAt") VALUES ($1,$2,$3,$4,$5)', [row.id, row.email, row.passwordHash, row.role, '2020-01-01']);
        const migration = readFileSync('prisma/migrations/20261119040000_user_cpf_mapping/migration.sql', 'utf8');
        if (unknownAccount) {
            await expect(client.query(migration)).rejects.toThrow('Unmapped users');
            await client.query('ROLLBACK');
            const result = await client.query('SELECT id,email,"passwordHash",role::text FROM "User" ORDER BY id');
            expect(result.rows).toEqual(legacy);
        } else {
            await client.query(migration);
            const result = await client.query('SELECT id,cpf,password,role::text,created_at::text,modified_at FROM users ORDER BY id');
            expect(result.rows).toEqual([
                { id: 'a', cpf: '00000000001', password: 'hash-a', role: 'citizen', created_at: '2020-01-01 00:00:00', modified_at: expect.any(Date) },
                { id: 'b', cpf: '00000000002', password: 'hash-b', role: 'citizen', created_at: '2020-01-01 00:00:00', modified_at: expect.any(Date) },
                { id: 'c', cpf: '00000000003', password: 'hash-c', role: 'manager', created_at: '2020-01-01 00:00:00', modified_at: expect.any(Date) },
            ]);
        }
    } finally {
        await client.query('ROLLBACK');
        await client.query('SET search_path TO public');
        await client.query(`DROP SCHEMA "${schema}" CASCADE`);
        client.release();
    }
});
