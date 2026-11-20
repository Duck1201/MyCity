import { CitizenWorkspace } from '../src/citizen-workspace';
import { categoryResponse } from './category-fixture';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { pickReportPhoto } from '../src/report-photos';
import { CitizenReport } from '../src/citizen-report';
import * as location from 'expo-location';

jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('expo-file-system', () => ({
    File: class extends Blob {
        constructor(uri: string) {
            super([uri], { type: 'image/jpeg' });
        }
    },
}));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));
jest.mock('../src/report-photos', () => ({ pickReportPhoto: jest.fn(async () => 'file:///cache/foto.jpg') }));
jest.mock('expo-crypto', () => {
    let sequence = 0;
    return { randomUUID: () => 'request-' + ++sequence };
});

const originalState = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
beforeEach(() => {
    Object.defineProperty(AppState, 'currentState', { ...originalState, value: 'active' });
});
afterEach(() => {
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
        await fireEvent.press(screen.getByText('Buraco na via'));
        await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Via com buraco');
        await fireEvent.press(screen.getByText('Galeria'));
        jest.mocked(location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: false } as Awaited<ReturnType<typeof location.requestForegroundPermissionsAsync>>);
        await fireEvent.press(screen.getByText('Escolher no mapa'));
        await fireEvent.press(screen.getByText('Usar GPS'));
        expect(await screen.findByText('GPS indisponível. Toque no mapa para escolher o ponto.')).toBeVisible();
        await fireEvent(screen.getByTestId('location-map'), 'press', { nativeEvent: { coordinate: { latitude: -20, longitude: -42 } } });
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
        expect(screen.getByRole('button', { name: 'Confirmar ponto' })).toBeDisabled();
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
        await fireEvent.press(screen.getByText('Escolher no mapa'));
        expect(screen.getByTestId('location-map').props.initialRegion).toMatchObject(manual);
        jest.mocked(location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: true } as Awaited<ReturnType<typeof location.requestForegroundPermissionsAsync>>);
        jest.mocked(location.getCurrentPositionAsync).mockResolvedValueOnce({ coords: gps } as Awaited<ReturnType<typeof location.getCurrentPositionAsync>>);
        await fireEvent.press(screen.getByText('Usar GPS'));
        await fireEvent.press(screen.getByText('Confirmar ponto'));
        expect(draftRef.current.location).toEqual({ ...gps, source: 'GPS' });
        await fireEvent.press(screen.getByText('Escolher no mapa'));
        expect(screen.getByTestId('location-map').props.initialRegion).toMatchObject(gps);
        await fireEvent(screen.getByTestId('location-map'), 'press', { nativeEvent: { coordinate: manual } });
        await fireEvent.press(screen.getByText('Cancelar'));
        expect(draftRef.current.location).toEqual({ ...gps, source: 'GPS' });
        await fireEvent.press(screen.getByText('Escolher no mapa'));
        await fireEvent(screen.getByTestId('location-map'), 'press', { nativeEvent: { coordinate: manual } });
        await fireEvent.press(screen.getByText('Confirmar ponto'));
        expect(draftRef.current.location).toEqual({ ...manual, source: 'MANUAL' });
    } finally {
        catalog.mockRestore();
    }
});

it('mantém o ajuste manual feito enquanto o GPS responde', async () => {
    const catalog = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => categoryResponse());
    type Fix = Awaited<ReturnType<typeof location.getCurrentPositionAsync>>;
    let finish!: (fix: Fix) => void;
    const fix = new Promise<Fix>((resolve) => {
        finish = resolve;
    });
    jest.mocked(location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: true } as Awaited<ReturnType<typeof location.requestForegroundPermissionsAsync>>);
    jest.mocked(location.getCurrentPositionAsync).mockReturnValueOnce(fix);
    const draftRef = { current: { category: 'LIGHTING', description: 'Praça', photos: [] as string[], location: null, showIdentity: false, requestId: 'original' } };
    const manual = { latitude: -20.75, longitude: -42.88 };
    try {
        await render(<CitizenReport apiBase="https://example.test/api/v1" token="teste" onSessionExpired={jest.fn()} draftRef={draftRef} />);
        await fireEvent.press(screen.getByText('Escolher no mapa'));
        await fireEvent.press(screen.getByText('Usar GPS'));
        expect(screen.getByText('Buscando GPS…')).toBeVisible();
        await fireEvent(screen.getByTestId('location-map'), 'press', { nativeEvent: { coordinate: manual } });
        await act(async () => {
            finish({ coords: { latitude: 1, longitude: 2 } } as Fix);
            await fix;
        });
        await fireEvent.press(screen.getByText('Confirmar ponto'));
        expect(draftRef.current.location).toEqual({ ...manual, source: 'MANUAL' });
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
        await fireEvent.press(await screen.findByRole('radio', { name: option.name }));
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
            jest.mocked(pickReportPhoto).mockResolvedValueOnce(uri(id));
            await fireEvent.press(await screen.findByRole('button', { name: 'Galeria' }));
        }
        expect(screen.getByText('Fotos (3/3)')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Galeria' })).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Remover foto 2' }));
        jest.mocked(pickReportPhoto).mockResolvedValueOnce(uri(4));
        await fireEvent.press(screen.getByRole('button', { name: 'Galeria' }));
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
