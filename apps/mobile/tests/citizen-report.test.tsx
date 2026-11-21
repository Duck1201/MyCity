import { CitizenWorkspace } from '../src/citizen-workspace';
import { categoryResponse } from './category-fixture';
import { AccessibilityInfo, AppState, ScrollView, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { pickReportPhoto } from '../src/report-photos';
import { ReportLocationPicker } from '../src/report-location-picker';
import { CitizenReport } from '../src/citizen-report';
import * as location from 'expo-location';

const mockSetCamera = jest.fn();
const mockGetCamera = jest.fn();
jest.mock('react-native-maps', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    function MapView({ ref, ...props }: { ref: import('react').Ref<unknown> }) {
        React.useImperativeHandle(ref, () => ({ setCamera: mockSetCamera, getCamera: mockGetCamera }));
        return React.createElement('MapView', props);
    }
    return { __esModule: true, default: MapView, Marker: 'Marker', PROVIDER_GOOGLE: 'google' };
});
jest.mock('expo-file-system', () => ({
    File: class extends Blob {
        constructor(uri: string) {
            super([uri], { type: 'image/jpeg' });
        }
    },
}));
jest.mock('expo-location', () => ({ Accuracy: { Balanced: 3 }, requestForegroundPermissionsAsync: jest.fn(), watchPositionAsync: jest.fn() }));
jest.mock('../src/report-photos', () => ({ pickReportPhoto: jest.fn(async () => 'file:///cache/foto.jpg') }));
jest.mock('expo-crypto', () => {
    let sequence = 0;
    return { randomUUID: () => 'request-' + ++sequence };
});

const originalSubscribe = AppState.addEventListener;
const originalState = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
beforeEach(() => {
    AppState.addEventListener = jest.fn().mockReturnValue({ remove: jest.fn() });
    jest.mocked(location.requestForegroundPermissionsAsync).mockResolvedValue({ granted: false } as Awaited<ReturnType<typeof location.requestForegroundPermissionsAsync>>);
    Object.defineProperty(AppState, 'currentState', { ...originalState, value: 'active' });
});
afterEach(() => {
    AppState.addEventListener = originalSubscribe;
    Object.defineProperty(AppState, 'currentState', originalState);
});

it('preserva o formulário após perda da resposta e reenvia fotos e metadados idênticos', async () => {
    const previousFetch = globalThis.fetch;
    const upload = jest
        .fn()
        .mockRejectedValueOnce(new Error('sem conexão'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'protocolo-77', category: 'POTHOLE', description: 'Via com buraco', location: { latitude: -20, longitude: -42 }, photos: [] } }) });
    globalThis.fetch = async (url, init) => (String(url).endsWith('/categories') ? categoryResponse() : upload(url, init));
    try {
        await render(<CitizenReport apiBase="https://example.test/api/v1" token="test-token" onSessionExpired={jest.fn()} />);
        await fireEvent.press(await screen.findByRole('button', { name: /^Escolher categoria:/ }));
        await fireEvent.press(screen.getByText('Buraco na via'));
        await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Via com buraco');
        await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
        await fireEvent.press(screen.getByText('Escolher da galeria'));
        jest.mocked(location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: false } as Awaited<ReturnType<typeof location.requestForegroundPermissionsAsync>>);
        await fireEvent.press(screen.getByText('Escolher no mapa'));
        await fireEvent.press(screen.getByRole('button', { name: 'Usar GPS' }));
        expect(await screen.findByText('Localização sem permissão. Toque no mapa para escolher o ponto.')).toBeVisible();
        await fireEvent(screen.getByTestId('location-map'), 'press', { nativeEvent: { coordinate: { latitude: -20, longitude: -42 } } });
        expect(screen.getByText('Local escolhido no mapa')).toBeVisible();
        await fireEvent.press(screen.getByText('Confirmar ponto'));
        await fireEvent.press(screen.getByText('Enviar denúncia'));
        expect(await screen.findByText(/dados foram preservados/)).toBeTruthy();
        await fireEvent.press(screen.getByText('Enviar denúncia'));
        expect(await screen.findByText('Denúncia enviada')).toBeVisible();
        expect(screen.getByText('Via com buraco')).toBeVisible();
        expect(screen.queryByText('protocolo-77')).toBeNull();
        const bodies = upload.mock.calls.map(([, init]) => init.body);
        expect(bodies[1].get('metadata')).toBe(bodies[0].get('metadata'));
        for (const body of bodies) {
            const file = body.get('photos');
            expect(file.type).toBe('image/jpeg');
            expect(await file.text()).toBe('file:///cache/foto.jpg');
        }
        expect(JSON.parse(bodies[0].get('metadata'))).toMatchObject({ category: 'POTHOLE', description: 'Via com buraco', showIdentity: true, location: { source: 'MANUAL', latitude: -20, longitude: -42 } });
    } finally {
        globalThis.fetch = previousFetch;
    }
});

it('fecha a escolha de origem sem alterar o rascunho de duas fotos', async () => {
    const catalog = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => categoryResponse());
    const draft = { category: 'POTHOLE', description: 'Relato provisório', photos: ['file:///a.jpg', 'file:///b.jpg'], location: null, showIdentity: false, requestId: 'duas' };
    const draftRef = { current: draft };
    try {
        await render(<CitizenReport apiBase="https://example.test" token="teste" onSessionExpired={jest.fn()} draftRef={draftRef} />);
        await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
        expect(screen.getByRole('button', { name: 'Tirar foto' })).toBeVisible();
        expect(screen.getByRole('button', { name: 'Escolher da galeria' })).toBeVisible();
        await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
        expect(screen.queryByRole('button', { name: 'Tirar foto' })).toBeNull();
        expect(screen.getByText('Fotos (2/3)')).toBeVisible();
        expect(draftRef.current).toEqual(draft);
    } finally {
        catalog.mockRestore();
    }
});

it('identifica somente a foto pendente e substitui o aviso pela orientação da câmera', async () => {
    const catalog = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => categoryResponse());
    const draft = { category: 'POTHOLE', description: 'Praça', photos: [], location: { latitude: 0, longitude: 0, source: 'MANUAL' as const }, showIdentity: false, requestId: 'original' };
    try {
        await render(<CitizenReport apiBase="https://example.test" token="teste" onSessionExpired={jest.fn()} draftRef={{ current: draft }} />);
        await fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
        expect(screen.getByText('Adicione pelo menos uma foto.')).toBeVisible();
        expect(screen.queryByText('Selecione uma categoria.')).toBeNull();
        jest.mocked(pickReportPhoto).mockRejectedValueOnce(new Error('Permita o acesso à câmera ou escolha uma foto da galeria.'));
        await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Tirar foto' }));
        expect(screen.getByText('Permita o acesso à câmera ou escolha uma foto da galeria.')).toBeVisible();
        expect(screen.queryByText('Adicione pelo menos uma foto.')).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }));
        expect(screen.queryByText(/Permita o acesso/)).toBeNull();
        expect(screen.getByText('Fotos (1/3)')).toBeVisible();
    } finally {
        catalog.mockRestore();
    }
});

it('leva o leitor de tela e a rolagem ao primeiro campo pendente ao tentar enviar', async () => {
    const catalog = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => categoryResponse());
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    // The React Native preset defines this method as a shared jest.fn; start from this test's calls only.
    focus.mockClear();
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    const draft = { category: null, description: '', photos: ['file:///cache/foto.jpg'], location: { latitude: 0, longitude: 0, source: 'MANUAL' as const }, showIdentity: false, requestId: 'original' };
    try {
        await render(<CitizenReport apiBase="https://example.test" token="teste" onSessionExpired={jest.fn()} draftRef={{ current: draft }} />);
        const category = screen.getByText('Categoria');
        await fireEvent(category, 'layout', { nativeEvent: { layout: { x: 0, y: 640, width: 300, height: 24 } } });
        await fireEvent(screen.getByText('Descrição'), 'layout', { nativeEvent: { layout: { x: 0, y: 900, width: 300, height: 24 } } });
        await fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
        expect(screen.getByText('Selecione uma categoria.')).toBeVisible();
        expect(screen.getByText('Descreva o problema.')).toBeVisible();
        expect(focus).toHaveBeenCalledTimes(1);
        expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
        expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ y: 628 }));
    } finally {
        catalog.mockRestore();
        focus.mockRestore();
        scrollTo.mockRestore();
    }
});

it('abre o mapa na região urbana e descarta um ponto manual não confirmado', async () => {
    const catalog = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => categoryResponse());
    try {
        await render(<CitizenReport apiBase="https://example.test/api/v1" token="teste" onSessionExpired={jest.fn()} />);
        await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Iluminação da praça');
        await fireEvent.press(screen.getByText('Escolher no mapa'));
        expect(screen.getByRole('header', { name: 'Escolher localização' })).toBeVisible();
        const region = screen.getByTestId('location-map').props.initialRegion;
        expect(region.latitude).toBeCloseTo(-20.75, 1);
        expect(region.longitude).toBeCloseTo(-42.88, 1);
        expect(region.latitudeDelta).toBeLessThan(0.2);
        expect(screen.getByRole('button', { name: 'Confirmar ponto', busy: false })).toBeDisabled();
        await fireEvent(screen.getByTestId('location-map'), 'press', { nativeEvent: { coordinate: { latitude: -20.752, longitude: -42.881 } } });
        await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.getByLabelText('Descrição')).toHaveProp('value', 'Iluminação da praça');
        await fireEvent.press(screen.getByText('Escolher no mapa'));
        expect(screen.getByRole('button', { name: 'Confirmar ponto' })).toBeDisabled();
    } finally {
        catalog.mockRestore();
    }
});

it('preserva origem GPS ao confirmar e altera para manual só após confirmar o ajuste', async () => {
    const catalog = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => categoryResponse());
    const gps = { latitude: -20.753, longitude: -42.882 };
    const manual = { latitude: -20.751, longitude: -42.883 };
    const draftRef = { current: { category: 'LIGHTING', description: 'Praça', photos: ['file:///teste.jpg'], location: { ...manual, source: 'MANUAL' as const }, showIdentity: false, requestId: 'original' } };
    try {
        await render(<CitizenReport apiBase="https://example.test/api/v1" token="teste" onSessionExpired={jest.fn()} draftRef={draftRef} />);
        await fireEvent.press(screen.getByText('Ajustar ponto no mapa'));
        expect(screen.getByTestId('location-map').props.initialRegion).toMatchObject(manual);
        jest.mocked(location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: true } as Awaited<ReturnType<typeof location.requestForegroundPermissionsAsync>>);
        jest.mocked(location.watchPositionAsync).mockImplementationOnce(async (_, receive) => {
            receive({ coords: gps } as location.LocationObject);
            return { remove: jest.fn() };
        });
        await fireEvent.press(screen.getByRole('button', { name: 'Usar GPS' }));
        await fireEvent(screen.getByTestId('location-map'), 'regionChangeComplete', { ...manual, longitudeDelta: 0.01, latitudeDelta: 0.01 }, { isGesture: false });
        await fireEvent.press(screen.getByText('Confirmar ponto'));
        expect(draftRef.current.location).toEqual({ ...gps, source: 'GPS' });
        expect(screen.getByText('Localização obtida por GPS')).toBeVisible();
        await fireEvent.press(screen.getByText('Ajustar ponto no mapa'));
        expect(screen.getByTestId('location-map').props.initialRegion).toMatchObject(gps);
        const map = screen.getByTestId('location-map');
        await fireEvent(map, 'regionChangeStart', { ...gps, longitudeDelta: 0.01, latitudeDelta: 0.01 }, { isGesture: true });
        expect(screen.getByRole('button', { name: 'Confirmar ponto' })).toBeDisabled();
        mockGetCamera.mockResolvedValueOnce({ center: manual });
        await fireEvent(map, 'regionChangeComplete', { ...gps, longitudeDelta: 0.01, latitudeDelta: 0.01 }, { isGesture: true });
        await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
        expect(draftRef.current.location).toEqual({ ...gps, source: 'GPS' });
        await fireEvent.press(screen.getByText('Ajustar ponto no mapa'));
        await fireEvent(screen.getByTestId('location-map'), 'press', { nativeEvent: { coordinate: manual } });
        await fireEvent.press(screen.getByText('Confirmar ponto'));
        expect(draftRef.current.location).toEqual({ ...manual, source: 'MANUAL' });
        expect(screen.getByText('Ponto confirmado no mapa')).toBeVisible();
    } finally {
        catalog.mockRestore();
    }
});

it('mantém o ajuste manual feito enquanto o GPS responde', async () => {
    const catalog = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => categoryResponse());
    let finish!: location.LocationCallback;
    const remove = jest.fn();
    const draftRef = { current: { category: 'LIGHTING', description: 'Praça', photos: [] as string[], location: null, showIdentity: false, requestId: 'original' } };
    const manual = { latitude: -20.75, longitude: -42.88 };
    try {
        await render(<CitizenReport apiBase="https://example.test/api/v1" token="teste" onSessionExpired={jest.fn()} draftRef={draftRef} />);
        await fireEvent.press(screen.getByText('Escolher no mapa'));
        jest.mocked(location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: true } as Awaited<ReturnType<typeof location.requestForegroundPermissionsAsync>>);
        jest.mocked(location.watchPositionAsync).mockImplementationOnce(async (_, callback) => {
            finish = callback;
            return { remove };
        });
        await fireEvent.press(screen.getByRole('button', { name: 'Usar GPS' }));
        expect(screen.getByRole('button', { name: 'Buscando GPS…', busy: true })).toBeVisible();
        const map = screen.getByTestId('location-map');
        const region = { ...manual, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        await fireEvent(map, 'regionChangeStart', region, { isGesture: true });
        expect(remove).toHaveBeenCalledTimes(1);
        await act(() => finish({ coords: { latitude: 1, longitude: 2 } } as location.LocationObject));
        expect(screen.getByRole('button', { name: 'Confirmar ponto' })).toBeDisabled();
        mockGetCamera.mockResolvedValueOnce({ center: manual, zoom: 17 });
        await fireEvent(map, 'regionChangeComplete', region, { isGesture: true });
        await fireEvent.press(screen.getByText('Confirmar ponto'));
        expect(draftRef.current.location).toEqual({ ...manual, source: 'MANUAL' });
    } finally {
        catalog.mockRestore();
    }
});

it.each(['fechar', 'tocar', 'segundo plano'] as const)('encerra o GPS do ajuste ao %s e desconsidera leitura tardia', async (action) => {
    const remove = jest.fn();
    const listeners = new Set<(state: AppStateStatus) => void>();
    const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
    });
    try {
        let receive!: location.LocationCallback;
        jest.mocked(location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: true } as location.PermissionResponse);
        jest.mocked(location.watchPositionAsync).mockImplementationOnce(async (_, callback) => {
            receive = callback;
            return { remove };
        });
        const view = await render(<ReportLocationPicker saved={null} cancel={jest.fn()} confirm={jest.fn()} />);
        await fireEvent.press(screen.getByRole('button', { name: 'Usar GPS' }));
        expect(screen.getByRole('button', { name: 'Buscando GPS…' })).toBeVisible();
        if (action === 'fechar') await view.unmount();
        else if (action === 'tocar') await fireEvent.press(screen.getByTestId('location-map'), { nativeEvent: { coordinate: { latitude: 1, longitude: 2 } } });
        else
            await act(() => {
                for (const listener of [...listeners]) listener('background');
            });
        expect(remove).toHaveBeenCalledTimes(1);
        await act(() => receive({ coords: { latitude: 3, longitude: 4 } } as location.LocationObject));
        if (action !== 'fechar') expect(screen.queryByText('Localização do aparelho')).toBeNull();
    } finally {
        subscription.mockRestore();
    }
});

it('aproxima o primeiro toque e mantém o zoom de rua e o ponto exato no toque seguinte', async () => {
    const catalog = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => categoryResponse());
    const draftRef = { current: { category: 'LIGHTING', description: 'Praça', photos: [], location: null, showIdentity: false, requestId: 'zoom' } };
    const wide = { latitude: -20.7526, longitude: -42.8818, latitudeDelta: 0.06, longitudeDelta: 0.06 };
    const close = { ...wide, latitudeDelta: 0.002, longitudeDelta: 0.002 };
    const tap = { latitude: -20.7531234567, longitude: -42.8821234567 };
    try {
        await render(<CitizenReport apiBase="https://example.test" token="teste" onSessionExpired={jest.fn()} draftRef={draftRef} />);
        await fireEvent.press(screen.getByText('Escolher no mapa'));
        const map = screen.getByTestId('location-map');
        await fireEvent(map, 'mapReady');
        await fireEvent(map, 'regionChangeStart', wide);
        await fireEvent(map, 'regionChangeComplete', wide);
        await fireEvent(map, 'press', { nativeEvent: {} });
        expect(screen.getByRole('button', { name: 'Confirmar ponto' })).toBeDisabled();
        await fireEvent(map, 'press', { nativeEvent: { coordinate: tap } });
        expect(mockSetCamera).toHaveBeenLastCalledWith({ center: tap, zoom: 17 });
        await fireEvent(map, 'regionChangeComplete', close, { isGesture: false });
        const next = { latitude: tap.latitude + 0.00005, longitude: tap.longitude };
        await fireEvent(map, 'press', { nativeEvent: { coordinate: next } });
        expect(mockSetCamera).toHaveBeenLastCalledWith({ center: next });
        await fireEvent(map, 'regionChangeComplete', close, { isGesture: false });
        await fireEvent.press(screen.getByText('Confirmar ponto'));
        expect(draftRef.current.location).toEqual({ ...next, source: 'MANUAL' });
    } finally {
        catalog.mockRestore();
    }
});

it('exibe a foto de perfil recebida na resposta autenticada de uma denúncia identificada', async () => {
    const avatar = 'data:image/jpeg;base64,aGVsbG8=';
    const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => (String(url).endsWith('/categories') ? categoryResponse() : ({ ok: true, json: async () => ({ data: { id: 'teste', category: 'POTHOLE', description: 'Teste', location: { latitude: 0, longitude: 0 }, author: { name: 'Cidadão', photoUrl: avatar }, photos: [] } }) } as Response)));
    const draftRef = { current: { requestId: 'foto-perfil', category: 'POTHOLE' as const, description: 'Teste', location: { latitude: 0, longitude: 0, source: 'GPS' as const }, photos: ['file:///foto.jpg'], showIdentity: true } };
    try {
        await render(<CitizenReport draftRef={draftRef} apiBase="https://example.test/api/v1" token="test-token" onSessionExpired={jest.fn()} />);
        await fireEvent.press(screen.getByText('Enviar denúncia'));
        expect(await screen.findByLabelText('Foto do autor')).toHaveProp('source', { uri: avatar });
    } finally {
        fetcher.mockRestore();
    }
});

it('permite corrigir o rascunho quando a preparação do multipart falha', async () => {
    const draftRef = { current: { requestId: 'teste-preparo', category: 'POTHOLE' as const, description: 'Teste', location: { latitude: 0, longitude: 0, source: 'GPS' as const }, photos: ['file:///foto.jpg'], showIdentity: false } };
    const catalog = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).endsWith('/categories')) return categoryResponse();
        throw Error('Rota inesperada');
    });
    const append = jest.spyOn(FormData.prototype, 'append').mockImplementationOnce(() => {
        throw new Error('arquivo indisponível');
    });
    try {
        await render(<CitizenReport draftRef={draftRef} apiBase="https://example.test/api/v1" token="test-token" onSessionExpired={jest.fn()} />);
        await fireEvent.press(screen.getByText('Enviar denúncia'));
        expect(await screen.findByText(/dados foram preservados/)).toBeTruthy();
        expect(screen.getByText('Enviar denúncia')).toBeEnabled();
        expect(draftRef.current.description).toBe('Teste');
    } finally {
        append.mockRestore();
        catalog.mockRestore();
    }
});

it('consulta o catálogo autenticado, recupera uma falha e envia o identificador escolhido pelo cidadão', async () => {
    const option = { id: '4b65895c-e26e-4f4a-83df-83f44a15e323', name: 'Segurança na travessia' };
    let calls = 0;
    const post = jest.fn();
    const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-teste' });
        if (String(url).endsWith('/categories')) {
            if (++calls === 1) throw Error('sem conexão');
            return { ok: true, status: 200, json: async () => ({ data: [option] }) } as Response;
        }
        if (!String(url).endsWith('/reports')) throw Error('rota inesperada');
        const form = init?.body as FormData;
        post(JSON.parse(String(form.get('metadata'))));
        return { ok: true, status: 201, json: async () => ({ data: { id: 'caso-novo', category: option.id, categoryName: option.name, description: 'Rascunho preservado', status: 'SENT', location: { latitude: 0, longitude: 0 }, photos: [] } }) } as Response;
    });
    const draftRef = { current: { requestId: 'categoria-adicionada', category: null, description: 'Rascunho preservado', location: { latitude: 0, longitude: 0, source: 'MANUAL' as const }, photos: ['file:///ocorrencia.jpg'], showIdentity: false } };
    try {
        await render(<CitizenReport draftRef={draftRef} apiBase="https://demo.test/api/v1" token="token-teste" onSessionExpired={jest.fn()} />);
        await fireEvent.press(await screen.findByRole('button', { name: 'Tentar carregar categorias' }));
        expect(screen.getByLabelText('Descrição')).toHaveProp('value', 'Rascunho preservado');
        await fireEvent.press(await screen.findByRole('button', { name: /^Escolher categoria:/ }));
        await fireEvent.press(await screen.findByRole('radio', { name: option.name }));
        const selectedCategory = screen.getByRole('button', { name: 'Escolher categoria: ' + option.name });
        expect(screen.queryByRole('radio', { name: option.name })).toBeNull();
        await fireEvent.press(selectedCategory);
        expect(screen.getByRole('radio', { name: option.name })).toBeChecked();
        await fireEvent.press(selectedCategory);
        await fireEvent.press(screen.getByText('Enviar denúncia'));
        expect(await screen.findByText('Rascunho preservado')).toBeVisible();
        expect(screen.queryByText('caso-novo')).toBeNull();
        expect(screen.getByText(option.name)).toBeVisible();
        expect(post).toHaveBeenCalledWith(expect.objectContaining({ category: option.id, description: 'Rascunho preservado' }));
    } finally {
        fetcher.mockRestore();
    }
});

it('limita a três fotos e envia o multipart na ordem visível depois de remover e substituir um anexo', async () => {
    const draftRef = { current: { requestId: 'tres-fotos', category: 'POTHOLE' as const, description: 'Relato demonstrativo', location: { latitude: 0, longitude: 0, source: 'MANUAL' as const }, photos: [] as string[], showIdentity: false } };
    const files: string[] = [];
    const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        if (String(input).endsWith('/categories')) return categoryResponse();
        const body = init?.body as FormData;
        for (const image of body.getAll('photos')) files.push(await (image as Blob).text());
        return { ok: true, status: 201, json: async () => ({ data: { id: 'registro-multifoto', category: 'POTHOLE', description: 'Relato demonstrativo', location: { latitude: 0, longitude: 0 }, photos: [] } }) } as Response;
    });
    const uri = (i: number) => 'file:///cache/exemplo-' + i + '.jpg';
    try {
        await render(<CitizenReport apiBase="https://example.test/api/v1" token="test-token" onSessionExpired={jest.fn()} draftRef={draftRef} />);
        for (const id of [1, 2, 3]) {
            const addPhoto = screen.getByRole('button', { name: 'Adicionar foto' });
            expect(addPhoto).toHaveStyle(id === 1 ? { width: '100%' } : { width: '31%', aspectRatio: 1 });
            jest.mocked(pickReportPhoto).mockResolvedValueOnce(uri(id));
            await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
            await fireEvent.press(await screen.findByRole('button', { name: 'Escolher da galeria' }));
        }
        expect(screen.getByText('Fotos (3/3)')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Adicionar foto' })).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Remover foto 2' }));
        jest.mocked(pickReportPhoto).mockResolvedValueOnce(uri(4));
        await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
        expect(await screen.findByText('Relato demonstrativo')).toBeVisible();
        expect(screen.queryByText('registro-multifoto')).toBeNull();
        expect(files).toEqual([uri(1), uri(3), uri(4)]);
    } finally {
        fetcher.mockRestore();
    }
});

it('atualiza as categorias após arquivamento e preserva o restante do rascunho', async () => {
    const original = { requestId: 'original', category: 'POTHOLE', description: 'Relato', photos: ['file:///foto.jpg'], location: { latitude: 0, longitude: 0, source: 'GPS' as const }, showIdentity: false };
    const draftRef = { current: original };
    let archived = false;
    const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        if (String(input).endsWith('/categories'))
            return {
                ok: true,
                json: async () => ({
                    data: [
                        { id: 'POTHOLE', name: 'Buraco na via', archived },
                        { id: 'LIGHTING', name: 'Iluminação', archived: false },
                    ],
                }),
            } as Response;
        archived = true;
        return { ok: false, status: 409, json: async () => ({ error: { code: 'CATEGORY_ARCHIVED' } }) } as Response;
    });
    try {
        await render(<CitizenReport apiBase="https://example.test/api/v1" token="test-token" draftRef={draftRef} onSessionExpired={jest.fn()} />);
        await fireEvent.press(screen.getByText('Enviar denúncia'));
        expect(await screen.findByText(/categoria foi arquivada/i)).toBeVisible();
        expect(screen.queryByText('Buraco na via')).toBeNull();
        expect(draftRef.current).toMatchObject({ ...original, category: null, requestId: expect.any(String) });
        await fireEvent.press(screen.getByRole('radio', { name: 'Iluminação' }));
        expect(draftRef.current.category).toBe('LIGHTING');
    } finally {
        fetcher.mockRestore();
    }
});

it('retoma o rascunho no mapa, publica e volta do acompanhamento para a lista pessoal', async () => {
    const draft = { requestId: 'publicar', category: 'POTHOLE', description: 'Via irregular', photos: ['file:///foto.jpg'], location: { latitude: 0, longitude: 0, source: 'GPS' as const }, showIdentity: false };
    const draftRef = { current: draft };
    const report = { ...draft, id: 'protocolo-publicado', status: 'SENT', isMine: true, confirmedByMe: false, confirmationCount: 0, createdAt: '2026-11-01T12:00:00Z', allowedActions: ['CANCEL'], photos: [] };
    let count = 0;
    const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        const page = (data: unknown[]) => ({ data, page: { nextCursor: null } });
        let result: unknown;
        if (url.pathname.endsWith('/categories')) return categoryResponse();
        if (init?.method === 'POST') {
            count++;
            result = { data: report };
        } else if (url.pathname.endsWith('/protocolo-publicado')) result = { data: report };
        else result = page(url.searchParams.get('scope') === 'mine' && count ? [report] : []);
        return { ok: true, status: 200, json: async () => result } as Response;
    });
    try {
        await render(<CitizenWorkspace apiBase="https://example.test/api/v1" token="test-token" draftRef={draftRef} onSessionExpired={jest.fn()} />);
        expect(await screen.findByText('Você ainda não registrou denúncias.')).toBeVisible();
        await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Continuar rascunho' }));
        expect(screen.getByRole('header', { name: 'Registrar denúncia' })).toBeVisible();
        expect(screen.queryByText('Voltar')).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
        expect(screen.getByRole('tab', { name: 'Feed', selected: true })).toBeVisible();
        await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Continuar rascunho' }));
        expect(screen.getByLabelText('Descrição')).toHaveProp('value', draft.description);
        await fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
        expect(await screen.findByText(report.description)).toBeVisible();
        expect(screen.queryByText(report.id)).toBeNull();
        expect(screen.getByText('Histórico do atendimento')).toBeVisible();
        expect(draftRef.current).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Voltar aos meus registros' }));
        expect(await screen.findByText(report.description)).toBeVisible();
        expect(screen.getByRole('button', { name: 'Nova denúncia' })).toBeVisible();
        expect(count).toBe(1);
    } finally {
        fetcher.mockRestore();
    }
});

it.each([403, 404])('preserva o comprovante do envio durante falha de rede e o oculta após HTTP %i', async (deniedStatus) => {
    const draft = { requestId: 'criar', category: 'POTHOLE', description: 'Via irregular', photos: ['file:///foto.jpg'], location: { latitude: 0, longitude: 0, source: 'GPS' as const }, showIdentity: false };
    const report = { ...draft, id: 'registro-confirmado', status: 'SENT', isMine: true, confirmationCount: 0, createdAt: '2026-11-01T12:00:00Z', allowedActions: [], photos: [{ id: 'foto', contentPath: '/api/v1/reports/registro-confirmado/photos/foto' }] };
    const draftRef = { current: draft };
    let offline = true;
    const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith('/categories')) return categoryResponse();
        if (init?.method === 'POST') return { ok: true, status: 201, json: async () => ({ data: report }) } as Response;
        if (path.endsWith('/registro-confirmado')) {
            if (offline) throw new Error('sem conexão');
            return { ok: false, status: deniedStatus } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ data: [], page: { nextCursor: null } }) } as Response;
    });
    try {
        await render(<CitizenWorkspace apiBase="https://example.test/api/v1" token="test-token" draftRef={draftRef} onSessionExpired={jest.fn()} />);
        await fireEvent.press(screen.getByRole('button', { name: 'Continuar rascunho' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
        expect(await screen.findByText('Não foi possível atualizar. Confira sua conexão.')).toBeVisible();
        expect(screen.getByText(report.description)).toBeVisible();
        expect(screen.queryByText(report.id)).toBeNull();
        expect(screen.getByText('Status: Enviado')).toBeVisible();
        expect(screen.getByLabelText('Foto 1 da denúncia')).toBeVisible();
        offline = false;
        await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
        expect(await screen.findByText('Esta denúncia não está disponível para sua conta.')).toBeVisible();
        expect(screen.queryByText(report.description)).toBeNull();
        expect(screen.queryByLabelText('Foto 1 da denúncia')).toBeNull();
    } finally {
        fetcher.mockRestore();
    }
});

it.each([
    ['SENT', 'Salvar alterações'],
    ['CANCELED', 'Salvar e reabrir'],
])('edita a própria denúncia %s, mantém fotos escolhidas e envia apenas os arquivos novos após falha de rede', async (status, saveLabel) => {
    const picture = (id: string) => ({ id, contentPath: '/api/v1/reports/one/photos/' + id, thumbnailPath: '/api/v1/reports/one/photos/' + id + '/thumb', width: 320, height: 200 });
    const original = { id: 'one', isMine: true, status, createdAt: '2026-01-01', version: 3, allowedActions: ['EDIT'], category: 'TREE', description: 'Ramos na rua', location: { source: 'MANUAL', latitude: -20, longitude: -42 }, showIdentity: false, photos: [picture('a'), picture('b')] };
    let current = original;
    const payloads: FormData[] = [];
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const path = String(input);
        if (path.endsWith('/categories')) return categoryResponse();
        if (init?.method === 'PATCH') {
            expect(path).toBe('https://example.test/api/v1/reports/one');
            const form = init.body as FormData;
            payloads.push(form);
            if (payloads.length === 1) throw Error('offline');
            current = { ...original, status: 'SENT', description: 'Relato atualizado', version: 4 };
        }
        const data = path.includes('/history') ? { data: [], page: { nextCursor: null } } : path.includes('/reports?') ? { data: new URL(path).searchParams.get('scope') === 'mine' ? [current] : [], page: { nextCursor: null } } : { data: current };
        return { ok: true, json: async () => data } as Response;
    });
    try {
        const draft = { current: null };
        await render(<CitizenWorkspace apiBase="https://example.test/api/v1" token="test-token" onSessionExpired={jest.fn()} draftRef={draft} />);
        await fireEvent.press(await screen.findByText('Ramos na rua'));
        await fireEvent.press(await screen.findByRole('button', { name: 'Ações da denúncia' }));
        await fireEvent.press(await screen.findByRole('button', { name: 'Editar denúncia' }));
        expect(screen.getByLabelText('Descrição')).toHaveDisplayValue('Ramos na rua');
        expect(screen.getByText('Fotos (2/3)')).toBeVisible();
        expect(screen.getByLabelText('Prévia da foto 1')).toHaveStyle({ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 });
        if (status === 'CANCELED') expect(screen.getByText(/voltará à fila do gestor/)).toBeVisible();
        await fireEvent.press(await screen.findByRole('button', { name: /^Escolher categoria:/ }));
        await fireEvent.press(screen.getByText('Buraco na via'));
        await fireEvent(screen.getByLabelText('Quero mostrar minha cara'), 'valueChange', true);
        await fireEvent.press(screen.getByText('Ajustar ponto no mapa'));
        await fireEvent(screen.getByTestId('location-map'), 'press', { nativeEvent: { coordinate: { latitude: -21, longitude: -43 } } });
        await fireEvent.press(screen.getByText('Confirmar ponto'));
        await fireEvent.press(screen.getByRole('button', { name: 'Remover foto 1' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
        await fireEvent.press(screen.getByText('Escolher da galeria'));
        await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Relato atualizado');
        await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
        expect(payloads).toHaveLength(0);
        if (status === 'CANCELED') expect(await screen.findByText('Status: Cancelado')).toBeVisible();
        await fireEvent.press(await screen.findByRole('button', { name: 'Ações da denúncia' }));
        await fireEvent.press(await screen.findByRole('button', { name: 'Editar denúncia' }));
        expect(screen.getByLabelText('Descrição')).toHaveDisplayValue('Relato atualizado');
        await fireEvent.press(screen.getByRole('button', { name: saveLabel }));
        expect(await screen.findByText(/dados foram preservados/)).toBeVisible();
        await fireEvent.press(screen.getByRole('button', { name: saveLabel }));
        expect(await screen.findByText('Relato atualizado')).toBeVisible();
        expect(screen.getByText('Status: Enviado')).toBeVisible();
        expect(spy.mock.calls.some(([url]) => String(url).endsWith('/reopening'))).toBe(false);
        expect(payloads).toHaveLength(2);
        for (const form of payloads) {
            expect(JSON.parse(String(form.get('metadata')))).toEqual({ expectedVersion: 3, retainedPhotoIds: ['b'], category: 'POTHOLE', description: 'Relato atualizado', showIdentity: true, location: { source: 'MANUAL', latitude: -21, longitude: -43 } });
            expect(form.getAll('photos')).toHaveLength(1);
        }
        expect(draft.current).toBeNull();
    } finally {
        spy.mockRestore();
    }
});

it('permite escolher anonimato quando o perfil está indisponível ao salvar', async () => {
    const original = { id: 'one', isMine: true, status: 'CANCELED', version: 3, category: 'TREE', description: 'Ramos na rua', createdAt: '2026-01-01', location: { source: 'MANUAL', latitude: -20, longitude: -42 }, allowedActions: ['EDIT', 'REOPEN'], photos: [{ id: 'a', contentPath: '/api/v1/reports/one/photos/a', width: 320, height: 320 }], showIdentity: true };
    let current = original;
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const path = String(input);
        if (path.endsWith('/categories')) return categoryResponse();
        if (init?.method === 'PATCH') {
            const metadata = JSON.parse(String((init.body as FormData).get('metadata')));
            if (metadata.showIdentity) return { ok: false, status: 409, json: async () => ({ error: { code: 'PROFILE_UNAVAILABLE' } }) } as Response;
            current = { ...original, showIdentity: false, status: 'SENT', version: 4 };
        }
        const data = path.includes('/history') ? { data: [], page: { nextCursor: null } } : path.includes('/reports?') ? { data: new URL(path).searchParams.get('scope') === 'mine' ? [current] : [], page: { nextCursor: null } } : { data: current };
        return { ok: true, json: async () => data } as Response;
    });
    try {
        await render(<CitizenWorkspace apiBase="https://example.test/api/v1" token="test-token" onSessionExpired={jest.fn()} draftRef={{ current: null }} />);
        await fireEvent.press(await screen.findByText(original.description));
        await fireEvent.press(await screen.findByRole('button', { name: 'Ações da denúncia' }));
        await fireEvent.press(await screen.findByRole('button', { name: 'Editar denúncia' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Salvar e reabrir' }));
        expect(await screen.findByText(/Seu perfil está indisponível/)).toBeVisible();
        expect(screen.getByLabelText('Descrição')).toHaveDisplayValue(original.description);
        await fireEvent(screen.getByLabelText('Quero mostrar minha cara'), 'valueChange', false);
        await fireEvent.press(screen.getByRole('button', { name: 'Salvar e reabrir' }));
        expect(await screen.findByText('Status: Enviado')).toBeVisible();
        expect(screen.getByText('Autor: Anônimo')).toBeVisible();
    } finally {
        spy.mockRestore();
    }
});
