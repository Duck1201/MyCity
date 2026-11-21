import { categoryResponse } from './category-fixture';
import { AccessibilityInfo, Animated, AppState, Linking, Share } from 'react-native';
import * as Location from 'expo-location';
import App from '../src/app';
import * as SecureStore from 'expo-secure-store';
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryCacheProvider } from '../src/query-cache';
import { CitizenWorkspace } from '../src/citizen-workspace';

jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('expo-location', () => ({
    Accuracy: { Balanced: 3, High: 4 },
    hasServicesEnabledAsync: jest.fn(),
    getLastKnownPositionAsync: jest.fn(),
    requestForegroundPermissionsAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
    watchPositionAsync: jest.fn(),
}));
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
    jest.mocked(Location.requestForegroundPermissionsAsync)
        .mockReset()
        .mockResolvedValue({ granted: false } as Location.PermissionResponse);
    jest.mocked(Location.watchPositionAsync).mockReset();
    jest.mocked(Location.hasServicesEnabledAsync).mockReset().mockResolvedValue(true);
    jest.mocked(Location.getLastKnownPositionAsync).mockReset().mockResolvedValue(null);
});
afterEach(() => {
    Object.defineProperty(AppState, 'currentState', currentState);
    jest.restoreAllMocks();
});

it('troca de aba e abre uma denúncia sem animar a superfície inteira', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/history')) return response(page([]));
        if (url.pathname.endsWith('/p-4')) return response({ data: report });
        return response(page(url.searchParams.get('scope') === 'feed' ? [report] : []));
    });
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    await fireEvent.press(await screen.findByText(report.description));
    await fireEvent.press(await screen.findByRole('button', { name: 'Voltar ao feed' }));
    expect(await screen.findByText(report.description)).toBeVisible();
    expect(timing.mock.calls.filter(([, config]) => config.toValue === 0 && config.duration === 190)).toHaveLength(2);
    expect(timing.mock.calls.filter(([, config]) => config.toValue === 1)).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Resolvidas' }));
    expect(screen.getByRole('header', { name: 'Histórico de resolvidas' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Feed', selected: true })).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByRole('header', { name: 'Avisos de atendimento' })).toBeVisible();
});

it('centraliza a câmera com uma leitura pontual e consulta uma área aproximada sem contar pontos fora da tela', async () => {
    let locate!: Location.LocationCallback;
    const gps = { latitude: -19.904723, longitude: -43.907391 };
    const remove = jest.fn();
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: true } as Location.PermissionResponse);
    jest.mocked(Location.watchPositionAsync).mockImplementationOnce(async (_, callback) => {
        locate = callback;
        return { remove };
    });
    const nearby = { id: 'nearby', ...gps, category: 'POTHOLE', status: 'SENT', confirmationCount: 0 };
    const outside = { ...nearby, id: 'outside', latitude: -19.919 };
    const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => response(page(String(input).includes('/reports/map') ? [nearby, outside] : [])));
    await openApp();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByText('Buscando sua localização…')).toBeVisible();
    expect(screen.getByTestId('community-map').props.initialRegion.latitude).toBeCloseTo(-20.7526);
    expect(fetch.mock.calls.some(([input]) => String(input).includes('/reports/map'))).toBe(true);
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
    await act(() => locate({ coords: gps } as Location.LocationObject));
    const map = await screen.findByTestId('community-map');
    expect(map.props.initialRegion).toMatchObject(gps);
    expect(map).not.toHaveProp('showsUserLocation', true);
    expect(screen.getByTestId('device-location')).toHaveProp('coordinate', gps);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('1 denúncia nesta área')).toBeVisible();
    expect(screen.getByTestId('report-marker-nearby')).toBeVisible();
    expect(screen.queryByTestId('report-marker-outside')).toBeNull();
    const requests = fetch.mock.calls.filter(([input]) => String(input).includes('/reports/map'));
    expect(requests).toHaveLength(2);
    const bounds = new URL(String(requests[1]?.[0])).searchParams.get('bbox')?.split(',').map(Number) ?? [];
    expect(bounds).toEqual([-43.92, -19.92, -43.89, -19.89]);
    await fireEvent.press(screen.getByRole('tab', { name: 'Início' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByTestId('community-map').props.initialRegion).toMatchObject(gps);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
});

it('recentraliza no ponto recente do Android e identifica quando uma nova leitura falha', async () => {
    const coords = { latitude: -19.9, longitude: -43.9, accuracy: 22 };
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ granted: true } as Location.PermissionResponse);
    jest.mocked(Location.getLastKnownPositionAsync).mockResolvedValueOnce({ coords, timestamp: Date.now() } as Location.LocationObject);
    jest.mocked(Location.watchPositionAsync).mockResolvedValue({ remove: jest.fn() });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(page([])));
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByTestId('device-location')).toHaveProp('coordinate', { latitude: coords.latitude, longitude: coords.longitude });
    expect(screen.getByTestId('community-map').props.initialRegion).toMatchObject({ latitude: coords.latitude, longitude: coords.longitude });
    expect(Location.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 30000, requiredAccuracy: 100 });
    jest.mocked(Location.watchPositionAsync).mockRejectedValueOnce(new Error('indisponível'));
    await fireEvent.press(screen.getByRole('button', { name: 'Minha localização' }));
    expect(Location.watchPositionAsync).toHaveBeenCalledWith(expect.objectContaining({ accuracy: Location.Accuracy.High, distanceInterval: 0, timeInterval: 1000 }), expect.any(Function), expect.any(Function));
    expect(screen.getByText(/última localização/i)).toBeVisible();
});

it('ignora o ponto conhecido quando a localização do sistema foi desligada', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ granted: true } as Location.PermissionResponse);
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);
    jest.mocked(Location.watchPositionAsync).mockResolvedValue({ remove: jest.fn() });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(page([])));
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByText(/GPS indisponível/)).toBeVisible();
    expect(Location.getLastKnownPositionAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId('device-location')).toBeNull();
});

it('preserva a área explorada quando a primeira leitura de GPS chega atrasada', async () => {
    let locate!: Location.LocationCallback;
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: true } as Location.PermissionResponse);
    jest.mocked(Location.watchPositionAsync).mockImplementationOnce(async (_, callback) => {
        locate = callback;
        return { remove: jest.fn() };
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(page([])));
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    const explored = { latitude: -20.8, longitude: -42.8, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    await fireEvent(screen.getByTestId('community-map'), 'regionChangeComplete', explored, { isGesture: true });
    const gps = { latitude: -20.7, longitude: -42.7 };
    await act(() => locate({ coords: gps } as Location.LocationObject));
    expect(screen.getByTestId('device-location')).toHaveProp('coordinate', gps);
    await fireEvent.press(screen.getByRole('button', { name: 'Ver lista' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver mapa' }));
    expect(screen.getByTestId('community-map')).toHaveProp('initialRegion', explored);
});

it('abre a área de Viçosa quando o GPS demora e ignora respostas que chegam depois do limite', async () => {
    jest.useFakeTimers();
    try {
        let locate!: Location.LocationCallback;
        const remove = jest.fn();
        jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: true } as Location.PermissionResponse);
        jest.mocked(Location.watchPositionAsync).mockImplementationOnce(async (_, callback) => {
            locate = callback;
            return { remove };
        });
        jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(page([])));
        await openApp();
        await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
        await act(() => jest.advanceTimersByTimeAsync(6000));
        expect(remove).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/GPS indisponível/)).toBeVisible();
        const city = screen.getByTestId('community-map').props.initialRegion;
        expect(city.latitude).toBeCloseTo(-20.7526);
        await act(() => locate({ coords: { latitude: -19.9, longitude: -43.9 } } as Location.LocationObject));
        expect(screen.getByTestId('community-map').props.initialRegion).toEqual(city);
    } finally {
        jest.useRealTimers();
    }
});

it('remove a aquisição se o cidadão sai do mapa antes de o Android entregar a inscrição', async () => {
    const remove = jest.fn();
    let registered!: (subscription: Location.LocationSubscription) => void;
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: true } as Location.PermissionResponse);
    jest.mocked(Location.watchPositionAsync).mockReturnValueOnce(
        new Promise((resolve) => {
            registered = resolve;
        }),
    );
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(page([])));
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('tab', { name: 'Início' }));
    await act(() => registered({ remove }));
    expect(remove).toHaveBeenCalledTimes(1);
});

it('interrompe a aquisição ao colocar o app em segundo plano', async () => {
    let background!: (state: 'background') => void;
    const remove = jest.fn();
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: true } as Location.PermissionResponse);
    jest.mocked(Location.watchPositionAsync).mockImplementationOnce(async () => {
        background = jest.mocked(AppState.addEventListener).mock.lastCall![1];
        return { remove };
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(page([])));
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    await act(() => background('background'));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/GPS indisponível/)).toBeVisible();
});

it('envia limites aproximados nos dois lados do antimeridiano e mantém os pontos visíveis', async () => {
    const points = [
        { id: 'west', latitude: 0, longitude: 179.997, category: 'POTHOLE', status: 'SENT', confirmationCount: 0 },
        { id: 'east', latitude: 0, longitude: -179.998, category: 'POTHOLE', status: 'SENT', confirmationCount: 0 },
    ];
    const bounds: string[] = [];
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const box = new URL(String(input)).searchParams.get('bbox');
        if (box) bounds.push(box);
        return response(page(box?.endsWith(',180,0.01') ? [points[0]] : box?.startsWith('-180,-0.01,') ? [points[1]] : []));
    });
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    await fireEvent(screen.getByTestId('community-map'), 'regionChangeComplete', { latitude: 0, longitude: 179.999, latitudeDelta: 0.013, longitudeDelta: 0.013 });
    expect(bounds.slice(-2)).toEqual(['179.99,-0.01,180,0.01', '-180,-0.01,-179.99,0.01']);
    expect(await screen.findByText('2 denúncias nesta área')).toBeVisible();
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
        if (path === '/reports/p-4/history?order=newest') return response(page([]));
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
    await fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Buraco na via' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await fireEvent.press(await screen.findByText('Pista quebrada'));
    await fireEvent.press(await screen.findByText('Também vi isso'));
    expect(await screen.findByText('1 confirmação')).toBeVisible();
    await fireEvent.press(screen.getByText('Retirar confirmação'));
    expect(await screen.findByText('0 confirmações')).toBeVisible();
    expect(api.mock.calls.filter(([url]) => String(url).endsWith('/confirmation')).map(([, init]) => init?.method)).toEqual(['PUT', 'DELETE']);
});

it('carrega as páginas do mapa, abre pelo resumo e restaura a seleção com movimento reduzido', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
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
    expect(screen.getByTestId('community-map')).toHaveProp('showsUserLocation', false);
    expect(screen.getByText(/Localização sem permissão/)).toBeVisible();
    await fireEvent(screen.getByTestId('community-map'), 'regionChangeComplete', { latitude: 0, longitude: 0, latitudeDelta: 2, longitudeDelta: 2 });
    expect(await screen.findByText('2 denúncias nesta área')).toBeVisible();
    expect(screen.queryByText(/map-2/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver lista' }));
    expect(screen.getByText('Enviado · 1 confirmação')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver mapa' }));
    expect(screen.getByTestId('community-map').props.initialRegion.latitude).toBe(0);
    await fireEvent.press(screen.getByTestId('report-marker-map-2'));
    expect(screen.getByTestId('community-map')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver denúncia' }));
    expect(await screen.findByText(report.description)).toBeVisible();
    expect(screen.queryByText('map-2')).toBeNull();
    expect(bounds.filter((v) => v === '-1,-1,1,1')).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao mapa' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ver denúncia' })).toBeVisible());
    expect(screen.getByTestId('community-map').props.initialRegion.latitude).toBe(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar resumo' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ver denúncia' })).toBeNull());
});

it('lista as denúncias de um grupo no mesmo ponto e abre o resumo da escolhida', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const points = [
        { id: 'grupo-1', latitude: 0.1, longitude: 0.1, category: 'POTHOLE', status: 'SENT', confirmationCount: 0 },
        { id: 'grupo-2', latitude: 0.1, longitude: 0.1, category: 'POTHOLE', status: 'UNDER_REVIEW', confirmationCount: 2 },
    ];
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/categories')) return categoryResponse();
        if (url.pathname.endsWith('/reports/map')) return response(page(url.searchParams.get('bbox') === '-1,-1,1,1' ? points : []));
        throw Error('rota inesperada');
    });
    await openApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    await fireEvent(screen.getByTestId('community-map').parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } } });
    await fireEvent(screen.getByTestId('community-map'), 'regionChangeComplete', { latitude: 0, longitude: 0, latitudeDelta: 2, longitudeDelta: 2 });
    expect(await screen.findByText('2 denúncias nesta área')).toBeVisible();
    expect(screen.queryByTestId('report-marker-grupo-1')).toBeNull();
    await fireEvent.press(screen.getByLabelText('2 denúncias próximas'));
    expect(screen.getByRole('header', { name: '2 denúncias próximas' })).toBeVisible();
    expect(screen.getByText('Enviado · 0 confirmações')).toBeVisible();
    await fireEvent.press(screen.getByText('Em análise · 2 confirmações'));
    expect(screen.queryByRole('header', { name: '2 denúncias próximas' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver denúncia' })).toBeVisible();
    expect(screen.getByText(/Em análise/)).toBeVisible();
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
    expect(screen.queryByRole('button', { name: 'Nova denúncia' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar denúncia' })).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'Ações da denúncia' }));
    await fireEvent.press(await screen.findByText('Cancelar denúncia'));
    await fireEvent.press(screen.getByText('Manter denúncia'));
    expect(api.mock.calls.some(([u]) => String(u).endsWith('/cancellation'))).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Ações da denúncia' }));
    await fireEvent.press(screen.getByText('Cancelar denúncia'));
    await fireEvent.press(screen.getByText('Confirmar cancelamento'));
    expect(await screen.findByText('Status: Em andamento')).toBeVisible();
    expect(screen.getByText(/situação da denúncia mudou/)).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Ações da denúncia' }));
    expect(screen.queryByText('Cancelar denúncia')).toBeNull();
});

it('abre link de denúncia rejeitada após login e compartilha somente seu endereço público autenticado', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('mycity://reports/p-4');
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        if (String(input).endsWith('/sessions')) return response({ data: { user: { id: 'leitor', role: 'CITIZEN' }, token: 'local', expiresAt: new Date(Date.now() + 86400000).toISOString() } }, 201);
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer local' });
        if (String(input).endsWith('/categories')) return categoryResponse();
        if (String(input).endsWith('/reports/p-4/history?order=newest')) return response(page([]));
        if (String(input).endsWith('/reports/p-4')) return response({ data: { ...report, status: 'REJECTED', allowedActions: [] } });
        throw Error('rota inesperada');
    });
    await render(<App />);
    await fireEvent.changeText(await screen.findByLabelText('CPF'), '00000000002');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'somente-teste');
    expect(api).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Entrar'));
    expect(await screen.findByText('Status: Rejeitado')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Ações da denúncia' }));
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
    expect(cover).toHaveProp('source', [{ uri: 'https://demo.test' + path, headers: { Authorization: 'Bearer sintetico' } }]);
    expect(screen.queryByLabelText('Foto da ocorrência: Outra rua')).toBeNull();
});

it('filtra o mapa pelo grupo cadastrado e apresenta seu nome no marcador e no detalhe', async () => {
    const option = { id: '5012d21a-c0a4-4184-bdb6-a728e273d0d3', name: 'Acessibilidade no passeio' };
    const marker = { id: report.id, category: option.id, categoryName: option.name, status: 'SENT', longitude: -42.88, latitude: -20.75, confirmationCount: 0 };
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
    const map = screen.getByTestId('community-map');
    await fireEvent.press(screen.getByText('Filtros'));
    await fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));
    await fireEvent.press(await screen.findByRole('button', { name: option.name }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByTestId('community-map')).toBe(map);
    expect(api.mock.calls.some(([url]) => new URL(String(url)).searchParams.has('category'))).toBe(false);
    await fireEvent.press(screen.getByText('Filtros'));
    await fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));
    await fireEvent.press(await screen.findByRole('button', { name: option.name }));
    await fireEvent.press(screen.getByRole('button', { name: 'Aplicar filtros' }));
    const pin = await screen.findByTestId('report-marker-' + report.id);
    expect(screen.getByTestId('community-map')).toBe(map);
    expect(pin).toHaveProp('accessibilityLabel', option.name + ', Enviado');
    await fireEvent.press(pin);
    await fireEvent.press(map, { nativeEvent: { action: 'press' } });
    expect(screen.queryByRole('button', { name: 'Ver denúncia' })).toBeNull();
    await fireEvent.press(pin);
    await fireEvent.press(screen.getByRole('button', { name: 'Ver denúncia' }));
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

it('retira o registro do cache do feed após cancelar mesmo se a próxima consulta falhar', async () => {
    let canceled = false;
    const own = { ...report, isMine: true, allowedActions: ['CANCEL'] };
    const closed = { ...own, status: 'CANCELED', allowedActions: [], version: 2 };
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/categories')) return categoryResponse();
        if (url.pathname.endsWith('/reports')) {
            if (canceled) throw Error('Sem conexão');
            return response(page(url.searchParams.get('scope') === 'feed' ? [own] : []));
        }
        if (url.pathname.endsWith('/cancellation')) {
            canceled = true;
            return response({ data: closed });
        }
        if (url.pathname.endsWith('/history')) return response(page([]));
        return response({ data: canceled ? closed : own });
    });
    await render(
        <QueryCacheProvider>
            <CitizenWorkspace apiBase={base} token="sintetico" onSessionExpired={() => {}} draftRef={{ current: null }} />
        </QueryCacheProvider>,
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    await fireEvent.press(await screen.findByText(report.description));
    expect(screen.queryByRole('button', { name: 'Nova denúncia' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar denúncia' })).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'Ações da denúncia' }));
    await fireEvent.press(await screen.findByText('Cancelar denúncia'));
    await fireEvent.press(screen.getByText('Confirmar cancelamento'));
    expect(await screen.findByText('Status: Cancelado')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao feed' }));
    await screen.findByText(/Não foi possível atualizar/);
    expect(screen.queryByText(report.description)).toBeNull();
});

it('reabre uma denúncia cancelada com a versão exibida e atualiza as ações', async () => {
    let reopened = false;
    const initial = { ...report, isMine: true, version: 4, status: 'CANCELED', allowedActions: ['REOPEN'] };
    const updated = { ...initial, version: 5, status: 'SENT', allowedActions: ['EDIT', 'CANCEL'] };
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/reopening')) {
            expect(init?.method).toBe('POST');
            expect(JSON.parse(String(init?.body))).toEqual({ expectedVersion: 4 });
            reopened = true;
        }
        if (url.pathname.endsWith('/reports')) return response(page(url.searchParams.get('scope') === 'mine' ? [initial] : []));
        if (url.pathname.endsWith('/history')) return response(page([]));
        return response({ data: reopened ? updated : initial });
    });
    await openApp();
    await fireEvent.press(await screen.findByText(report.description));
    await fireEvent.press(await screen.findByRole('button', { name: 'Ações da denúncia' }));
    expect(screen.queryByRole('button', { name: 'Editar denúncia' })).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'Reabrir denúncia' }));
    expect(await screen.findByText('Status: Enviado')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Editar denúncia' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ações da denúncia' }));
    expect(screen.getByRole('button', { name: 'Editar denúncia' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Reabrir denúncia' })).toBeNull();
});

it('agrupa edição e reabertura sem alterações na folha de ações da cancelada própria', async () => {
    const initial = { ...report, isMine: true, version: 4, status: 'CANCELED', allowedActions: ['EDIT', 'REOPEN'] };
    let reopened = false;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/reopening')) {
            expect(JSON.parse(String(init?.body))).toEqual({ expectedVersion: 4 });
            reopened = true;
        }
        if (url.pathname.endsWith('/reports')) return response(page(url.searchParams.get('scope') === 'mine' ? [initial] : []));
        if (url.pathname.endsWith('/history')) return response(page([]));
        return response({ data: reopened ? { ...initial, version: 5, status: 'SENT', allowedActions: ['EDIT', 'CANCEL'] } : initial });
    });
    await openApp();
    await fireEvent.press(await screen.findByText(report.description));
    await screen.findByRole('button', { name: 'Ações da denúncia' });
    expect(screen.queryByRole('button', { name: 'Editar denúncia' })).toBeNull();
    expect(screen.queryByText('Sua denúncia')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reabrir sem editar' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ações da denúncia' }));
    expect(screen.getByRole('button', { name: 'Editar denúncia' })).toBeVisible();
    expect(screen.queryByText('Compartilhar link')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('button', { name: 'Reabrir sem editar' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ações da denúncia' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Reabrir sem editar' }));
    expect(await screen.findByText('Status: Enviado')).toBeVisible();
});

it('preserva a edição na tela e atualiza o detalhe após conflito com um atendimento do gestor', async () => {
    const original = { ...report, isMine: true, showIdentity: false, allowedActions: ['EDIT'], photos: [{ id: 'p', width: 320, height: 200, contentPath: '/api/v1/reports/p-4/photos/p' }] };
    let conflict = false;
    const api = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/categories')) return categoryResponse();
        if (url.pathname.endsWith('/reports')) return response(page(url.searchParams.get('scope') === 'mine' ? [original] : []));
        if (url.pathname.endsWith('/history')) return response(page([]));
        if (init?.method === 'PATCH') {
            conflict = true;
            return response({ error: { code: 'EDIT_UNAVAILABLE' } }, 409);
        }
        return response({ data: conflict ? { ...original, version: 2, allowedActions: [] } : original });
    });
    await openApp();
    await fireEvent.press(await screen.findByText(report.description));
    await fireEvent.press(await screen.findByRole('button', { name: 'Ações da denúncia' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar denúncia' }));
    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Texto não enviado');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText(/Volte ao detalhe/)).toBeVisible();
    expect(screen.getByLabelText('Descrição')).toHaveDisplayValue('Texto não enviado');
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText(report.description)).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Ações da denúncia' }));
    expect(screen.queryByRole('button', { name: 'Editar denúncia' })).toBeNull();
    expect(api.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
});
