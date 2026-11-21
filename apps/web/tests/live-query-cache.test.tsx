import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ManagerAccess } from '../src/manager-access';
import { useLiveQuery } from '../src/use-live-query';

afterEach(() => vi.unstubAllGlobals());

const session = () => new Response(JSON.stringify({ data: { id: 'gestor', role: 'MANAGER' } }), { headers: { 'Content-Type': 'application/json', 'X-Session-Expires-At': new Date(Date.now() + 86_400_000).toISOString() } });
const pending = () => new Promise<Response>(() => {});

function Reader({ onSessionExpired }: { onSessionExpired: () => void }) {
    const query = useLiveQuery<{ label: string }>('/api/v1/reports/overview', onSessionExpired);
    return <p>{query.data?.label ?? 'Carregando leitura'}</p>;
}
function Screens({ onSessionExpired }: { onSessionExpired: () => void }) {
    const [reading, setReading] = useState(true);
    return (
        <>
            <button onClick={() => setReading(!reading)}>Trocar tela</button>
            {reading ? <Reader onSessionExpired={onSessionExpired} /> : <p>Outra tela</p>}
        </>
    );
}

it('mostra na hora a última leitura ao voltar a uma tela e revalida pela rede', async () => {
    let reads = 0;
    const fetcher = vi.fn((url: string) => {
        if (url === '/api/v1/me') return Promise.resolve(session());
        reads++;
        return reads === 1 ? Promise.resolve(Response.json({ label: 'Primeira leitura' })) : pending();
    });
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    render(<ManagerAccess>{(expire) => <Screens onSessionExpired={expire} />}</ManagerAccess>);
    expect(await screen.findByText('Primeira leitura')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Trocar tela' }));
    expect(screen.getByText('Outra tela')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Trocar tela' }));
    expect(screen.getByText('Primeira leitura')).toBeVisible();
    expect(reads).toBe(2);
    for (const [url, init] of fetcher.mock.calls.filter(([url]) => url !== '/api/v1/me') as unknown as [string, RequestInit][]) {
        expect(url).toBe('/api/v1/reports/overview');
        expect(init.cache).toBe('no-cache');
    }
});

it('descarta as leituras guardadas quando a sessão termina', async () => {
    let reads = 0;
    vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init?: RequestInit) => {
            if (url === '/api/v1/me') return Promise.resolve(session());
            if (url === '/api/v1/sessions/current') return Promise.resolve(new Response(null, { status: 204 }));
            if (url === '/api/v1/sessions' && init?.method === 'POST') return Promise.resolve(Response.json({ data: { user: { id: 'gestor', role: 'MANAGER' }, expiresAt: new Date(Date.now() + 86_400_000).toISOString() } }));
            reads++;
            return reads === 1 ? Promise.resolve(Response.json({ label: 'Leitura da sessão anterior' })) : pending();
        }),
    );
    const user = userEvent.setup();
    render(<ManagerAccess>{(expire) => <Screens onSessionExpired={expire} />}</ManagerAccess>);
    expect(await screen.findByText('Leitura da sessão anterior')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    await user.type(await screen.findByLabelText('CPF'), '00000000003');
    await user.type(screen.getByLabelText('Senha'), 'credencial-de-teste');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Carregando leitura')).toBeVisible();
    expect(screen.queryByText('Leitura da sessão anterior')).toBeNull();
});
