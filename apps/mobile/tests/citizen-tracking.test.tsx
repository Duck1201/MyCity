import { reportPhotoSource } from '../src/components/report-photo';
import { categoryResponse } from './category-fixture';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, BackHandler, type AppStateStatus } from 'react-native';
import App from '../src/app';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: '192.168.2.19:8081' } } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('../src/report-photos', () => ({ pickReportPhoto: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'request-test' }));
const base = 'http://192.168.2.19:3000/api/v1';
const report = { id: '9a8bcd73-e49e-478a-b976-76c0186af640', category: 'LIGHTING', description: 'Poste da praça', status: 'REJECTED', location: { source: 'GPS', latitude: -20, longitude: -42 }, photos: [], createdAt: '2026-11-01T12:00:00Z' };
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
        if (path === '/reports/' + report.id) return ok({ data: report });
        if (path === '/reports/' + report.id + '/history') return ok(page([event], 'pagina-2'));
        if (path === '/reports/' + report.id + '/history?cursor=pagina-2') return ok(page([{ ...event, id: 'e-2', type: 'REPLY', text: 'Resposta complementar' }]));
        throw Error('Rota inesperada');
    });
    await render(<App />);
    expect(await screen.findByRole('header', { name: 'Meus registros' })).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Nova denúncia' }));
    await fireEvent.changeText(await screen.findByLabelText('Descrição'), 'Rascunho preservado');
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText('Poste da praça')).toBeVisible();
    expect(screen.queryByText(new RegExp(report.id))).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir Iluminação pública' }).props.accessibilityHint).not.toContain(report.id);
    await fireEvent.press(screen.getByText('Poste da praça'));
    expect(await screen.findByText('Manutenção já realizada')).toBeVisible();
    expect(screen.getByText(report.description)).toBeVisible();
    expect(screen.queryByText(new RegExp(report.id))).toBeNull();
    await fireEvent.press(screen.getByText('Próxima página'));
    expect(await screen.findByText('Resposta complementar')).toBeVisible();
    await fireEvent.press(screen.getByText('Voltar aos meus registros'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar rascunho' }));
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
        if (path === '/reports/' + report.id) return ok({ data: report });
        if (path === '/reports/' + report.id + '/history') return ok(page([event]));
        if (path === '/notifications/n-1/read' && init?.method === 'PUT') {
            if (++readAttempts === 1) throw Error('Sem conexão');
            return ok({ data: { ...notice, readAt: report.createdAt } });
        }
        throw Error('Rota inesperada');
    });
    await render(<App />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Notificações' }));
    expect(screen.getByRole('button', { name: 'Notificações', selected: true })).toHaveStyle({ backgroundColor: 'rgba(255, 255, 255, 0.14)' });
    expect(await screen.findByText('Não lida')).toBeVisible();
    expect(screen.queryByText(new RegExp(report.id))).toBeNull();
    await fireEvent.press(screen.getByText('Não lida'));
    expect(await screen.findByText('Manutenção já realizada')).toBeVisible();
    await fireEvent.press(await screen.findByText('Tentar marcar como lida'));
    await fireEvent.press(screen.getByText('Voltar às notificações'));
    expect(await screen.findByText('Lida')).toBeVisible();
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/n-1/read'))).toHaveLength(2);
});

it('volta das notificações para as resolvidas e depois para o feed com filtros e página preservados', async () => {
    const listeners = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, listener) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
    });
    async function backOnAndroid() {
        let handled = false;
        await act(() => {
            handled = [...listeners].reverse().some((listener) => listener({ type: 'hardwareBackPress', timeStamp: 0 }) === true);
        });
        expect(handled).toBe(true);
    }
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = String(input).replace(base, '');
        if (path === '/categories') return categoryResponse();
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path === '/reports?scope=feed&category=POTHOLE') return ok(page([], 'feed-2'));
        if (path === '/reports?scope=feed&category=POTHOLE&cursor=feed-2') return ok(page([{ ...report, category: 'POTHOLE', status: 'SENT', description: 'Outra rua no feed' }]));
        if (path === '/reports?scope=resolved') return ok(page([], 'resolved-2'));
        if (path === '/reports?scope=resolved&cursor=resolved-2') return ok(page([{ ...report, status: 'RESOLVED', description: 'Via reparada' }]));
        return ok(page([]));
    });
    await render(<App />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Feed' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Buraco na via' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Próxima página' }));
    expect(await screen.findByText('Outra rua no feed')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Resolvidas' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Próxima página' }));
    expect(await screen.findByText('Via reparada')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByRole('header', { name: 'Avisos de atendimento' })).toBeVisible();
    await backOnAndroid();
    expect(await screen.findByText('Via reparada')).toBeVisible();
    await backOnAndroid();
    expect(await screen.findByText('Outra rua no feed')).toBeVisible();
    expect(screen.getByRole('button', { name: /Filtros.*Buraco na via/ })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Feed', selected: true })).toBeVisible();
    expect(listeners.size).toBe(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Resolvidas' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao feed' }));
    expect(await screen.findByText('Outra rua no feed')).toBeVisible();
});

it('oferece Voltar nas notificações e restaura o formulário com seu rascunho', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = String(input).replace(base, '');
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path === '/categories') return categoryResponse();
        return ok(page([]));
    });
    await render(<App />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Nova denúncia' }));
    await fireEvent.changeText(await screen.findByLabelText('Descrição'), 'Rascunho durante a navegação');
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByRole('header', { name: 'Avisos de atendimento' })).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByLabelText('Descrição')).toHaveProp('value', 'Rascunho durante a navegação');
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
        if (path === '/reports/' + report.id) return ok({ data: { ...report, status: 'UNDER_REVIEW' } });
        if (path === '/reports/' + report.id + '/history') return ok(page([reopened, closure]));
        throw Error('Rota inesperada');
    });
    await render(<App />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Notificações' }));
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
        if (path === '/reports/' + report.id) return ok({ data: publicReport });
        return ok(page([]));
    });
    await render(<App />);
    expect(await screen.findByText('Você ainda não registrou denúncias.')).toBeVisible();
    await fireEvent.press(await screen.findByRole('button', { name: 'Abrir ocorrência: Semáforo em manutenção' }));
    expect(await screen.findByText(publicReport.description)).toBeVisible();
    expect(screen.queryByText(new RegExp(report.id))).toBeNull();
    await fireEvent.press(screen.getByText('Voltar aos meus registros'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver feed' }));
    expect(await screen.findByRole('header', { name: 'Denúncias da comunidade' })).toBeVisible();
});

it('mantém o feed visível ao filtrar e restaura a rolagem após consultar um detalhe', async () => {
    const matched = { ...report, id: 'relato-da-via', category: 'POTHOLE', status: 'SENT', description: 'Buraco na esquina' };
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
        finish = resolve;
    });
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = String(input).replace(base, '');
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path === '/categories') return categoryResponse();
        if (path === '/reports?scope=feed') return ok(page([report]));
        if (path === '/reports?scope=feed&category=POTHOLE') return pending;
        if (path === '/reports/' + matched.id) return ok({ data: matched });
        return ok(page([]));
    });
    await render(<App />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Feed' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Filtros' }));
    expect(screen.queryByRole('button', { name: 'Nova denúncia' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Buraco na via' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByText(report.description)).toBeVisible();
    expect(screen.getByText(/Exibindo os resultados anteriores/)).toBeVisible();
    await act(async () => finish(ok(page([matched]))));
    await fireEvent.scroll(screen.getByTestId('report-list'), { nativeEvent: { contentOffset: { x: 0, y: 360 } } });
    expect(screen.queryByText(report.description)).toBeNull();
    await fireEvent.press(screen.getByText(matched.description));
    await fireEvent.press(await screen.findByRole('button', { name: 'Voltar ao feed' }));
    expect(screen.getByTestId('report-list')).toHaveProp('contentOffset', { x: 0, y: 360 });
    await fireEvent.press(screen.getByRole('tab', { name: 'Início' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    expect(screen.getByRole('button', { name: /Filtros.*Buraco na via/ })).toBeVisible();
    expect(screen.getByTestId('report-list')).toHaveProp('contentOffset', { x: 0, y: 360 });
});

it('recolhe a capa indisponível no feed e permite carregar a foto novamente no detalhe', async () => {
    const photo = { id: 'foto-teste', contentPath: '/api/v1/reports/registro/photos/foto-teste', width: 640, height: 480 };
    const readOversized = jest.fn();
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = String(input).replace(base, '');
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path === '/reports?scope=feed') return ok(page([{ ...report, coverPhoto: photo }]));
        if (path === '/reports/' + report.id) return ok({ data: { ...report, photos: [photo] } });
        if (String(input).endsWith('/photos/foto-teste')) return { ok: true, headers: new Headers({ 'Content-Type': 'image/jpeg', 'Content-Length': String(5 * 1024 * 1024 + 1) }), arrayBuffer: readOversized } as unknown as Response;
        return ok(page([]));
    });
    await render(<App />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Feed' }));
    const thumb = await screen.findByLabelText('Foto da ocorrência: ' + report.description);
    await fireEvent(thumb, 'error', { nativeEvent: { error: 'Image unavailable' } });
    expect(screen.queryByLabelText('Foto da ocorrência: ' + report.description)).toBeNull();
    await fireEvent.press(screen.getByText(report.description));
    const fullPhoto = await screen.findByLabelText('Foto 1 da denúncia');
    await fireEvent(fullPhoto, 'error', { nativeEvent: { error: 'Image unavailable' } });
    expect(screen.getByText('Foto 1 da denúncia indisponível.')).toBeVisible();
    expect(readOversized).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar carregar a foto 1 novamente' }));
    expect(await screen.findByLabelText('Foto 1 da denúncia')).toHaveProp('source', [{ uri: new URL(photo.contentPath, base).href, headers: { Authorization: 'Bearer token-teste' } }]);
});

it('resolve o caminho absoluto da foto no Android sem repetir o prefixo da API', () => {
    const { URL: AndroidURL } = jest.requireActual('react-native/Libraries/Blob/URL');
    const original = globalThis.URL;
    try {
        globalThis.URL = AndroidURL;
        const path = '/api/v1/reports/registro/photos/foto-teste';
        expect(reportPhotoSource(path, base, 'sessao-ficticia')?.uri).toBe('http://192.168.2.19:3000' + path);
        expect(reportPhotoSource('https://fora.example/foto.jpg', base, 'sessao-ficticia')).toBeUndefined();
    } finally {
        globalThis.URL = original;
    }
});

it('recupera a miniatura e a foto ampliada quando o carregador nativo rejeita a sessão', async () => {
    const photo = { id: 'foto-teste', contentPath: '/api/v1/reports/registro/photos/foto-teste', width: 20, height: 20 };
    const file = new Uint8Array([255, 216, 255, 217]);
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url === base + '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (url === base + '/reports?scope=feed') return ok(page([{ ...report, coverPhoto: photo }]));
        if (url === base + '/reports/' + report.id) return ok({ data: { ...report, photos: [photo] } });
        if (url.endsWith('/photos/foto-teste')) return { ok: true, url, headers: new Headers({ 'Content-Type': 'image/jpeg', 'Content-Length': '4' }), arrayBuffer: async () => file.buffer } as Response;
        return ok(page([]));
    });
    await render(<App />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Feed' }));
    const label = 'Foto da ocorrência: ' + report.description;
    await fireEvent(await screen.findByLabelText(label), 'error', { nativeEvent: { error: '401' } });
    expect(screen.getByLabelText(label)).toHaveProp('source', [{ uri: 'data:image/jpeg;base64,/9j/2Q==' }]);
    await fireEvent.press(screen.getByText(report.description));
    await fireEvent(await screen.findByLabelText('Foto 1 da denúncia'), 'error', { nativeEvent: { error: '401' } });
    expect(screen.getByLabelText('Foto 1 da denúncia')).toHaveProp('source', [{ uri: 'data:image/jpeg;base64,/9j/2Q==' }]);
    const downloads = api.mock.calls.filter(([url]) => String(url).endsWith('/photos/foto-teste'));
    expect(downloads).toHaveLength(2);
    for (const [, init] of downloads) expect(init).toMatchObject({ headers: { Authorization: 'Bearer token-teste' }, redirect: 'error' });
});
