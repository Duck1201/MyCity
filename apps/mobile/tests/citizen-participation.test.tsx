import { categoryResponse } from './category-fixture';
import { AppState, Linking, Share } from 'react-native';
import App from '../src/app';
import * as SecureStore from 'expo-secure-store';
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CitizenWorkspace } from '../src/citizen-workspace';

jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('../src/report-photos', () => ({ pickReportPhoto: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'local-uuid' }));
const base = 'https://demo.test/api/v1';
const report = { id: 'p-4', category: 'POTHOLE', description: 'Pista quebrada', status: 'SENT', version: 1, confirmationCount: 0, confirmedByMe: false, isMine: false, allowedActions: ['CONFIRM'], photos: [], location: { latitude: 0, longitude: 0 }, createdAt: '2026-11-20T00:00:00Z' };
const page = (data: unknown[], nextCursor: string | null = null) => ({ data, page: { nextCursor } });
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;
const openApp = () => render(<CitizenWorkspace apiBase={base} token="sintetico" onSessionExpired={jest.fn()} draftRef={{ current: null }} />);
const currentState = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
beforeEach(() => {
    Object.defineProperty(AppState, 'currentState', { ...currentState, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => {
    Object.defineProperty(AppState, 'currentState', currentState);
    jest.restoreAllMocks();
});

it('filtra o feed por categoria e confirma e retira a participação através do detalhe', async () => {
    let confirmed = false;
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        const path = url.pathname.replace('/api/v1', '');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer sintetico' });
        if (path === '/categories') return categoryResponse();
        if (path === '/reports' && url.searchParams.get('scope') === 'mine') return response(page([]));
        if (path === '/reports') {
            expect(url.searchParams.get('scope')).toBe('feed');
            return response(page(url.searchParams.get('category') === 'POTHOLE' ? [report] : []));
        }
        if (path === '/reports/p-4/history') return response(page([]));
        if (path === '/reports/p-4/confirmation') {
            if (init?.method === 'PUT') confirmed = true;
            else if (init?.method === 'DELETE') confirmed = false;
            else throw Error('método inválido');
            return response({ data: { confirmed, confirmationCount: confirmed ? 1 : 0 } });
        }
        if (path === '/reports/p-4') return response({ data: { ...report, confirmedByMe: confirmed, confirmationCount: confirmed ? 1 : 0, allowedActions: [confirmed ? 'WITHDRAW' : 'CONFIRM'] } });
        throw Error('URL inesperada');
    });
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    await fireEvent.press(screen.getByText('Filtros'));
    await fireEvent.press(screen.getByRole('button', { name: 'Buraco na via' }));
    await fireEvent.press(await screen.findByText('Pista quebrada'));
    await fireEvent.press(await screen.findByText('Também vi isso'));
    expect(await screen.findByText('1 confirmação')).toBeVisible();
    await fireEvent.press(screen.getByText('Retirar confirmação'));
    expect(await screen.findByText('0 confirmações')).toBeVisible();
    expect(api.mock.calls.filter(([url]) => String(url).endsWith('/confirmation')).map(([, init]) => init?.method)).toEqual(['PUT', 'DELETE']);
});

it('carrega todas as páginas da área visível do mapa e abre a denúncia pelo segundo marcador', async () => {
    const points = ['map-1', 'map-2'].map((id, i) => ({ id, latitude: i / 10, longitude: i / 10, category: 'POTHOLE', status: 'SENT', confirmationCount: i }));
    const bounds: string[] = [];
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/categories')) return categoryResponse();
        if (url.pathname.endsWith('/reports/map')) {
            const bbox = url.searchParams.get('bbox')!;
            bounds.push(bbox);
            if (bbox !== '-1,-1,1,1') return response(page([]));
            return response(url.searchParams.get('cursor') === 'fim' ? page([points[1]]) : page([points[0]], 'fim'));
        }
        if (url.pathname.endsWith('/map-2')) return response({ data: { ...report, id: 'map-2' } });
        if (url.pathname.endsWith('/history')) return response(page([]));
        throw Error('rota inesperada');
    });
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    const initialRegion = screen.getByTestId('community-map').props.initialRegion;
    expect(initialRegion.latitude).toBeCloseTo(-20.7526, 2);
    expect(initialRegion.longitudeDelta).toBeLessThan(0.1);
    await fireEvent(screen.getByTestId('community-map'), 'regionChangeComplete', { latitude: 0, longitude: 0, latitudeDelta: 2, longitudeDelta: 2 });
    expect(await screen.findByText('2 denúncias nesta área')).toBeVisible();
    expect(screen.queryByText(/map-2/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver lista' }));
    expect(screen.getByText('Enviado · 1 confirmação')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver mapa' }));
    expect(screen.getByTestId('community-map').props.initialRegion.latitude).toBe(0);
    await fireEvent.press(screen.getByTestId('report-marker-map-2'));
    expect(await screen.findByText(report.description)).toBeVisible();
    expect(screen.queryByText('map-2')).toBeNull();
    expect(bounds.filter((v) => v === '-1,-1,1,1')).toHaveLength(2);
});

it('só cancela após confirmar e envia a versão exibida; conflito recarrega a situação atual', async () => {
    let changed = false;
    const sent = { ...report, isMine: true, version: 2, status: 'UNDER_REVIEW', allowedActions: ['CANCEL'] };
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/categories')) return categoryResponse();
        if (url.pathname.endsWith('/reports')) return response(page(url.searchParams.get('scope') === 'mine' ? [sent] : []));
        if (url.pathname.endsWith('/history')) return response(page([]));
        if (url.pathname.endsWith('/cancellation')) {
            expect(init?.method).toBe('POST');
            expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
            expect(JSON.parse(String(init?.body))).toEqual({ expectedVersion: 2 });
            changed = true;
            return response({}, 409);
        }
        return response({ data: changed ? { ...sent, version: 3, status: 'IN_PROGRESS', allowedActions: [] } : sent });
    });
    await openApp();
    expect(screen.getByRole('header', { name: 'Meus registros' })).toBeVisible();
    await fireEvent.press(await screen.findByText('Pista quebrada'));
    await fireEvent.press(await screen.findByText('Cancelar denúncia'));
    await fireEvent.press(screen.getByText('Manter denúncia'));
    expect(api.mock.calls.some(([u]) => String(u).endsWith('/cancellation'))).toBe(false);
    await fireEvent.press(screen.getByText('Cancelar denúncia'));
    await fireEvent.press(screen.getByText('Confirmar cancelamento'));
    expect(await screen.findByText('Status: Em andamento')).toBeVisible();
    expect(screen.queryByText('Cancelar denúncia')).toBeNull();
    expect(screen.getByText(/situação da denúncia mudou/)).toBeVisible();
});

it('abre link de denúncia rejeitada após login e compartilha somente seu endereço público autenticado', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('mycity://reports/p-4');
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        if (String(input).endsWith('/sessions')) return response({ data: { user: { id: 'leitor', role: 'CITIZEN' }, token: 'local', expiresAt: new Date(Date.now() + 86400000).toISOString() } }, 201);
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer local' });
        if (String(input).endsWith('/categories')) return categoryResponse();
        if (String(input).endsWith('/reports/p-4/history')) return response(page([]));
        if (String(input).endsWith('/reports/p-4')) return response({ data: { ...report, status: 'REJECTED', allowedActions: [] } });
        throw Error('rota inesperada');
    });
    await render(<App />);
    await fireEvent.changeText(await screen.findByLabelText('CPF'), '00000000002');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'somente-teste');
    expect(api).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Entrar'));
    expect(await screen.findByText('Status: Rejeitado')).toBeVisible();
    await fireEvent.press(screen.getByText('Compartilhar link'));
    expect(share).toHaveBeenCalledWith({ message: 'mycity://reports/p-4' });
});

it('mostra a foto de capa do feed com a sessão do cidadão apenas na origem da API', async () => {
    const path = '/api/v1/reports/p-4/photos/foto-1';
    const rows = [
        { ...report, coverPhoto: { contentPath: path } },
        { ...report, id: 'p-5', description: 'Outra rua', coverPhoto: { contentPath: 'https://externo.example/foto.jpg' } },
    ];
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => (String(input).endsWith('/categories') ? categoryResponse() : response(page(rows))));
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    expect(await screen.findByText(report.description)).toBeVisible();
    expect(screen.queryByText(report.id)).toBeNull();
    const cover = await screen.findByLabelText('Foto da ocorrência: Pista quebrada');
    expect(cover).toHaveProp('source', { uri: 'https://demo.test' + path, headers: { Authorization: 'Bearer sintetico' } });
    expect(screen.queryByLabelText('Foto da ocorrência: Outra rua')).toBeNull();
});

it('filtra o mapa pelo grupo cadastrado e apresenta seu nome no marcador e no detalhe', async () => {
    const option = { id: '5012d21a-c0a4-4184-bdb6-a728e273d0d3', name: 'Acessibilidade no passeio' };
    const marker = { id: report.id, category: option.id, categoryName: option.name, status: 'SENT', longitude: 0, latitude: 0, confirmationCount: 0 };
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer sintetico' });
        const url = new URL(String(input));
        if (url.pathname.endsWith('/categories')) return response({ data: [option] });
        if (url.pathname.endsWith('/reports/map')) return response(page(url.searchParams.get('category') === option.id ? [marker] : []));
        if (url.pathname.endsWith('/reports/' + report.id)) return response({ data: { ...report, category: option.id, categoryName: option.name } });
        if (url.pathname.endsWith('/history')) return response(page([]));
        throw Error('Rota inesperada');
    });
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    await fireEvent.press(screen.getByText('Filtros'));
    await fireEvent.press(await screen.findByRole('button', { name: option.name }));
    const pin = await screen.findByTestId('report-marker-' + report.id);
    expect(pin).toHaveProp('title', option.name);
    await fireEvent.press(pin);
    expect(await screen.findByText(option.name)).toBeVisible();
    expect(api.mock.calls.some(([url]) => new URL(String(url)).searchParams.get('category') === option.id)).toBe(true);
});

it('confirma pelo cartão, mantém o total da API no detalhe e permite desfazer no feed', async () => {
    let confirmed = false;
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const path = new URL(String(input)).pathname;
        const current = { ...report, confirmedByMe: confirmed, confirmationCount: 9 + Number(confirmed), allowedActions: [confirmed ? 'WITHDRAW' : 'CONFIRM'] };
        if (path.endsWith('/categories')) return categoryResponse();
        if (path.endsWith('/reports')) return response(page([current, { ...report, confirmationCount: 9, id: 'own', isMine: true, description: 'Minha ocorrência' }, { ...report, confirmationCount: 9, id: 'closed', status: 'RESOLVED', description: 'Ocorrência encerrada' }]));
        if (path.endsWith('/history')) return response(page([]));
        if (path.endsWith('/reports/p-4')) return response({ data: current });
        if (path.endsWith('/p-4/confirmation')) {
            expect(init?.headers).toMatchObject({ Authorization: 'Bearer sintetico' });
            confirmed = init?.method === 'PUT';
            return response({ data: { confirmed, confirmationCount: 9 + Number(confirmed) } });
        }
        throw Error('Rota inesperada');
    });
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Também vi isso, Pista quebrada' }));
    expect(await screen.findByText('10 confirmações')).toBeVisible();
    expect(screen.queryByRole('header', { name: 'Detalhes da denúncia' })).toBeNull();
    await fireEvent.press(screen.getByText('Pista quebrada'));
    expect(await screen.findByText('10 confirmações')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao feed' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Retirar confirmação, Pista quebrada' }));
    expect(await screen.findByRole('button', { name: 'Também vi isso, Pista quebrada' })).toBeVisible();
    expect(screen.getAllByText('9 confirmações')).toHaveLength(3);
    expect(api.mock.calls.filter(([url]) => String(url).endsWith('/confirmation')).map(([, init]) => init?.method)).toEqual(['PUT', 'DELETE']);
});

it('não aumenta a contagem quando a confirmação falha e remove a ação se a gestão encerrou a denúncia', async () => {
    let closed = false;
    let attempts = 0;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith('/categories')) return categoryResponse();
        if (path.endsWith('/reports')) return response(page([{ ...report, status: closed ? 'RESOLVED' : 'SENT', confirmationCount: 7 }]));
        if (path.endsWith('/confirmation') && init?.method === 'PUT') {
            attempts++;
            closed = attempts === 2;
            return response({}, closed ? 409 : 503);
        }
        throw Error('Rota inesperada');
    });
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    const action = 'Também vi isso, Pista quebrada';
    await fireEvent.press(await screen.findByRole('button', { name: action }));
    expect(await screen.findByText('Não foi possível confirmar a operação. Confira a denúncia antes de tentar novamente.')).toBeVisible();
    expect(screen.getByText('7 confirmações')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: action }));
    expect(await screen.findByText('Confirmações encerradas')).toBeVisible();
    expect(screen.getByText('A situação da denúncia mudou. Consulte a atualização.')).toBeVisible();
    expect(screen.queryByRole('button', { name: action })).toBeNull();
    expect(screen.getByText('7 confirmações')).toBeVisible();
});

it('mantém o aviso de conflito se a denúncia desaparecer do feed durante a confirmação', async () => {
    let visible = true;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith('/categories')) return categoryResponse();
        if (path.endsWith('/reports')) return response(page(visible ? [report] : []));
        if (path.endsWith('/p-4/confirmation')) {
            visible = false;
            return response({}, 409);
        }
        throw Error('Rota inesperada');
    });
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Também vi isso, Pista quebrada' }));
    expect(await screen.findByText('Nenhuma denúncia encontrada.')).toBeVisible();
    expect(screen.getByText('A situação da denúncia mudou. Consulte a atualização.')).toBeVisible();
    expect(screen.queryByText(/p-4/)).toBeNull();
});
