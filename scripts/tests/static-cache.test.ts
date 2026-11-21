import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const config = readFileSync('deploy/nginx.conf', 'utf8');

function location(pattern: string) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    return config.match(new RegExp('location\\s+' + escaped + '\\s*\\{([^{}]*)\\}', 's'))?.[1];
}

it('guarda os arquivos com hash do Vite por um ano sem revalidar', () => {
    const assets = location('/assets/');
    expect(assets).toContain('add_header Cache-Control "public, max-age=31536000, immutable";');
    expect(assets).toContain('try_files $uri =404;');
});

it('revalida o index.html a cada visita para o painel pegar o deploy novo', () => {
    expect(location('= /index.html')).toContain('add_header Cache-Control "no-cache" always;');
    expect(location('/')).toContain('try_files $uri $uri/ /index.html;');
});

it('guarda por pouco tempo os arquivos públicos sem hash', () => {
    expect(location('/images/')).toContain('add_header Cache-Control "public, max-age=604800";');
    expect(location('= /favicon.svg')).toContain('add_header Cache-Control "public, max-age=86400";');
});

it('não guarda no navegador um 404 de arquivo estático', () => {
    // nginx only adds a header to error responses when the directive ends with "always".
    for (const path of ['/assets/', '/images/', '= /favicon.svg']) {
        expect(location(path)).not.toMatch(/add_header\s+Cache-Control[^;]*\balways;/);
    }
});

it('não aplica cache de navegador às respostas da API', () => {
    expect(location('/api/')).not.toContain('Cache-Control');
});

it('serve a fonte do painel com hash, para caber no cache imutável', () => {
    const styles = readFileSync('apps/web/src/styles.css', 'utf8');
    expect(styles).not.toContain("url('/fonts/");
    expect(styles).toMatch(/url\('\.\/assets\/fonts\/nunito-latin-wght-normal\.woff2'\)/);
    expect(existsSync('apps/web/public/fonts')).toBe(false);
});

it('leva a fonte e a licença dela para a imagem do painel', () => {
    const allowed = readFileSync('.dockerignore', 'utf8')
        .split('\n')
        .filter((line) => line.startsWith('!'))
        .map((line) => line.slice(1).trim());
    for (const file of ['apps/web/src/assets/fonts/nunito-latin-wght-normal.woff2', 'apps/web/public/licenses/nunito-license.txt']) {
        expect(existsSync(file)).toBe(true);
        expect(allowed).toContain(file);
    }
});
