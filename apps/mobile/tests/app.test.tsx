import { render, screen } from '@testing-library/react-native';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null) }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));
jest.mock('../src/prototype/citizen-prototype', () => {
    throw new Error('O app integrado carregou a prévia.');
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
