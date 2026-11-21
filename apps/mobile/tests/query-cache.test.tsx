import { fetchWithServerTime } from '@mycity/contracts';
import { usePhotoExpiry } from '../src/use-photo-expiry';
import { useEffect } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { ApiFailure } from '../src/citizen-api';
import { QueryCacheProvider, useActiveQuery } from '../src/use-active-query';

const state = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
beforeEach(() => Object.defineProperty(AppState, 'currentState', { ...state, value: 'active' }));
afterEach(() => Object.defineProperty(AppState, 'currentState', state));

it('restores a confirmed query across navigation only in the same session', async () => {
    const pending = new Promise<string>(() => {});
    const load = jest.fn().mockResolvedValueOnce('Resultado confirmado').mockReturnValue(pending);
    function Page() {
        const query = useActiveQuery<string>(load, true, '/reports');
        return <Text>{query.data ?? 'Carregando'}</Text>;
    }
    const view = (session: string, visible: boolean) => <QueryCacheProvider key={session}>{visible && <Page />}</QueryCacheProvider>;
    const ui = await render(view('a', true));
    await waitFor(() => expect(screen.getByText('Resultado confirmado')).toBeTruthy());
    await ui.rerender(view('a', false));
    await ui.rerender(view('a', true));
    expect(screen.getByText('Resultado confirmado')).toBeTruthy();
    await ui.rerender(view('b', true));
    expect(screen.getByText('Carregando')).toBeTruthy();
});

it('ignores a delayed filter response after a newer selection', async () => {
    let finish!: (value: string) => void;
    const slow = () =>
        new Promise<string>((resolve) => {
            finish = resolve;
        });
    const fast = async () => 'Filtro atual';
    function Page({ first }: { first: boolean }) {
        const query = useActiveQuery(first ? slow : fast, true, first ? 'categoria-a' : 'categoria-b');
        return <Text>{query.data ?? 'Carregando'}</Text>;
    }
    const ui = await render(<Page first />);
    await ui.rerender(<Page first={false} />);
    await waitFor(() => expect(screen.getByText('Filtro atual')).toBeTruthy());
    await act(() => finish('Resposta atrasada'));
    expect(screen.getByText('Filtro atual')).toBeTruthy();
});

it.each([403, 404])('discards related cached and in-flight results after a %i response', async (status) => {
    let finish!: (value: string) => void;
    const delayed = new Promise<string>((resolve) => {
        finish = resolve;
    });
    const list = jest.fn().mockResolvedValueOnce('Resumo anterior').mockReturnValue(delayed);
    const deny = async () => {
        throw new ApiFailure(status);
    };
    function List() {
        const query = useActiveQuery<string>(list, true, '/reports');
        return <Text>{query.data ?? 'Lista sem dados'}</Text>;
    }
    function Detail() {
        const query = useActiveQuery(deny, true, '/reports/1');
        return <Text>{query.unavailable ? 'Indisponível' : 'Consultando'}</Text>;
    }
    const view = (show: boolean, detail: boolean) => (
        <QueryCacheProvider>
            {show && <List />}
            {detail && <Detail />}
        </QueryCacheProvider>
    );
    const ui = await render(view(true, false));
    await screen.findByText('Resumo anterior');
    await ui.rerender(view(false, false));
    await ui.rerender(view(true, true));
    await screen.findByText('Indisponível');
    expect(screen.queryByText('Resumo anterior')).toBeNull();
    await act(() => finish('Conteúdo revogado'));
    expect(screen.queryByText('Conteúdo revogado')).toBeNull();
    list.mockRejectedValue(new Error('offline'));
    await ui.rerender(view(false, false));
    await ui.rerender(view(true, false));
    expect(screen.getByText('Lista sem dados')).toBeVisible();
});

it('revalida em segundo plano sem redesenhar conteúdo idêntico', async () => {
    jest.useFakeTimers();
    try {
        const body = { label: 'Lista confirmada' };
        const load = jest.fn().mockResolvedValue(body);
        const committed = jest.fn();
        function Page() {
            const query = useActiveQuery<typeof body>(load, true, '/reports');
            useEffect(committed);
            return <Text>{query.data?.label}</Text>;
        }
        await render(
            <QueryCacheProvider>
                <Page />
            </QueryCacheProvider>,
        );
        expect(screen.getByText(body.label)).toBeVisible();
        committed.mockClear();
        await act(() => jest.advanceTimersByTimeAsync(5000));
        expect(load).toHaveBeenCalledTimes(2);
        expect(committed).not.toHaveBeenCalled();
    } finally {
        jest.useRealTimers();
    }
});

it('uma resposta de outra tela não redesenha uma lista sem fotos a vencer', async () => {
    const committed = jest.fn();
    function Page() {
        usePhotoExpiry([{}]);
        useEffect(committed);
        return <Text>Lista aberta</Text>;
    }
    await render(<Page />);
    committed.mockClear();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 304, headers: { 'X-MyCity-Server-Time': String(Date.now()) } }));
    try {
        await act(async () => {
            await fetchWithServerTime('https://example.test/api/v1/reports');
        });
        expect(committed).not.toHaveBeenCalled();
    } finally {
        jest.restoreAllMocks();
    }
});
