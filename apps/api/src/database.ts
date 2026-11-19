import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export function createDatabase(connectionString: string) {
    if (!connectionString) throw new Error('DATABASE_URL é obrigatória.');
    return new PrismaClient({
        adapter: new PrismaPg({
            connectionString,
            connectionTimeoutMillis: 2000,
            max: 5,
        }),
    });
}

export type Database = ReturnType<typeof createDatabase>;
