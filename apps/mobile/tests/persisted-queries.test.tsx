import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { CitizenAccess } from '../src/citizen-access';
import { CitizenAccessLayout } from '../src/components/citizen-login-screen';
import { QueryCacheProvider, useActiveQuery } from '../src/use-active-query';
import { useCitizenRequest } from '../src/citizen-api';

// The device file system is the external boundary: an in-memory stand-in keeps
// what the app writes so a later render can read it back like after a restart.
jest.mock('expo-file-system', () => {
    const files = new Map<string, string>();
    const uriOf = (parts: unknown[]) => parts.map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri)).join('/');
    class Directory {
        uri: string;
        constructor(...parts: unknown[]) {
            this.uri = uriOf(parts);
        }
        get exists() {
            return [...files.keys()].some((name) => name.startsWith(this.uri + '/'));
        }
        create() {}
        delete() {
            for (const name of [...files.keys()]) if (name.startsWith(this.uri + '/')) files.delete(name);
        }
    }
    class File {
        uri: string;
        constructor(...parts: unknown[]) {
            this.uri = uriOf(parts);
        }
        get exists() {
            return files.has(this.uri);
        }
        async text() {
            if (!files.has(this.uri)) throw new Error('missing');
            return files.get(this.uri)!;
        }
        write(content: string) {
            files.set(this.uri, content);
        }
        delete() {
            files.delete(this.uri);
        }
    }
    return { Directory, File, Paths: { cache: new Directory('cache') }, mockFiles: files };
});
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
const files: Map<string, string> = jest.requireMock('expo-file-system').mockFiles;

const state = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
beforeEach(() => {
    files.clear();
    Object.defineProperty(AppState, 'currentState', { ...state, value: 'active' });
});
afterEach(() => {
    Object.defineProperty(AppState, 'currentState', state);
    jest.restoreAllMocks();
});

const never = () => new Promise<string>(() => {});
function Page({ load, path }: { load: () => Promise<string>; path: string }) {
    const query = useActiveQuery<string>(load, true, path);
    return <Text>{query.data ?? 'Carregando'}</Text>;
}
const saved = () => waitFor(() => expect(files.size).toBeGreaterThan(0), { timeout: 3000 });

it('mostra a última leitura do mesmo cidadão logo depois de reabrir o app', async () => {
    const first = await render(
        <QueryCacheProvider owner="cidada-a">
            <Page load={async () => 'Minhas denúncias confirmadas'} path="/reports?scope=mine" />
        </QueryCacheProvider>,
    );
    await screen.findByText('Minhas denúncias confirmadas');
    await saved();
    await first.unmount();
    await render(
        <QueryCacheProvider owner="cidada-a">
            <Page load={never} path="/reports?scope=mine" />
        </QueryCacheProvider>,
    );
    expect(await screen.findByText('Minhas denúncias confirmadas')).toBeVisible();
});

it('não mostra a outro cidadão o que ficou guardado no aparelho', async () => {
    const first = await render(
        <QueryCacheProvider owner="cidada-a">
            <Page load={async () => 'Dado da cidadã A'} path="/reports?scope=mine" />
        </QueryCacheProvider>,
    );
    await screen.findByText('Dado da cidadã A');
    await saved();
    await first.unmount();
    await render(
        <QueryCacheProvider owner="cidadao-b">
            <Page load={never} path="/reports?scope=mine" />
        </QueryCacheProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText('Carregando')).toBeVisible();
    expect(screen.queryByText('Dado da cidadã A')).toBeNull();
});

it('ignora leituras guardadas há mais de sete dias', async () => {
    const start = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(start);
    const first = await render(
        <QueryCacheProvider owner="cidada-a">
            <Page load={async () => 'Leitura antiga'} path="/notifications" />
        </QueryCacheProvider>,
    );
    await screen.findByText('Leitura antiga');
    await saved();
    await first.unmount();
    clock.mockReturnValue(start + 7 * 86_400_000 + 1);
    await render(
        <QueryCacheProvider owner="cidada-a">
            <Page load={never} path="/notifications" />
        </QueryCacheProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText('Carregando')).toBeVisible();
});

it('não guarda no aparelho o feed nem o mapa da comunidade', async () => {
    await render(
        <QueryCacheProvider owner="cidada-a">
            <Page load={async () => 'Feed público'} path="/reports?scope=feed&limit=1" />
            <Page load={async () => 'Mapa público'} path="/reports/map?limit=100:area" />
            <Page load={async () => 'Categorias'} path="/categories" />
        </QueryCacheProvider>,
    );
    await screen.findByText('Feed público');
    await saved();
    const content = [...files.values()].join('\n');
    expect(content).toContain('Categorias');
    expect(content).not.toContain('Feed público');
    expect(content).not.toContain('Mapa público');
});

it.each(['sair', 'expirar'])('apaga as leituras guardadas ao %s', async (how) => {
    files.set('cache/mycity-queries/cidada-a.json', '{"marca":"dado privado"}');
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({ token: 'teste', expiresAt: Date.now() + 86400000, apiBase: 'https://demo.example/api/v1' }));
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    jest.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'cidada-a', role: 'CITIZEN' } }) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    const user = userEvent.setup();
    await render(
        <CitizenAccess apiBase="https://demo.example/api/v1">
            {(_token, expire, leave) => (
                <CitizenAccessLayout onLeave={how === 'sair' ? leave : expire}>
                    <Text>Área do cidadão</Text>
                </CitizenAccessLayout>
            )}
        </CitizenAccess>,
    );
    await screen.findByText('Área do cidadão');
    await user.press(screen.getByRole('button', { name: 'Sair' }));
    await screen.findByLabelText('CPF');
    expect([...files.keys()].filter((name) => name.startsWith('cache/mycity-queries/'))).toEqual([]);
});

it('revalida com If-None-Match e reaproveita a resposta anterior num 304', async () => {
    const fetcher = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: ['Primeira resposta'] }), { status: 200, headers: { 'Content-Type': 'application/json', ETag: 'W/"v1"' } }))
        .mockResolvedValueOnce(new Response(null, { status: 304 }));
    let request!: ReturnType<typeof useCitizenRequest>;
    function Probe() {
        request = useCitizenRequest('https://demo.example/api/v1', 'token', () => {});
        return null;
    }
    await render(
        <QueryCacheProvider owner="cidada-a">
            <Probe />
        </QueryCacheProvider>,
    );
    const signal = new AbortController().signal;
    expect(await request<{ data: string[] }>('/notifications', signal)).toEqual({ data: ['Primeira resposta'] });
    expect(await request<{ data: string[] }>('/notifications', signal)).toEqual({ data: ['Primeira resposta'] });
    const second = fetcher.mock.calls[1]![1] as RequestInit;
    expect((second.headers as Record<string, string>)['If-None-Match']).toBe('W/"v1"');
});

it('troca a leitura restaurada pela resposta da rede que já estava a caminho', async () => {
    files.set('cache/mycity-queries/cidada-a.json', JSON.stringify({ owner: 'cidada-a', entries: [['/reports?scope=mine', 'Leitura guardada', Date.now()]] }));
    const fresh = () => new Promise<string>((resolve) => setTimeout(() => resolve('Leitura da rede'), 30));
    await render(
        <QueryCacheProvider owner="cidada-a">
            <Page load={fresh} path="/reports?scope=mine" />
        </QueryCacheProvider>,
    );
    expect(await screen.findByText('Leitura guardada')).toBeVisible();
    expect(await screen.findByText('Leitura da rede')).toBeVisible();
});
