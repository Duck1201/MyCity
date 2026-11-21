import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, it } from 'vitest';

it('waits for the final PostgreSQL server to accept TCP connections before the first migration', () => {
    const { services } = parse(readFileSync('deploy/compose.yaml', 'utf8'));
    expect(services.db.healthcheck.test).toEqual(['CMD-SHELL', 'pg_isready -h 127.0.0.1 -U mycity -d mycity']);
    expect(services.migrate.depends_on.db.condition).toBe('service_healthy');
});

it('uses separate database credentials for migrations and the hosted API', () => {
    const { services } = parse(readFileSync('deploy/compose.yaml', 'utf8'));
    expect(services.api.environment.DATABASE_URL).toContain('postgresql://mycity_api:');
    expect(services.api.environment.DATABASE_URL).toContain('API_DATABASE_PASSWORD');
    expect(JSON.stringify(services.api.environment)).not.toContain('POSTGRES_PASSWORD');
    expect(services.migrate.environment.DATABASE_URL).toContain('postgresql://mycity:');
    expect(services.provision.volumes).toContain('./provision-api.sql:/provision-api.sql:ro');
});

it('runs the thumbnail backfill with the restricted API role, never the database owner', () => {
    const { services } = parse(readFileSync('deploy/compose.yaml', 'utf8'));
    expect(services.thumbnails.environment.DATABASE_URL).toBe(services.api.environment.DATABASE_URL);
    expect(JSON.stringify(services.thumbnails.environment)).not.toContain('POSTGRES_PASSWORD');
    // The backfill only lists photos; the restricted role must be able to read them.
    expect(readFileSync('deploy/provision-api.sql', 'utf8')).toMatch(/GRANT SELECT ON[^;]*\breport_photos\b[^;]*TO mycity_api;/);
});
