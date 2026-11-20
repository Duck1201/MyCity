import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, it } from 'vitest';

it('uses separate database credentials for migrations and the hosted API', () => {
    const { services } = parse(readFileSync('deploy/compose.yaml', 'utf8'));
    expect(services.api.environment.DATABASE_URL).toContain('postgresql://mycity_api:');
    expect(services.api.environment.DATABASE_URL).toContain('API_DATABASE_PASSWORD');
    expect(JSON.stringify(services.api.environment)).not.toContain('POSTGRES_PASSWORD');
    expect(services.migrate.environment.DATABASE_URL).toContain('postgresql://mycity:');
    expect(services.provision.volumes).toContain('./provision-api.sql:/provision-api.sql:ro');
});
