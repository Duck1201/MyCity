import { categoryResponse } from './category-fixture';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import App from '../src/app';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: '192.168.2.19:8081' } } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('../src/report-photos', () => ({ pickReportPhoto: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'request-test' }));
const base = 'http://192.168.2.19:3000/api/v1';
const report = { id: 'protocolo-3', category: 'LIGHTING', description: 'Poste da praça', status: 'REJECTED', location: { source: 'GPS', latitude: -20, longitude: -42 }, photos: [], createdAt: '2026-11-01T12:00:00Z' };
const event = { id: 'e-1', type: 'STATUS_CHANGED', actorRole: 'MANAGER', fromStatus: 'UNDER_REVIEW', toStatus: 'REJECTED', text: 'Manutenção já realizada', createdAt: report.createdAt };
const notice = { id: 'n-1', reportId: report.id, status: 'REJECTED', createdAt: report.createdAt, readAt: null };
const page = (data: unknown[], nextCursor: string | null = null) => ({ data, page: { nextCursor } });
const ok = (value: unknown) => ({ ok: true, status: 200, json: async () => value }) as Response;
const currentState = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
beforeEach(() => {
    Object.defineProperty(AppState, 'currentState', { ...currentState, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });

    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify({ apiBase: base, token: 'token-teste', expiresAt: Date.now() + 86400000 }));
});
afterEach(() => {
    Object.defineProperty(AppState, 'currentState', currentState);
    jest.restoreAllMocks();
    jest.useRealTimers();
});

it('preserva o rascunho ao acompanhar o histórico da própria denúncia e as respostas após o encerramento', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-teste' });
        const path = String(input).replace(base, '');
        if (path === '/categories') return categoryResponse();
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path === '/reports?scope=mine') return ok(page([report]));
        if (path === '/reports/protocolo-3') return ok({ data: report });
        if (path === '/reports/protocolo-3/history') return ok(page([event], 'pagina-2'));
        if (path === '/reports/protocolo-3/history?cursor=pagina-2') return ok(page([{ ...event, id: 'e-2', type: 'REPLY', text: 'Resposta complementar' }]));
        throw Error('Rota inesperada');
    });
    await render(<App />);
    expect(await screen.findByRole('header', { name: 'Meus registros' })).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Nova denúncia' }));
    await fireEvent.changeText(await screen.findByLabelText('Descrição'), 'Rascunho preservado');
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    await fireEvent.press(await screen.findByText('Poste da praça'));
    expect(await screen.findByText('Manutenção já realizada')).toBeVisible();
    expect(screen.getByText('protocolo-3')).toBeVisible();
    await fireEvent.press(screen.getByText('Próxima página'));
    expect(await screen.findByText('Resposta complementar')).toBeVisible();
    await fireEvent.press(screen.getByText('Voltar aos meus registros'));
    await fireEvent.press(screen.getByText('Continuar rascunho'));
    expect(screen.getByLabelText('Descrição')).toHaveProp('value', 'Rascunho preservado');
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('authorId'))).toBe(false);
});

it('abre o aviso, permite repetir uma leitura que falhou e exibe o estado confirmado pelo servidor', async () => {
    let readAttempts = 0;
    const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const path = String(input).replace(base, '');
        if (path === '/categories') return categoryResponse();
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path === '/notifications') return ok(page([{ ...notice, readAt: readAttempts > 1 ? report.createdAt : null }]));
        if (path === '/reports/protocolo-3') return ok({ data: report });
        if (path === '/reports/protocolo-3/history') return ok(page([event]));
        if (path === '/notifications/n-1/read' && init?.method === 'PUT') {
            if (++readAttempts === 1) throw Error('Sem conexão');
            return ok({ data: { ...notice, readAt: report.createdAt } });
        }
        throw Error('Rota inesperada');
    });
    await render(<App />);
    await fireEvent.press(await screen.findByText('Notificações'));
    await fireEvent.press(await screen.findByText('Não lida'));
    expect(await screen.findByText('Manutenção já realizada')).toBeVisible();
    await fireEvent.press(await screen.findByText('Tentar marcar como lida'));
    await fireEvent.press(screen.getByText('Voltar às notificações'));
    expect(await screen.findByText('Lida')).toBeVisible();
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/n-1/read'))).toHaveLength(2);
});

it('consulta a cada cinco segundos, preserva a lista na falha e pausa quando o app vai para segundo plano', async () => {
    jest.useFakeTimers();
    let changeState: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
        changeState = handler as typeof changeState;
        return { remove: jest.fn() };
    });
    let resolvePage: ((res: Response) => void) | undefined;
    let calls = 0;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = String(input).replace(base, '');
        if (path === '/reports?scope=feed&limit=1') return ok(page([]));
        if (path === '/categories') return categoryResponse();
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path === '/reports?scope=mine') {
            calls++;
            if (calls === 1) return ok(page([report]));
            if (calls === 2) throw Error('Sem rede');
            return new Promise((resolve) => {
                resolvePage = resolve;
            });
        }
        throw Error('Rota inesperada');
    });
    await render(<App />);
    expect(await screen.findByRole('header', { name: 'Meus registros' })).toBeVisible();
    expect(await screen.findByText('Poste da praça')).toBeVisible();
    await act(async () => jest.advanceTimersByTime(5000));
    expect(screen.getByText(/Não foi possível atualizar/)).toBeVisible();
    expect(screen.getByText('Poste da praça')).toBeVisible();
    await act(async () => jest.advanceTimersByTime(5000));
    expect(calls).toBe(3);
    await act(async () => jest.advanceTimersByTime(10000));
    expect(calls).toBe(3);
    await act(async () => {
        changeState?.('background');
        resolvePage?.(ok(page([])));
        jest.advanceTimersByTime(10000);
    });
    expect(screen.getByText('Poste da praça')).toBeVisible();
    expect(calls).toBe(3);
    await act(async () => {
        changeState?.('active');
    });
    expect(calls).toBe(4);
});

it.each(['RESOLVED', 'REJECTED', 'CANCELED'])('identifica reabertura de %s no aviso e no histórico preservando o encerramento anterior', async (fromStatus) => {
    const closure = { ...event, fromStatus: fromStatus === 'RESOLVED' ? 'IN_PROGRESS' : 'UNDER_REVIEW', toStatus: fromStatus, text: 'Registro de encerramento anterior' };
    const reopened = { ...event, id: 'e-reopen', fromStatus, toStatus: 'UNDER_REVIEW', text: 'Necessidade de nova avaliação' };
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = String(input).replace(base, '');
        if (path === '/categories') return categoryResponse();
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path === '/notifications') return ok(page([{ ...notice, readAt: notice.createdAt, status: 'UNDER_REVIEW', fromStatus }]));
        if (path === '/reports/protocolo-3') return ok({ data: { ...report, status: 'UNDER_REVIEW' } });
        if (path === '/reports/protocolo-3/history') return ok(page([reopened, closure]));
        throw Error('Rota inesperada');
    });
    await render(<App />);
    await fireEvent.press(await screen.findByText('Notificações'));
    await fireEvent.press(await screen.findByText('Atendimento reaberto para análise'));
    expect(await screen.findByText('Atendimento reaberto para análise')).toBeVisible();
    expect(screen.getByText('Necessidade de nova avaliação')).toBeVisible();
    expect(screen.getByText('Registro de encerramento anterior')).toBeVisible();
});

it('apresenta uma ocorrência pública no Início mesmo sem registros pessoais e abre seu detalhe', async () => {
    const publicReport = { ...report, status: 'SENT', description: 'Semáforo em manutenção' };
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = String(input).replace(base, '');
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path === '/categories') return categoryResponse();
        if (path === '/reports?scope=feed&limit=1') return ok(page([publicReport]));
        if (path === '/reports/protocolo-3') return ok({ data: publicReport });
        return ok(page([]));
    });
    await render(<App />);
    expect(await screen.findByText('Você ainda não registrou denúncias.')).toBeVisible();
    await fireEvent.press(await screen.findByRole('button', { name: 'Abrir ocorrência: Semáforo em manutenção' }));
    expect(await screen.findByText('protocolo-3')).toBeVisible();
    await fireEvent.press(screen.getByText('Voltar aos meus registros'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver feed' }));
    expect(await screen.findByRole('header', { name: 'Denúncias da comunidade' })).toBeVisible();
});
