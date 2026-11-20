import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const config = readFileSync('infra/nginx.conf', 'utf8');
const edge = readFileSync('infra/Caddyfile.deploy', 'utf8');

it('registra o método, a rota e o resultado sem a query string nem o Referer', () => {
    const format = config.match(/^\s*log_format\s+mycity\s+([^;]+);/m)?.[1] ?? '';
    expect(config).toMatch(/server\s*\{[^{}]*\baccess_log\s+\/var\/log\/nginx\/access\.log\s+mycity;/s);
    expect(format).toContain('$request_method $uri $server_protocol');
    expect(format).toContain('$status');
    expect(format).toContain('$upstream_status');
    expect(format).toContain('$request_time');
    expect(format).not.toMatch(/\$(?:request\b|request_uri\b|args\b|arg_\w+|query_string\b|http_referer\b)/);
});

it('mantém a falha do proxy no log de acesso sem duplicar a URL no log de erro da API', () => {
    const api = config.match(/location\s+\/api\/\s*\{([^{}]*)\}/s)?.[1];
    expect(api).toContain('error_log /dev/null;');
});

it('filtra a consulta e o Referer nos diagnósticos do Caddy antes do Nginx', () => {
    const globalLogger = edge.match(/^\s*\{\s*log\s*\{\s*format\s+filter\s*\{\s*wrap\s+json\s*fields\s*\{([^{}]*)\}/)?.[1] ?? '';
    expect(globalLogger).toContain('request>uri regexp "[?].*$" ""');
    expect(globalLogger).toContain('request>headers>Referer delete');
});
