import { act, render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import App from '../src/app';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null) }));
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn(() => [true, null]) }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));

it('inicia a restauração da sessão junto com as fontes e mantém a mesma tela de abertura', async () => {
    const fonts = jest.mocked(useFonts);
    const restore = jest.mocked(SecureStore.getItemAsync);
    restore.mockClear();
    fonts.mockReturnValue([false, null]);
    let finish!: (session: null) => void;
    const pending = new Promise<null>((resolve) => {
        finish = resolve;
    });
    restore.mockReturnValueOnce(pending);
    try {
        const view = await render(<App />);
        const loading = screen.getByRole('progressbar', { name: 'Abrindo MyCity' });
        expect(restore).toHaveBeenCalledWith('mycity.session');
        expect(screen.queryByLabelText('CPF')).toBeNull();
        const pendingWordmark = screen.queryByText('MyCity');
        if (pendingWordmark) expect(pendingWordmark).not.toBeVisible();
        fonts.mockReturnValue([true, null]);
        await view.rerender(<App />);
        expect(screen.getByRole('progressbar', { name: 'Abrindo MyCity' })).toBe(loading);
        expect(screen.getByText('MyCity')).toBeVisible();
        expect(screen.getByText('MyCity')).toHaveStyle({ fontFamily: 'Nunito-ExtraBold' });
        await act(() => finish(null));
        expect(await screen.findByLabelText('CPF')).toBeVisible();
        expect(screen.queryByRole('progressbar')).toBeNull();
    } finally {
        fonts.mockReturnValue([true, null]);
        restore.mockReset().mockResolvedValue(null);
    }
});

it('abre o login do app de produção sem carregar a prévia', async () => {
    const development = jest.replaceProperty(globalThis as typeof globalThis & { __DEV__: boolean }, '__DEV__', false);
    try {
        const { default: App } = jest.requireActual<typeof import('../src/app')>('../src/app');
        await render(<App />);
        expect(await screen.findByLabelText('CPF')).toBeVisible();
    } finally {
        development.restore();
    }
});
