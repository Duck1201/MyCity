import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

if (!process.env.DATABASE_URL) config({ path: new URL('../../.env', import.meta.url).pathname, quiet: true });

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
    datasource: {
        url: process.env.DATABASE_URL ?? 'postgresql://unused:unused@localhost:5432/unused',
    },
});
