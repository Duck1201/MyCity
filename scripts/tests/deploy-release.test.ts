import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { afterEach, beforeEach, expect, it } from 'vitest';

const digest = 'sha256:' + 'b'.repeat(64);
let root: string;

beforeEach(() => {
    root = mkdtempSync('/tmp/mycity-release-');
    writeFileSync(join(root, '.env.production'), 'POSTGRES_PASSWORD=test-db-password\n', { mode: 0o600 });
    writeFileSync(join(root, 'commands.sh'), 'docker() { printf "%s\\n" "$*" >> "$TRACE"; }\ncurl() { printf "curl %s\\n" "$*" >> "$TRACE"; }\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function release(name: string, manifest = ['API', 'TOOLS', 'WEB'].map((image) => image + '_DIGEST=' + digest)) {
    const directory = join(root, 'releases', name);
    mkdirSync(directory, { recursive: true });
    for (const file of ['compose.yaml', 'Caddyfile', 'provision-api.sql']) copyFileSync(join('deploy', file), join(directory, file));
    writeFileSync(join(directory, 'images.env'), manifest.join('\n') + '\n');
}

function deploy(name: string, ...extra: string[]) {
    const args = name === '--rollback' ? [root, name] : [root, name, 'tester', ...extra];
    const run = spawnSync('/bin/bash', ['-c', 'source "$COMMANDS"; source deploy/deploy.sh', 'deploy.sh', ...args], {
        input: name === '--rollback' ? '' : 'fake-registry-token\n',
        env: { PATH: '/usr/bin:/bin', COMMANDS: join(root, 'commands.sh'), TRACE: join(root, 'trace') },
        encoding: 'utf8',
    });
    return run.status;
}
const trace = () => (existsSync(join(root, 'trace')) ? readFileSync(join(root, 'trace'), 'utf8') : '');

it('aplica os digests da release, registra a anterior e aponta current para a nova', () => {
    release('v1.0.0-1');
    release('v1.1.0-1');
    expect(deploy('v1.0.0-1')).toBe(0);
    expect(deploy('v1.1.0-1')).toBe(0);
    expect(readFileSync(join(root, 'current-release'), 'utf8').trim()).toBe('v1.1.0-1');
    expect(readFileSync(join(root, 'previous-release'), 'utf8').trim()).toBe('v1.0.0-1');
    expect(readFileSync(join(root, 'current', 'images.env'), 'utf8')).toContain('API_DIGEST=' + digest);
    expect(trace()).toMatch(/login ghcr\.io --username tester --password-stdin[\s\S]*pull[\s\S]*up -d --wait db[\s\S]*run --rm migrate[\s\S]*run --rm -T provision[\s\S]*up -d --wait api web edge/);
});

it('semeia somente na primeira implantação e depois sincroniza as senhas das contas', () => {
    release('v1.0.0-1');
    expect(deploy('v1.0.0-1')).toBe(0);
    expect(deploy('v1.0.0-1')).toBe(0);
    const runs = trace()
        .split('\n')
        .filter((line) => line.includes(' seed'));
    expect(runs[0]).toMatch(/run --rm seed$/);
    expect(runs[1]).toContain('db:sync-deployment-passwords');
    expect(runs).toHaveLength(2);
});

it('acrescenta o compose.override.yaml do servidor somente quando ele existe', () => {
    release('v1.0.0-1');
    expect(deploy('v1.0.0-1')).toBe(0);
    expect(trace()).not.toContain('compose.override.yaml');
    writeFileSync(join(root, 'compose.override.yaml'), 'services: {}\n');
    expect(deploy('v1.0.0-1')).toBe(0);
    expect(trace()).toContain('-f ' + join(root, 'compose.override.yaml'));
});

it.each([
    ['manifesto incompleto', ['API_DIGEST=' + digest, 'WEB_DIGEST=' + digest]],
    ['digest inválido', ['API_DIGEST=latest', 'TOOLS_DIGEST=' + digest, 'WEB_DIGEST=' + digest]],
    ['ordem trocada', ['TOOLS_DIGEST=' + digest, 'API_DIGEST=' + digest, 'WEB_DIGEST=' + digest]],
])('recusa %s antes de usar o Docker', (_case, manifest) => {
    release('v1.0.0-1', manifest);
    expect(deploy('v1.0.0-1')).not.toBe(0);
    expect(trace()).toBe('');
});

it.each(['../v1.0.0-1', 'latest', 'v1.0-1', 'v1.0.0'])('recusa o nome de release %s', (name) => {
    release('v1.0.0-1');
    expect(deploy(name)).not.toBe(0);
    expect(trace()).toBe('');
});

it('recusa implantar sem o .env.production do servidor', () => {
    release('v1.0.0-1');
    rmSync(join(root, '.env.production'));
    expect(deploy('v1.0.0-1')).not.toBe(0);
    expect(trace()).toBe('');
});

it('lê as senhas e o endereço público do .env.production do servidor', () => {
    release('v1.0.0-1');
    expect(deploy('v1.0.0-1')).toBe(0);
    expect(trace()).toContain('--env-file ' + join(root, '.env.production') + ' ');
});

it('volta para a release anterior sem migrar, sem baixar imagens e sem token', () => {
    release('v1.0.0-1');
    release('v1.1.0-1');
    expect(deploy('v1.0.0-1')).toBe(0);
    expect(deploy('v1.1.0-1')).toBe(0);
    const before = trace();
    expect(deploy('--rollback')).toBe(0);
    const rollback = trace().slice(before.length);
    expect(rollback).toContain('-f ' + join(root, 'releases', 'v1.0.0-1', 'compose.yaml'));
    expect(rollback).toContain('up -d --wait api web edge');
    expect(rollback).not.toMatch(/login|pull|migrate|provision|seed/);
    expect(readFileSync(join(root, 'current-release'), 'utf8').trim()).toBe('v1.0.0-1');
    expect(readFileSync(join(root, 'previous-release'), 'utf8').trim()).toBe('v1.1.0-1');
    expect(readFileSync(join(root, 'current', 'images.env'), 'utf8')).toContain('API_DIGEST=' + digest);
});

it('recusa o rollback quando não há release anterior registrada', () => {
    release('v1.0.0-1');
    expect(deploy('v1.0.0-1')).toBe(0);
    const before = trace();
    expect(deploy('--rollback')).not.toBe(0);
    expect(trace()).toBe(before);
    expect(readFileSync(join(root, 'current-release'), 'utf8').trim()).toBe('v1.0.0-1');
});

it('vincula cada serviço publicado ao digest correspondente e coleta os processos da sonda do edge', () => {
    const { services } = parse(readFileSync('deploy/compose.yaml', 'utf8'));
    for (const [service, image] of [
        ['api', 'api'],
        ['web', 'web'],
        ['migrate', 'tools'],
    ]) {
        expect(services[service].image).toBe('ghcr.io/duck1201/mycity-' + image + '@${' + image.toUpperCase() + '_DIGEST:?Digest obrigatório}');
    }
    expect(services.seed.extends).toBe('migrate');
    expect(services.edge.init).toBe(true);
});

it('mantém o compose e o Caddyfile genéricos: endereço público e rede do servidor vêm de fora do repositório', () => {
    const compose = parse(readFileSync('deploy/compose.yaml', 'utf8'));
    expect(Object.values(compose.networks ?? {}).some((network) => (network as { external?: boolean }).external)).toBe(false);
    expect(compose.services.api.environment.WEB_ORIGIN).toMatch(/^\$\{WEB_ORIGIN:\?/);
    expect(compose.services.edge.environment.WEB_ORIGIN).toMatch(/^\$\{WEB_ORIGIN:\?/);
    const text = readFileSync('deploy/compose.yaml', 'utf8') + readFileSync('deploy/Caddyfile', 'utf8');
    expect(text).not.toMatch(/https?:\/\/(?!127\.0\.0\.1|localhost|\$|\{)[a-z0-9.-]+/i);
    expect(readFileSync('deploy/Caddyfile', 'utf8')).toMatch(/^\{\$WEB_ORIGIN\} \{$/m);
    expect(existsSync('infra')).toBe(false);
});

const workflow = () => parse(readFileSync('.github/workflows/release.yml', 'utf8'));

it('publica e implanta somente a partir de tags de versão em commits da main com CI aprovada', () => {
    const { on, jobs } = workflow();
    expect(on).toEqual({ push: { tags: ['v*.*.*'] } });
    const verify = jobs.verify.steps.map((step: { run?: string }) => step.run ?? '').join('\n');
    expect(verify).toContain('merge-base --is-ancestor');
    expect(verify).toContain('actions/workflows/ci.yml/runs');
    expect(verify).toContain('npm run security:secrets');
    expect(verify).toContain('npm run security:dependencies');
    expect(jobs.images.needs).toBe('verify');
    expect(jobs.deploy.needs).toEqual(['verify', 'images']);
    expect(jobs.deploy.environment.name).toBe('demonstration');
    expect(workflow().concurrency).toEqual({ group: 'release', 'cancel-in-progress': false });
});

it('entrega à VM os digests produzidos pelo mesmo workflow, sem artefatos intermediários', () => {
    const { images, deploy } = workflow().jobs;
    const builds = images.steps.filter((step: { uses?: string }) => step.uses?.startsWith('docker/build-push-action@'));
    expect(builds.map((step: { id: string }) => step.id)).toEqual(['api', 'tools', 'web']);
    for (const image of ['api', 'tools', 'web']) expect(images.outputs[image]).toBe('${{ steps.' + image + '.outputs.digest }}');
    const commands = deploy.steps.map((step: { run?: string }) => step.run ?? '').join('\n');
    expect(commands).not.toContain('${{');
    for (const image of ['api', 'tools', 'web']) expect(JSON.stringify(deploy)).toContain('needs.images.outputs.' + image);
    expect(JSON.stringify(deploy)).not.toMatch(/download-artifact|EC2_RUNTIME_ENV/);
});

it('revalida o nome da release no próprio job de deploy antes do primeiro comando remoto', () => {
    const steps = workflow().jobs.deploy.steps as { name?: string; run?: string }[];
    const prepare = steps.findIndex((step) => step.name === 'Prepare release files and SSH');
    const firstRemote = steps.findIndex((step) => /\bssh\b|\bscp\b/.test(step.run ?? '') && !step.run!.includes('install -m 700'));
    expect(prepare).toBeGreaterThanOrEqual(0);
    expect(prepare).toBeLessThan(firstRemote);
    const check = steps[prepare]!.run!.match(/\[\[ "\$RELEASE" =~ ([^ ]+) \]\]/)?.[1];
    expect(check).toBe('^v[0-9]+\\.[0-9]+\\.[0-9]+-[1-9][0-9]{0,8}$');
    const name = new RegExp(check!);
    for (const valid of ['v1.0.0-1', 'v12.3.45-10']) expect(name.test(valid)).toBe(true);
    for (const hostile of ["v1.0.0-1'; rm -rf / #", 'v1.0.0', 'v1.0.0-1/../x', 'latest-1']) expect(name.test(hostile)).toBe(false);
});
