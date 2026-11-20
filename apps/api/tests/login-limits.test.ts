import { expect, it } from 'vitest';
import { createLoginLimits } from '../src/modules/identity/login-limits.js';

it('mantém até quatro verificações de senha em voo e libera a vaga ao concluir', () => {
    const reserve = createLoginLimits();
    const jobs = Array.from({ length: 4 }, (_, i) => reserve('127.0.0.1', String(i)));
    expect(reserve('127.0.0.2', 'nova').retryAfter).toBeGreaterThan(0);
    jobs[0]!.finish?.(false);
    expect(reserve('127.0.0.2', 'nova').retryAfter).toBeUndefined();
});
it('aplica o limite da origem à rede IPv6 /64', () => {
    const reserve = createLoginLimits();
    for (let i = 0; i < 60; i++) reserve('2001:db8:1:2::' + (i + 1).toString(16), 'cpf').finish?.(true);
    expect(reserve('2001:db8:1:2::fed', 'cpf').retryAfter).toBeGreaterThan(0);
    expect(reserve('2001:db8:1:3::1', 'cpf').retryAfter).toBeUndefined();
});
