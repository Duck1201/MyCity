import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ManagerAccess } from '../src/manager-access';

afterEach(() => vi.unstubAllGlobals());

it('entra como gestor usando cookie e encerra a sessão pelo painel', async () => {
    const request = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(Response.json({ data: { user: { id: 'demo', role: 'MANAGER' }, expiresAt: new Date(Date.now() + 86400000).toISOString() } }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', request);
    const user = userEvent.setup();
    render(<ManagerAccess>{() => <p>Denúncias recebidas</p>}</ManagerAccess>);
    const cpf = await screen.findByLabelText('CPF');
    expect(document.querySelector('img[alt=""]')).toHaveAttribute('src', '/images/urban-neighborhood.svg');
    expect(screen.getByRole('main')).not.toHaveTextContent(/Lagoa da UFV|Viçosa|Vitor Cunha Baia/);
    await user.type(cpf, '00000000003');
    await user.type(screen.getByLabelText('Senha'), 'credencial-de-teste');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Denúncias recebidas')).toBeVisible();
    expect(request.mock.calls[1]).toEqual(['/api/v1/sessions', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-MyCity-Client': 'web' }), body: JSON.stringify({ cpf: '00000000003', password: 'credencial-de-teste', transport: 'cookie' }) })]);
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByLabelText('CPF')).toBeVisible();
    expect(screen.queryByText('Denúncias recebidas')).toBeNull();
    expect(request).toHaveBeenLastCalledWith('/api/v1/sessions/current', expect.objectContaining({ method: 'DELETE' }));
});

it('recusa exibir dados da gestão para sessão cidadã restaurada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ data: { id: 'demo', role: 'CITIZEN' } })));
    render(<ManagerAccess>{() => <p>Dados privados</p>}</ManagerAccess>);
    expect(await screen.findByText(/O painel exige uma conta de gestor/)).toBeVisible();
    expect(screen.queryByText('Dados privados')).toBeNull();
});

it('encerra a visão restaurada no horário original mesmo sem outra consulta', async () => {
    const now = Date.now();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(now);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'demo', role: 'MANAGER' } }), { headers: { 'Content-Type': 'application/json', 'X-Session-Expires-At': new Date(now + 2000).toISOString() } })));
    try {
        await act(async () => {
            render(<ManagerAccess>{() => <p>Conteúdo da gestão</p>}</ManagerAccess>);
        });
        expect(screen.getByText('Conteúdo da gestão')).toBeVisible();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });
        expect(screen.queryByText('Conteúdo da gestão')).toBeNull();
        expect(screen.getByText('Sua sessão expirou. Entre novamente.')).toBeVisible();
        expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
        vi.useRealTimers();
    }
});

it.each([null, 'inválido', '2020-01-01T10:00:00.000Z'])('exige novo login para sessão de gestor sem validade confirmada', async (expiresAt) => {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (expiresAt !== null) headers.set('X-Session-Expires-At', expiresAt);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'demo', role: 'MANAGER' } }), { headers })));
    render(<ManagerAccess>{() => <p>Conteúdo da gestão</p>}</ManagerAccess>);
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeVisible();
    expect(screen.queryByText('Conteúdo da gestão')).toBeNull();
});

it.each(['digitar', 'colar'])('formata o CPF ao %s e envia somente os onze dígitos', async (mode) => {
    const login = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(Response.json({ data: { user: { id: 'demo', role: 'MANAGER' }, expiresAt: new Date(Date.now() + 86400000).toISOString() } }));
    vi.stubGlobal('fetch', login);
    const user = userEvent.setup();
    render(<ManagerAccess>{() => <p>Denúncias recebidas</p>}</ManagerAccess>);
    const cpf = await screen.findByLabelText('CPF');
    await user.click(cpf);
    if (mode === 'digitar') {
        await user.keyboard('0000');
        expect(cpf).toHaveValue('000.0');
        await user.keyboard('0000003');
    } else await user.paste('  000.000.000-03  ');
    expect(cpf).toHaveValue('000.000.000-03');
    await user.type(screen.getByLabelText('Senha'), 'senha-de-teste');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Denúncias recebidas')).toBeVisible();
    expect(JSON.parse(login.mock.calls[1]![1].body).cpf).toBe('00000000003');
});

it('permite corrigir um dígito no meio e voltar pelo separador com Backspace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const user = userEvent.setup();
    render(<ManagerAccess>{() => null}</ManagerAccess>);
    const cpf = await screen.findByLabelText<HTMLInputElement>('CPF');
    await user.type(cpf, '12345678901');
    cpf.setSelectionRange(4, 5);
    await user.keyboard('9');
    expect(cpf).toHaveValue('123.956.789-01');
    expect(cpf.selectionStart).toBe(5);
    cpf.setSelectionRange(4, 4);
    await user.keyboard('{Backspace}');
    expect(cpf).toHaveValue('129.567.890-1');
    expect(cpf.selectionStart).toBe(2);
});

it('informa CPF incompleto antes de enviar credenciais', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', request);
    const user = userEvent.setup();
    render(<ManagerAccess>{() => null}</ManagerAccess>);
    const cpf = await screen.findByLabelText('CPF');
    await user.type(cpf, '123');
    await user.type(screen.getByLabelText('Senha'), 'senha-de-teste');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(cpf).toHaveFocus();
    expect(cpf).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Informe os 11 dígitos do CPF.');
    expect(request).toHaveBeenCalledTimes(1);
});

it('mostra um carregamento neutro ao restaurar a sessão sem piscar a tela de login', async () => {
    let restore!: (value: Response) => void;
    vi.stubGlobal(
        'fetch',
        vi.fn(
            () =>
                new Promise<Response>((done) => {
                    restore = done;
                }),
        ),
    );
    render(<ManagerAccess>{() => <p>Fila autenticada</p>}</ManagerAccess>);
    expect(screen.getByRole('status', { name: 'Carregando painel' })).toBeVisible();
    expect(screen.queryByLabelText('CPF')).toBeNull();
    expect(document.querySelector('img[src="/images/urban-neighborhood.svg"]')).toBeNull();
    await act(async () => restore(Response.json({ data: { role: 'MANAGER', id: 'teste' } }, { headers: { 'X-Session-Expires-At': new Date(Date.now() + 60000).toISOString() } })));
    expect(screen.getByText('Fila autenticada')).toBeVisible();
});
