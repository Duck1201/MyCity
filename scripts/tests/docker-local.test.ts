import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parse } from 'yaml';

it('sobe o painel só depois de migrar, semear e verificar a API', () => {
    const { services } = parse(readFileSync('compose.yaml', 'utf8'));
    expect(services.migrate.depends_on.db.condition).toBe('service_healthy');
    expect(services.seed.depends_on.migrate.condition).toBe('service_completed_successfully');
    expect(services.api.depends_on.seed.condition).toBe('service_completed_successfully');
    expect(services.web.depends_on.api.condition).toBe('service_healthy');
    expect(services.web.healthcheck.test.join(' ')).toContain('/api/v1/health/ready');
    expect(services['test-db'].profiles).toEqual(['test']);
});
