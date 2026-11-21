import { act, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import App from '../src/app';

// The device file system is the external boundary; the stand-in holds a read saved by an earlier launch.
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
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: '192.168.2.19:8081' } } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('../src/report-photos', () => ({ pickReportPhoto: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'request-test' }));
const files: Map<string, string> = jest.requireMock('expo-file-system').mockFiles;

const base = 'http://192.168.2.19:3000/api/v1';
const report = { id: '9a8bcd73-e49e-478a-b976-76c0186af640', category: 'LIGHTING', description: 'Poste da praça guardado', status: 'SENT', isMine: true, confirmationCount: 0, location: { source: 'GPS', latitude: -20, longitude: -42 }, createdAt: '2026-11-01T12:00:00Z' };
const page = (data: unknown[]) => ({ data, page: { nextCursor: null } });
const ok = (value: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => value }) as unknown as Response;
const currentState = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
beforeEach(() => {
    files.clear();
    Object.defineProperty(AppState, 'currentState', { ...currentState, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify({ apiBase: base, token: 'token-teste', expiresAt: Date.now() + 86400000 }));
});
afterEach(() => {
    Object.defineProperty(AppState, 'currentState', currentState);
    jest.restoreAllMocks();
});

it('avisa que a lista guardada está sendo atualizada até a rede responder', async () => {
    files.set('cache/mycity-queries/autor.json', JSON.stringify({ owner: 'autor', entries: [['/reports?scope=mine', page([report]), Date.now()]] }));
    let release!: () => void;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = String(input).replace(base, '');
        if (path === '/me') return ok({ data: { id: 'autor', role: 'CITIZEN' } });
        if (path === '/reports?scope=mine') return new Promise<Response>((resolve) => (release = () => resolve(ok(page([{ ...report, description: 'Poste da praça confirmado' }])))));
        return ok(page([]));
    });
    await render(<App />);
    expect(await screen.findByText('Poste da praça guardado')).toBeVisible();
    expect(screen.getByText('Atualizando…')).toBeVisible();
    await act(async () => release());
    expect(await screen.findByText('Poste da praça confirmado')).toBeVisible();
    expect(screen.queryByText('Atualizando…')).toBeNull();
});
