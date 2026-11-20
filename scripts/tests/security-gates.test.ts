import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { expect, it } from 'vitest';
import { verifySha256 } from '../security/integrity.mjs';
import { assertNoIgnoreFile, scannerOptions, sourceInsideRepository } from '../security/scanner-policy.mjs';

it('não lê arquivos externos através de um diretório simbólico', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mycity-symlink-test-'));
    try {
        const repository = join(directory, 'repo');
        const outside = join(directory, 'outside');
        mkdirSync(repository);
        mkdirSync(outside);
        writeFileSync(join(outside, 'data.txt'), 'synthetic data');
        symlinkSync(outside, join(repository, 'linked-directory'));
        expect(() => sourceInsideRepository(repository, join(repository, 'linked-directory/data.txt'))).toThrow();
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

it('usa a mesma política controlada e não herda configuração Gitleaks', () => {
    const options = scannerOptions('/controlled/policy.toml', '/controlled/empty-ignore', { PATH: '/bin', GITLEAKS_CONFIG: '/hostile.toml', GITLEAKS_CONFIG_TOML: 'hostile' });
    expect(options.flags).toContain('/controlled/policy.toml');
    expect(options.flags).toContain('/controlled/empty-ignore');
    expect(options.env).toEqual({ PATH: '/bin' });
});

it.each(['regular', 'broken-symlink'])('bloqueia .gitleaksignore no checkout: %s', (kind) => {
    const directory = mkdtempSync(join(tmpdir(), 'mycity-ignore-test-'));
    try {
        assertNoIgnoreFile(directory);
        if (kind === 'regular') writeFileSync(join(directory, '.gitleaksignore'), '');
        else symlinkSync('/nonexistent-mycity-target', join(directory, '.gitleaksignore'));
        expect(() => assertNoIgnoreFile(directory)).toThrow();
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

it('rejeita ferramenta cujo conteúdo não corresponde ao checksum fixado', () => {
    const sha256OfAbc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(verifySha256(Buffer.from('abc'), sha256OfAbc)).toBe(true);
    expect(verifySha256(Buffer.from('tampered'), sha256OfAbc)).toBe(false);
});

it('impede publicar imagens sem os checks de segurança', () => {
    const workflow = parse(readFileSync('.github/workflows/release.yml', 'utf8'));
    expect(workflow.jobs.images.needs).toBe('verify');
    const commands = workflow.jobs.verify.steps.map((step: { run?: string }) => step.run ?? '').join('\n');
    expect(commands).toContain('npm run security:secrets');
    expect(commands).toContain('npm run security:dependencies');
    const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
    expect(ci.jobs.publish).toBeUndefined();
    expect(ci.jobs.security?.name).toBe('Security checks');
});

it.each(['api', 'web'])('limita os arquivos do build de %s aos insumos da imagem', (workspace) => {
    const recipe = readFileSync('apps/' + workspace + '/Dockerfile', 'utf8');
    const contextCopies = recipe.split('\n').filter((line) => line.startsWith('COPY ') && !line.startsWith('COPY --from='));
    expect(contextCopies).not.toContain('COPY . .');
    expect(contextCopies.some((line) => line.includes('apps/' + workspace + '/src'))).toBe(true);
});
