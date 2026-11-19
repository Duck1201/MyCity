import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';

export function scannerOptions(policy, ignoreFile, environment) {
    return {
        flags: ['--config', policy, '--gitleaks-ignore-path', ignoreFile, '--redact=100', '--no-banner', '--ignore-gitleaks-allow'],
        env: Object.fromEntries(Object.entries(environment).filter(([name]) => !name.startsWith('GITLEAKS_'))),
    };
}

export function assertNoIgnoreFile(source) {
    try {
        lstatSync(join(source, '.gitleaksignore'));
    } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
    }
    throw new Error('.gitleaksignore não é permitido: revise falsos positivos sem desativar a inspeção.');
}

export function sourceInsideRepository(root, source) {
    const canonical = realpathSync(source);
    const location = relative(realpathSync(root), canonical);
    if (location === '..' || location.startsWith(`..${sep}`) || isAbsolute(location) || !lstatSync(canonical).isFile()) throw new Error('Arquivo fora do repositório ou não regular; inspeção interrompida.');
    return canonical;
}
