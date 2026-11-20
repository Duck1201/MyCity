import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { afterEach, beforeEach, expect, it } from 'vitest';

const sha = 'a'.repeat(40);
const digest = 'sha256:' + 'b'.repeat(64);
let root: string;

beforeEach(() => {
    root = mkdtempSync('/tmp/mycity-release-');
    writeFileSync(join(root, '.env'), '');
    mkdirSync(join(root, 'releases', sha), { recursive: true });
    writeFileSync(join(root, 'releases', sha, 'compose.deploy.yaml'), '');
    writeFileSync(join(root, 'commands.sh'), 'docker() { printf "%s\\n" "$*" >> "$TRACE"; }\ncurl() { printf "%s\\n" "$*" >> "$TRACE"; }\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function deploy(sequence: number, imageDigest = digest, manifestSha = sha, attempt = 1) {
    const directory = join(root, 'releases', sha + '-' + sequence + '-' + attempt);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'compose.deploy.yaml'), '');
    const images = ['api', 'tools', 'web'].map((image) => image.toUpperCase() + '_DIGEST=' + imageDigest);
    writeFileSync(join(directory, 'images.env'), ['RELEASE_SHA=' + manifestSha, 'CI_NUMBER=' + sequence, 'CI_ATTEMPT=' + attempt, ...images].join('\n') + '\n');
    const run = spawnSync('/bin/bash', ['-c', 'source "$COMMANDS"; source scripts/deploy.sh', 'deploy.sh', root, sha, 'tester', String(sequence), String(attempt)], { env: { PATH: '/usr/bin:/bin', COMMANDS: join(root, 'commands.sh'), TRACE: join(root, 'trace') } });
    return run.status;
}

it('aplica os digests da CI e permite repetir a mesma release', () => {
    expect(deploy(10)).toBe(0);
    expect(deploy(10)).toBe(0);
    expect(readFileSync(join(root, 'current-release'), 'utf8').trim()).toBe(sha);
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
