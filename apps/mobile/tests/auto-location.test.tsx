import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as GPS from 'expo-location';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { ReportLocationPicker } from '../src/report-location-picker';
import { CitizenReport, type CitizenDraft } from '../src/citizen-report';
import { CitizenWorkspace } from '../src/citizen-workspace';
import { categoryResponse } from './category-fixture';

jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, hasServicesEnabledAsync: jest.fn(), getLastKnownPositionAsync: jest.fn(), getForegroundPermissionsAsync: jest.fn(), requestForegroundPermissionsAsync: jest.fn(), watchPositionAsync: jest.fn() }));
jest.mock('../src/report-photos', () => ({ pickReportPhoto: jest.fn(async () => 'file:///fake.jpg') }));
jest.mock('expo-file-system', () => ({
    File: class extends Blob {
        constructor(uri: string) {
            super([uri], { type: 'image/jpeg' });
        }
    },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'fake-id' }));

const props = { apiBase: 'https://example.test/api', token: 'teste', onSessionExpired: jest.fn() };
const position = { coords: { latitude: -20.752, longitude: -42.87 } } as GPS.LocationObject;
const granted = { granted: true } as GPS.PermissionResponse;
const state = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
let reading: GPS.LocationCallback;
const remove = jest.fn();
beforeEach(() => {
    jest.mocked(GPS.getForegroundPermissionsAsync)
        .mockReset()
        .mockResolvedValue({ granted: false, canAskAgain: true } as GPS.LocationPermissionResponse);
    jest.mocked(GPS.hasServicesEnabledAsync).mockReset().mockResolvedValue(true);
    jest.mocked(GPS.getLastKnownPositionAsync).mockReset().mockResolvedValue(null);
    Object.defineProperty(AppState, 'currentState', { ...state, value: 'active' });
    jest.mocked(GPS.requestForegroundPermissionsAsync).mockReset().mockResolvedValue(granted);
    jest.mocked(GPS.watchPositionAsync)
        .mockReset()
        .mockImplementation(async (_, callback) => {
            reading = callback;
            return { remove };
        });
    remove.mockReset();
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => categoryResponse());
});
afterEach(() => {
    Object.defineProperty(AppState, 'currentState', state);
    jest.restoreAllMocks();
});

it('obtém o ponto no formulário enquanto permite categoria e foto, e envia o GPS sem abrir mapa', async () => {
    const upload = jest.mocked(fetch).mockImplementation(async (url) => (String(url).endsWith('/categories') ? categoryResponse() : ({ ok: true, json: async () => ({ data: { id: 'teste' } }) } as Response)));
    const published = jest.fn();
    await render(<CitizenReport {...props} onPublished={published} />);
    expect(screen.getByText('Buscando sua localização…')).toBeVisible();
    expect(GPS.watchPositionAsync).toHaveBeenCalledWith(expect.objectContaining({ accuracy: GPS.Accuracy.High, distanceInterval: 0 }), expect.any(Function), expect.any(Function));
    await fireEvent.press(await screen.findByRole('button', { name: /^Escolher categoria:/ }));
    await fireEvent.press(screen.getByText('Buraco na via'));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tirar foto' }));
    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Buraco próximo à praça');
    await act(() => reading(position));
    expect(screen.getByText('Localização obtida por GPS')).toBeVisible();
    expect(screen.queryByTestId('location-map')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
    const body = upload.mock.calls.find(([url]) => String(url).endsWith('/reports'))?.[1]?.body as FormData;
    expect(JSON.parse(String(body.get('metadata'))).location).toEqual({ ...position.coords, source: 'GPS' });
    expect(published).toHaveBeenCalledWith({ id: 'teste' });
    expect(remove).toHaveBeenCalledTimes(1);
});

it('permite nova tentativa após negativa e cancela a aquisição ao informar o ponto manualmente', async () => {
    jest.mocked(GPS.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: false } as GPS.PermissionResponse);
    const ref: { current: CitizenDraft | null } = { current: null };
    await render(<CitizenReport {...props} draftRef={ref} />);
    expect(screen.getByText(/Localização sem permissão/)).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar GPS novamente' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher no mapa' }));
    expect(remove).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByTestId('location-map'), 'press', { nativeEvent: { coordinate: { latitude: 0, longitude: 0 } } });
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar ponto' }));
    await act(() => reading(position));
    expect(ref.current?.location).toEqual({ latitude: 0, longitude: 0, source: 'MANUAL' });
});

it('remove aquisição ao sair e preserva ponto já salvo ao retomar o rascunho', async () => {
    const ref: { current: CitizenDraft | null } = { current: null };
    const form = await render(<CitizenReport {...props} draftRef={ref} />);
    await form.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    await act(() => reading(position));
    expect(ref.current).toBeNull();
    ref.current = { requestId: 'manual', category: null, description: '', photos: [], showIdentity: true, location: { latitude: -20, longitude: -40, source: 'MANUAL' } };
    await render(<CitizenReport {...props} draftRef={ref} />);
    expect(screen.getByText('Ponto confirmado no mapa')).toBeVisible();
    expect(GPS.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
});

it('retoma uma aquisição interrompida pela câmera e descarta as coordenadas da inscrição anterior', async () => {
    const listeners = new Set<(state: 'active' | 'background') => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => {
        listeners.add(callback);
        return { remove: () => listeners.delete(callback) };
    });
    await render(<CitizenReport {...props} />);
    const first = reading;
    await act(() => {
        Object.defineProperty(AppState, 'currentState', { ...state, value: 'background' });
        for (const listener of [...listeners]) listener('background');
    });
    expect(remove).toHaveBeenCalledTimes(1);
    await act(() => {
        Object.defineProperty(AppState, 'currentState', { ...state, value: 'active' });
        for (const listener of [...listeners]) listener('active');
    });
    expect(GPS.watchPositionAsync).toHaveBeenCalledTimes(2);
    await act(() => first(position));
    expect(screen.queryByText('Localização obtida por GPS')).toBeNull();
    await act(() => reading(position));
    expect(screen.getByText('Localização obtida por GPS')).toBeVisible();
});

it('mostra recuperação no formulário após falha da leitura e permite escolher uma foto', async () => {
    jest.mocked(GPS.watchPositionAsync).mockRejectedValueOnce(new Error('indisponível'));
    await render(<CitizenReport {...props} />);
    expect(screen.getByText(/GPS indisponível/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Escolher no mapa' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }));
    expect(screen.getByText('Fotos (1/3)')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar GPS novamente' }));
    await act(() => reading(position));
    expect(screen.getByText('Localização obtida por GPS')).toBeVisible();
});

it('descarta somente o GPS automático ao voltar e adquire posição nova na próxima abertura do +', async () => {
    const ref: { current: CitizenDraft | null } = { current: null };
    jest.mocked(fetch).mockImplementation(async (url) => (String(url).endsWith('/categories') ? categoryResponse() : ({ ok: true, json: async () => ({ data: [], page: { nextCursor: null } }) } as Response)));
    await render(<CitizenWorkspace {...props} draftRef={ref} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Nova denúncia' }));
    await act(() => reading(position));
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(ref.current).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Nova denúncia' }));
    expect(screen.getByText('Buscando sua localização…')).toBeVisible();
    expect(GPS.watchPositionAsync).toHaveBeenCalledTimes(2);
    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Denúncia de outra rua');
    await act(() => reading({ coords: { latitude: -20.74, longitude: -42.88 } } as GPS.LocationObject));
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar rascunho' }));
    expect(screen.getByText('Localização obtida por GPS')).toBeVisible();
    expect(GPS.watchPositionAsync).toHaveBeenCalledTimes(2);
});

it('preenche a nova denúncia com uma posição recente autorizada mesmo quando não chega uma nova amostra', async () => {
    jest.mocked(GPS.getLastKnownPositionAsync).mockResolvedValueOnce(position);
    await render(<CitizenReport {...props} />);
    expect(await screen.findByText('Localização obtida por GPS')).toBeVisible();
    expect(GPS.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 30000, requiredAccuracy: 100 });
    expect(GPS.watchPositionAsync).not.toHaveBeenCalled();
});

describe.each(['cadastro', 'seletor'])('permissão de localização no %s', (surface) => {
    async function open() {
        if (surface === 'cadastro') return render(<CitizenReport {...props} />);
        const view = await render(<ReportLocationPicker saved={null} cancel={jest.fn()} confirm={jest.fn()} />);
        await fireEvent.press(screen.getByRole('button', { name: 'Usar GPS' }));
        return view;
    }
    it.each([true, false])('respeita a decisão existente sem novo diálogo (concedida: %s)', async (allowed) => {
        jest.mocked(GPS.getForegroundPermissionsAsync).mockResolvedValue({ granted: allowed, canAskAgain: false } as GPS.LocationPermissionResponse);
        await open();
        expect(GPS.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
        expect(GPS.watchPositionAsync).toHaveBeenCalledTimes(allowed ? 1 : 0);
        if (!allowed) expect(screen.getByText(/Localização sem permissão/)).toBeVisible();
    });
    it('aguarda o retorno do diálogo ao primeiro plano sem repetir o pedido nem iniciar leitura em segundo plano', async () => {
        const listeners = new Set<(next: AppStateStatus) => void>();
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
            listeners.add(callback);
            return { remove: () => listeners.delete(callback) };
        });
        function change(next: AppStateStatus) {
            Object.defineProperty(AppState, 'currentState', { ...state, value: next });
            for (const listener of [...listeners]) listener(next);
        }
        let allow!: (permission: GPS.LocationPermissionResponse) => void;
        jest.mocked(GPS.requestForegroundPermissionsAsync).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    allow = resolve;
                }),
        );
        await open();
        expect(GPS.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
        await act(() => change('background'));
        await act(() => allow(granted));
        expect(GPS.hasServicesEnabledAsync).not.toHaveBeenCalled();
        await act(() => change('active'));
        expect(GPS.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
        expect(GPS.watchPositionAsync).toHaveBeenCalledTimes(1);
        await act(() => reading(position));
        expect(screen.getByText(surface === 'cadastro' ? 'Localização obtida por GPS' : 'Localização do aparelho')).toBeVisible();
    });
});

it.each([true, false])('no navegador sem consulta de permissão, respeita a resposta à geolocalização (concedida: %s)', async (allowed) => {
    jest.replaceProperty(Platform, 'OS', 'web');
    jest.mocked(GPS.getForegroundPermissionsAsync).mockRejectedValue(new Error('Permissions.query indisponível'));
    const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    const clearWatch = jest.fn();
    const watchPosition = jest.fn((success: PositionCallback, failure: PositionErrorCallback) => {
        if (allowed) success({ coords: position.coords } as GeolocationPosition);
        else failure({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
        return 5;
    });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { clearWatch, watchPosition } });
    try {
        await render(<CitizenReport {...props} />);
        expect(await screen.findByText(allowed ? 'Localização obtida por GPS' : /Localização sem permissão/)).toBeVisible();
        expect(watchPosition).toHaveBeenCalledTimes(1);
        expect(clearWatch).toHaveBeenCalledWith(5);
        expect(GPS.watchPositionAsync).not.toHaveBeenCalled();
    } finally {
        if (original) Object.defineProperty(navigator, 'geolocation', original);
        else Reflect.deleteProperty(navigator, 'geolocation');
    }
});
