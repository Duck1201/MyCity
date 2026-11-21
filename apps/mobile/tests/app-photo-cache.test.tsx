import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Image } from 'expo-image';
import App from '../src/app';
import { CitizenAccess } from '../src/citizen-access';
import { CitizenAccessLayout } from '../src/components/citizen-login-screen';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: '192.168.2.19:8081' } } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('../src/report-photos', () => ({ pickReportPhoto: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'request-test' }));

const base = 'http://192.168.2.19:3000/api/v1';
const photo = { id: 'foto', position: 0, width: 1200, height: 900, byteSize: 300_000, contentPath: '/api/v1/reports/registro/photos/foto', thumbnailPath: '/api/v1/reports/registro/photos/foto/thumb' };
const report = { id: '9a8bcd73-e49e-478a-b976-76c0186af640', category: 'LIGHTING', description: 'Poste da praça', status: 'SENT', location: { source: 'GPS', latitude: -20, longitude: -42 }, coverPhoto: photo, photos: [photo], createdAt: '2026-11-01T12:00:00Z' };
const page = (data: unknown[]) => ({ data, page: { nextCursor: null } });
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
});

it('mostra a miniatura nas listas e a original no detalhe, ambas com cache em disco', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = String(input).replace(base, '');
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path.startsWith('/reports?scope=feed')) return ok(page([report]));
        if (path === '/reports/' + report.id) return ok({ data: report });
        return ok(page([]));
    });
    await render(<App />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Feed' }));
    const thumb = await screen.findByLabelText('Foto da ocorrência: ' + report.description);
    expect(thumb).toHaveProp('source', [{ uri: 'http://192.168.2.19:3000' + photo.thumbnailPath, headers: { Authorization: 'Bearer token-teste' } }]);
    expect(thumb).toHaveProp('cachePolicy', 'disk');
    await fireEvent.press(screen.getByText(report.description));
    const full = await screen.findByLabelText('Foto 1 da denúncia');
    expect(full).toHaveProp('source', [{ uri: 'http://192.168.2.19:3000' + photo.contentPath, headers: { Authorization: 'Bearer token-teste' } }]);
    expect(full).toHaveProp('cachePolicy', 'disk');
});

it.each(['sair', 'expirar'])('apaga as fotos guardadas no aparelho ao %s', async (how) => {
    const disk = jest.spyOn(Image, 'clearDiskCache').mockResolvedValue(true);
    const memory = jest.spyOn(Image, 'clearMemoryCache').mockResolvedValue(true);
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    jest.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'cidada-a', role: 'CITIZEN' } }) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    const user = userEvent.setup();
    await render(
        <CitizenAccess apiBase={base}>
            {(_token, expire, leave) => (
                <CitizenAccessLayout onLeave={how === 'sair' ? leave : expire}>
                    <Text>Área do cidadão</Text>
                </CitizenAccessLayout>
            )}
        </CitizenAccess>,
    );
    await screen.findByText('Área do cidadão');
    expect(disk).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Sair' }));
    await screen.findByLabelText('CPF');
    expect(disk).toHaveBeenCalled();
    expect(memory).toHaveBeenCalled();
});
