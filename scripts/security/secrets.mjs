import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { verifySha256 } from './integrity.mjs';
import { assertNoIgnoreFile, scannerOptions, sourceInsideRepository } from './scanner-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cache = join(homedir(), '.cache/mycity/security/gitleaks-8.30.1');
const binary = join(cache, 'gitleaks');
const archiveHash = '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb';
const binaryHash = '88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509';
const work = mkdtempSync(join(tmpdir(), 'mycity-secret-check-'));

try {
    if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Este instalador está validado para Linux x64. Não substitua o binário sem verificar versão e checksum.');
    if (!existsSync(binary)) {
        const archive = join(work, 'gitleaks.tar.gz');
        execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', 'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz', '--output', archive]);
        if (!verifySha256(readFileSync(archive), archiveHash)) throw new Error('Checksum do Gitleaks inválido.');
        mkdirSync(cache, { recursive: true, mode: 0o700 });
        execFileSync('tar', ['-xzf', archive, '-C', cache, 'gitleaks']);
        chmodSync(binary, 0o700);
    }
    if (!verifySha256(readFileSync(binary), binaryHash)) throw new Error('Binário Gitleaks não corresponde à versão fixada.');
    const policy = join(work, 'policy.toml');
    const emptyIgnore = join(work, 'empty-ignore');
    writeFileSync(policy, '[extend]\nuseDefault = true\n');
    writeFileSync(emptyIgnore, '');
    const { flags, env } = scannerOptions(policy, emptyIgnore, process.env);
    assertNoIgnoreFile(root);

    // Canary is generated only for this run, never used as a credential or committed.
    const canary = join(work, 'canary');
    mkdirSync(canary);
    const { privateKey } = generateKeyPairSync('ed25519');
    writeFileSync(join(canary, 'unused-test-key.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    writeFileSync(join(canary, '.gitleaks.toml'), "[extend]\nuseDefault = true\n[[allowlists]]\ndescription = 'Synthetic hostile configuration'\npaths = ['.*']\n");
    const proof = join(work, 'canary-report.json');
    const detector = spawnSync(binary, ['dir', canary, ...flags, '--report-format', 'json', '--report-path', proof], { stdio: 'pipe', env });
    if (detector.status !== 1 || !existsSync(proof) || !JSON.parse(readFileSync(proof, 'utf8')).some((finding) => finding.RuleID === 'private-key')) throw new Error('Scanner não detectou o canário sintético; validação interrompida.');
    rmSync(canary, { recursive: true });
    console.info('Canário sintético detectado apesar de configuração hostil; fixture removida.');

    const history = spawnSync(binary, ['git', root, '--log-opts=--all', ...flags], { stdio: 'inherit', env });
    if (history.status !== 0) throw new Error('Verificação de segredos no histórico falhou.');
    const staged = spawnSync(binary, ['git', root, '--staged', ...flags], { stdio: 'inherit', env });
    if (staged.status !== 0) throw new Error('Verificação de segredos no índice Git falhou.');

    const checkout = join(work, 'checkout');
    mkdirSync(checkout);
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    for (const name of new Set(files)) {
        const source = join(root, name);
        let metadata;
        try {
            metadata = lstatSync(source);
        } catch (error) {
            if (error.code === 'ENOENT') continue;
            throw error;
        }
        if (metadata.isSymbolicLink()) throw new Error(`Revise o link simbólico antes do scan: ${name}`);
        const destination = join(checkout, name);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(sourceInsideRepository(root, source), destination);
    }
    assertNoIgnoreFile(checkout);
    const current = spawnSync(binary, ['dir', checkout, ...flags], { stdio: 'inherit', env });
    if (current.status !== 0) throw new Error('Verificação de segredos no conteúdo atual falhou.');
} finally {
    rmSync(work, { recursive: true, force: true });
}
