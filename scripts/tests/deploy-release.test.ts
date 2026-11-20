import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { afterEach, beforeEach, expect, it } from 'vitest';

const sha = 'a'.repeat(40);
const digest = 'sha256:' + 'b'.repeat(64);
let root: string;
const runtime = {
    POSTGRES_PASSWORD: 'test-db-password',
    API_DATABASE_PASSWORD: 'test-api-password',
    DEMO_CITIZEN_A_PASSWORD: 'test-first-password',
    DEMO_CITIZEN_B_PASSWORD: 'test-second-password',
    DEMO_MANAGER_PASSWORD: 'test-manager-password',
    WEB_ORIGIN: 'https://demo.example.test',
};

beforeEach(() => {
    root = mkdtempSync('/tmp/mycity-release-');
    writeFileSync(join(root, '.env'), 'POSTGRES_PASSWORD=test-db-password\nLOCAL_OPTION=preserved\n', { mode: 0o600 });
    mkdirSync(join(root, 'releases', sha), { recursive: true });
    writeFileSync(join(root, 'releases', sha, 'compose.deploy.yaml'), '');
    writeFileSync(join(root, 'commands.sh'), 'docker() { printf "%s\\n" "$*" >> "$TRACE"; }\ncurl() { printf "%s\\n" "$*" >> "$TRACE"; }\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function deploy(sequence: number, imageDigest = digest, manifestSha = sha, attempt = 1, settings: Record<string, string> = runtime) {
    const directory = join(root, 'releases', sha + '-' + sequence + '-' + attempt);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'compose.deploy.yaml'), '');
    copyFileSync('scripts/deployment-env.py', join(directory, 'deployment-env.py'));
    const images = ['api', 'tools', 'web'].map((image) => image.toUpperCase() + '_DIGEST=' + imageDigest);
    writeFileSync(join(directory, 'images.env'), ['RELEASE_SHA=' + manifestSha, 'CI_NUMBER=' + sequence, 'CI_ATTEMPT=' + attempt, ...images].join('\n') + '\n');
    const run = spawnSync('/bin/bash', ['-c', 'source "$COMMANDS"; source scripts/deploy.sh', 'deploy.sh', root, sha, 'tester', String(sequence), String(attempt)], { input: 'fake-registry-token\n' + JSON.stringify(settings), env: { PATH: '/usr/bin:/bin', COMMANDS: join(root, 'commands.sh'), TRACE: join(root, 'trace') } });
    return run.status;
}

it('aplica os digests da CI e permite repetir a mesma release', () => {
    expect(deploy(10)).toBe(0);
    expect(deploy(10)).toBe(0);
    expect(readFileSync(join(root, 'current-release'), 'utf8').trim()).toBe(sha);
});

it('aplica somente o ambiente da implantação aceita, preservando configurações do servidor', () => {
    const file = join(root, '.env');
    expect(deploy(11)).toBe(0);
    const active = readFileSync(file, 'utf8');
    expect(active).toContain('LOCAL_OPTION=preserved');
    expect(active).toContain('test-manager-password');
    expect(deploy(10, digest, sha, 1, { ...runtime, DEMO_MANAGER_PASSWORD: 'different-secret' })).not.toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(active);
});

it.each([{ GOOGLE_MAPS_ANDROID_API_KEY: 'build-only' }, { POSTGRES_PASSWORD: 'wrong-volume-password' }])('preserva o ambiente diante de configuração extra ou senha de volume divergente', (override) => {
    const before = readFileSync(join(root, '.env'), 'utf8');
    expect(deploy(12, digest, sha, 1, { ...runtime, ...override })).not.toBe(0);
    expect(readFileSync(join(root, '.env'), 'utf8')).toBe(before);
});

it('preserva o papel em uso pela API quando diverge a senha de banco no deploy', () => {
    expect(deploy(11)).toBe(0);
    const file = join(root, '.env');
    const before = readFileSync(file, 'utf8');
    expect(deploy(12, digest, sha, 1, { ...runtime, API_DATABASE_PASSWORD: 'different-runtime-db-password' })).not.toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(before);
});

it('recusa a configuração de build antes de enviar dados pelo SSH', () => {
    const input = { ...runtime, GOOGLE_MAPS_ANDROID_API_KEY: 'build-only' };
    const result = spawnSync('python3', ['scripts/deployment-env.py', 'send'], {
        env: { PATH: '/usr/bin:/bin', EC2_RUNTIME_ENV: JSON.stringify(input), GHCR_TOKEN: 'registry-fixture' },
        encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toContain(input.GOOGLE_MAPS_ANDROID_API_KEY);
});

it('impede exibição da carga da EC2 quando o envio é iniciado diretamente no terminal', () => {
    const result = spawnSync('script', ['-q', '-e', '-c', 'python3 scripts/deployment-env.py send', '/dev/null'], {
        env: { PATH: '/usr/bin:/bin', EC2_RUNTIME_ENV: JSON.stringify(runtime), GHCR_TOKEN: 'synthetic-registry-token' },
        encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain(runtime.POSTGRES_PASSWORD);
    expect(result.stdout).not.toContain('synthetic-registry-token');
});

it('fecha o acesso antes da migração legada e retoma a rotação antes de ativar a API', () => {
    const marker = join(root, '.rotate-before-activation');
    writeFileSync(marker, '');
    writeFileSync(join(root, '.seeded'), '');
    appendFileSync(join(root, 'commands.sh'), 'docker() { printf "%s\\n" "$*" >> "$TRACE"; if [[ "$*" == *db:rotate-demo-passwords* && ! -f "$TRACE.failed" ]]; then touch "$TRACE.failed"; return 1; fi; }\n');
    expect(deploy(10)).not.toBe(0);
    const interrupted = readFileSync(join(root, 'trace'), 'utf8');
    expect(interrupted).toMatch(/stop edge api[\s\S]*run --rm migrate[\s\S]*db:rotate-demo-passwords/);
    expect(interrupted).not.toContain('up -d --wait api web edge');
    expect(existsSync(marker)).toBe(true);
    expect(deploy(10)).toBe(0);
    const resumed = readFileSync(join(root, 'trace'), 'utf8').slice(interrupted.length);
    expect(resumed).toMatch(/db:rotate-demo-passwords[\s\S]*up -d --wait api web edge/);
    expect(existsSync(marker)).toBe(false);
    expect(deploy(10)).toBe(0);
    expect(readFileSync(join(root, 'trace'), 'utf8').slice(interrupted.length + resumed.length)).not.toContain('db:rotate-demo-passwords');
});

it('rejeita execução anterior antes de usar Docker', () => {
    expect(deploy(11)).toBe(0);
    const trace = readFileSync(join(root, 'trace'), 'utf8');
    expect(deploy(10)).not.toBe(0);
    expect(readFileSync(join(root, 'trace'), 'utf8')).toBe(trace);
});

it.each([
    ['', sha],
    [digest, 'c'.repeat(40)],
])('rejeita manifesto incompleto ou incompatível', (value, commit) => {
    expect(deploy(10, value, commit)).not.toBe(0);
});

it('recusa uma tentativa anterior e digests diferentes para a mesma tentativa', () => {
    expect(deploy(10, digest, sha, 2)).toBe(0);
    const trace = readFileSync(join(root, 'trace'), 'utf8');
    expect(deploy(10)).not.toBe(0);
    expect(deploy(10, 'sha256:' + 'c'.repeat(64), sha, 2)).not.toBe(0);
    expect(readFileSync(join(root, 'trace'), 'utf8')).toBe(trace);
});

it('coleta os processos filhos da sonda HTTPS do edge', () => {
    const { services } = parse(readFileSync('infra/compose.deploy.yaml', 'utf8'));
    expect(services.edge.init).toBe(true);
});

it('vincula cada serviço publicado ao digest correspondente', () => {
    const { services } = parse(readFileSync('infra/compose.deploy.yaml', 'utf8'));
    for (const [service, image] of [
        ['api', 'api'],
        ['web', 'web'],
        ['migrate', 'tools'],
    ]) {
        expect(services[service].image).toBe('ghcr.io/duck1201/mycity-' + image + '@${' + image.toUpperCase() + '_DIGEST:?Digest obrigatório}');
    }
    expect(services.seed.extends).toBe('migrate');
});

it.each([true, false])('monta o manifesto somente com três artefatos da execução aprovada (correspondência: %s)', (matches) => {
    const workflow = parse(readFileSync('.github/workflows/deploy.yml', 'utf8'));
    const step = workflow.jobs.deploy.steps.find((item: { name?: string }) => item.name === 'Retrieve release digests from the successful CI run');
    const fakeGh = ['gh() {', '  if [[ "$1" == api ]]; then printf "%s\\n" "$RELEASE_SHA"; return; fi', '  [[ "$1 $2 $3 $4 $6" == "run download 123 -n -D" ]] || return 1', '  local image=${5#digest-1-} number=10', '  if [[ "$image" == tools && "$MATCHES" == false ]]; then number=9; fi', '  mkdir -p "$7"', '  printf "%s %s 1 %s %s\\n" "$RELEASE_SHA" "$number" "$image" "$DIGEST" > "$7/$image.digest"', '}'];
    writeFileSync(join(root, 'fake-gh.sh'), fakeGh.join('\n'));
    const run = spawnSync('/bin/bash', ['-c', 'source ./fake-gh.sh\n' + step.run], {
        cwd: root,
        env: { PATH: '/usr/bin:/bin', RELEASE_SHA: sha, CI_NUMBER: '10', CI_ATTEMPT: '1', CI_RUN: '123', GITHUB_REPOSITORY: 'demo/repo', RUNNER_TEMP: root, MATCHES: String(matches), DIGEST: digest },
    });
    expect(run.status, run.stderr.toString()).toBe(matches ? 0 : 1);
    if (matches) {
        expect(readFileSync(join(root, 'images.env'), 'utf8').trim().split('\n')).toEqual(['RELEASE_SHA=' + sha, 'CI_NUMBER=10', 'CI_ATTEMPT=1', 'API_DIGEST=' + digest, 'TOOLS_DIGEST=' + digest, 'WEB_DIGEST=' + digest]);
    }
});
