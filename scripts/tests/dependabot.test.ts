import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, it } from 'vitest';

it('mantém atualizações mensais do Dependabot para npm, Actions e imagens Docker', () => {
    const config = parse(readFileSync('.github/dependabot.yml', 'utf8'));
    expect(config.version).toBe(2);
    const npm = config.updates.filter((update: Record<string, unknown>) => update['package-ecosystem'] === 'npm');
    expect(npm).toHaveLength(1);
    expect(npm[0].directory).toBe('/');
    expect(config.updates.find((update: Record<string, unknown>) => update['package-ecosystem'] === 'github-actions').directory).toBe('/');
    const docker = config.updates.find((update: Record<string, unknown>) => update['package-ecosystem'] === 'docker');
    expect(docker.directories).toEqual(['/', '/apps/api', '/apps/web', '/infra']);
    for (const update of config.updates) {
        expect(update['commit-message'].prefix).toBe('build');
        expect(update.schedule.interval).toBe('monthly');
        expect(update['open-pull-requests-limit']).toBeLessThanOrEqual(5);
    }
});
