import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, it } from 'vitest';

it('impede publicação automática de diagnósticos Docker que podem conter autenticação transitória', () => {
    const violations: string[] = [];
    let buildSteps = 0;
    for (const filename of readdirSync('.github/workflows').filter((name) => /\.ya?ml$/.test(name))) {
        const workflow = parse(readFileSync(`.github/workflows/${filename}`, 'utf8'));
        for (const [jobName, job] of Object.entries(workflow.jobs) as [string, { env?: Record<string, unknown>; steps?: { uses?: string; env?: Record<string, unknown> }[] }][]) {
            for (const step of job.steps ?? []) {
                if (!step.uses?.startsWith('docker/build-push-action@')) continue;
                buildSteps++;
                const env = { ...workflow.env, ...job.env, ...step.env };
                if (String(env.DOCKER_BUILD_RECORD_UPLOAD) !== 'false') violations.push(`${filename}/${jobName}`);
            }
        }
    }
    expect(buildSteps).toBeGreaterThan(0);
    expect(violations).toEqual([]);
});
