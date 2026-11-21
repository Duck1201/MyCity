import { categoryResponse } from './category-fixture';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { CitizenWorkspace } from '../src/citizen-workspace';

jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('../src/report-photos', () => ({ pickReportPhoto: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'request-test' }));

const base = 'https://demo.example/api/v1';
const scenarios = [
    { id: 'chuva', level: 'ATTENTION', title: 'Possibilidade de chuva' },
    { id: 'vento', level: 'ALERT', title: 'Vento intenso' },
    { id: 'alagamento', level: 'EMERGENCY', title: 'Alagamento em via urbana' },
].map((s) => ({ ...s, regionLabel: 'Vale do Sol', message: 'O cenário fictício registra alteração nas condições do tempo.', issuedAt: '2026-11-25T12:00:00.000Z', expiresAt: '2026-11-25T16:00:00.000Z', simulated: true }));
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const page = (data: unknown[], nextCursor: string | null = null) => ok({ data, page: { nextCursor } });
async function enter(onSessionExpired = jest.fn()) {
    await render(<CitizenWorkspace token="token-cidadao" apiBase={base} onSessionExpired={onSessionExpired} draftRef={{ current: null }} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Alertas' }));
}
const originalState = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
beforeEach(() => {
    Object.defineProperty(AppState, 'currentState', { ...originalState, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => {
    Object.defineProperty(AppState, 'currentState', originalState);
    jest.restoreAllMocks();
});

it('identifica os três níveis e abre o detalhe simulado usando a sessão do cidadão', async () => {
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-cidadao' });
        if (String(input) === base + '/categories') return categoryResponse();
        if (String(input) === base + '/weather-alerts') return page(scenarios);
        if (String(input) === base + '/weather-alerts/alagamento') return ok({ data: scenarios[2] });
        throw Error('Consulta inesperada');
    });
    await enter();
    expect(await screen.findByText('Atenção')).toBeVisible();
    expect(screen.getByText('Alerta')).toBeVisible();
    expect(screen.getByText('Emergência')).toBeVisible();
    expect(screen.getByText('Simulação climática')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Emergência, Alagamento em via urbana, Vale do Sol' }));
    expect(await screen.findByText(scenarios[2]!.message)).toBeVisible();
    expect(screen.getByText('Simulação climática')).toBeVisible();
    expect(screen.getByText('Vale do Sol')).toBeVisible();
    expect(screen.getByText('Início do cenário')).toBeVisible();
    expect(screen.getByText('Fim do cenário')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar aos alertas' }));
    expect(await screen.findByText('Atenção')).toBeVisible();
    expect(api.mock.calls.some(([url]) => String(url).includes('/notifications'))).toBe(false);
});

it('mostra carregamento, mensagem de erro e lista vazia após repetir uma consulta', async () => {
    let fail!: (error: Error) => void;
    const pending = new Promise<Response>((_resolve, reject) => {
        fail = reject;
    });
    let alertReads = 0;
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        if (String(input) === base + '/weather-alerts') return ++alertReads === 1 ? pending : page([]);
        return page([]);
    });
    await enter();
    expect(screen.getByRole('progressbar', { name: 'Carregando cenários…' })).toBeVisible();
    expect(screen.queryByText('Cenários fictícios de 25 de novembro de 2026.')).toBeNull();
    await act(async () => {
        fail(new Error('offline'));
    });
    expect(await screen.findByText(/Não foi possível consultar/)).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Nenhum cenário disponível.')).toBeVisible();
    expect(api.mock.calls.map(([url]) => String(url)).sort()).toEqual(['/reports?scope=mine', '/reports?scope=feed&limit=1', '/weather-alerts', '/weather-alerts'].map((path) => base + path).sort());
});

it('mantém a página de origem ao voltar de um cenário indisponível', async () => {
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        if (String(input) === base + '/categories') return categoryResponse();
        if (String(input) === base + '/weather-alerts') return page([scenarios[0]], 'chuva');
        if (String(input) === base + '/weather-alerts?cursor=chuva') return page(scenarios.slice(1));
        if (String(input) === base + '/weather-alerts/vento') return { ok: false, status: 404 } as Response;
        throw Error('Rota inesperada');
    });
    await enter();
    await fireEvent.press(await screen.findByText('Próxima página'));
    expect(await screen.findByText('Página 2')).toBeVisible();
    await fireEvent.press(screen.getByText('Vento intenso'));
    expect(await screen.findByText('Este cenário está indisponível.')).toBeVisible();
    expect(screen.queryByText('Vento intenso')).toBeNull();
    await fireEvent.press(screen.getByText('Voltar aos alertas'));
    expect(await screen.findByText('Página 2')).toBeVisible();
    expect(api.mock.calls.filter(([url]) => String(url).includes('?cursor=chuva'))).toHaveLength(2);
});

it('exige novo login se a sessão expirar ao abrir o detalhe', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        if (String(input) === base + '/weather-alerts/vento') return { ok: false, status: 401 } as Response;
        if (String(input) === base + '/weather-alerts') return page(scenarios);
        return page([]);
    });
    const expire = jest.fn();
    await enter(expire);
    await fireEvent.press(await screen.findByText('Vento intenso'));
    expect(expire).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(scenarios[1]!.message)).toBeNull();
});

it('retorna ao detalhe do alerta após consultar notificações e abrir o formulário flutuante', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        if (String(input) === base + '/weather-alerts') return page([scenarios[0]], 'mais');
        if (String(input) === base + '/weather-alerts?cursor=mais') return page(scenarios.slice(1));
        if (String(input) === base + '/weather-alerts/vento') return ok({ data: scenarios[1] });
        if (String(input) === base + '/categories') return categoryResponse();
        return page([]);
    });
    await enter();
    await fireEvent.press(await screen.findByRole('button', { name: 'Próxima página' }));
    await fireEvent.press(await screen.findByText('Vento intenso'));
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText(scenarios[1]!.message)).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Nova denúncia' }));
    expect(await screen.findByLabelText('Descrição')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Nova denúncia' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText(scenarios[1]!.message)).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar aos alertas' }));
    expect(await screen.findByText('Página 2')).toBeVisible();
});
