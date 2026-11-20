import { act, render, screen, userEvent, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { CitizenAccess } from '../src/citizen-access';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
afterEach(() => jest.restoreAllMocks());
it('restaura token protegido, consulta identidade e revoga ao sair', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({ token: 'teste', expiresAt: Date.now() + 86400000, apiBase: 'https://demo.example/api/v1' }));
    const request = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'demo', role: 'CITIZEN' } }) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    const user = userEvent.setup();
    await render(<CitizenAccess apiBase="https://demo.example/api/v1">{() => <Text>Denúncia privada</Text>}</CitizenAccess>);
    expect(await screen.findByText('Denúncia privada')).toBeVisible();
    expect(request).toHaveBeenCalledWith('https://demo.example/api/v1/me', expect.objectContaining({ headers: { Authorization: 'Bearer teste' } }));
    await user.press(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByLabelText('CPF')).toBeVisible();
    expect(screen.queryByText('Denúncia privada')).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});

it('exige novo login ao restaurar credencial vencida e mantém os dados privados ocultos', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({ token: 'vencido', expiresAt: Date.now() - 100, apiBase: 'https://demo.example/api/v1' }));
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValueOnce(undefined);
    const request = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('sem rede'));
    await render(<CitizenAccess apiBase="https://demo.example/api/v1">{() => <Text>Privado</Text>}</CitizenAccess>);
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeVisible();
    expect(screen.queryByText('Privado')).toBeNull();
    expect(request).not.toHaveBeenCalled();
});

it('guarda a sessão após entrar com CPF e senha, sem persistir a senha', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    const apiBase = 'https://demo.example/api/v1';
    const request = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ data: { user: { id: 'demo', role: 'CITIZEN' }, expiresAt, token: 'segredo-de-teste' } }) } as Response);
    const user = userEvent.setup();
    await render(<CitizenAccess apiBase={apiBase}>{() => <Text>Área do cidadão</Text>}</CitizenAccess>);
    await user.type(await screen.findByLabelText('CPF'), '00000000001');
    await user.type(screen.getByLabelText('Senha'), 'senha-de-teste');
    await user.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Área do cidadão')).toBeVisible();
    expect(request).toHaveBeenCalledWith(apiBase + '/sessions', expect.objectContaining({ method: 'POST', body: JSON.stringify({ cpf: '00000000001', password: 'senha-de-teste', transport: 'bearer' }) }));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('mycity.session', JSON.stringify({ apiBase, token: 'segredo-de-teste', expiresAt: Date.parse(expiresAt) }));
});

it.each(['00000000001', ' 000.000.000-01 ', ' 000 000 000 01 '])('mascara CPF colado e autentica com os onze dígitos, preservando a senha (%#)', async (pasted) => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    const transport = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ status: 401, ok: false } as Response);
    await render(<CitizenAccess apiBase="https://demo.example/api/v1">{() => <Text>Privado</Text>}</CitizenAccess>);
    const cpf = await screen.findByLabelText('CPF');
    expect(cpf.props.maxLength).toBeUndefined();
    await fireEvent.changeText(cpf, pasted);
    expect(cpf).toHaveProp('value', '000.000.000-01');
    await fireEvent.changeText(screen.getByLabelText('Senha'), '  secreta.1-2  ');
    await fireEvent.press(screen.getByText('Entrar'));
    expect(transport).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(transport.mock.calls[0]![1]!.body))).toEqual({ cpf: '00000000001', password: '  secreta.1-2  ', transport: 'bearer' });
    expect(screen.getByLabelText('Senha')).toHaveProp('value', '  secreta.1-2  ');
});

it('preserva o cursor ao editar no meio e deixa apagar junto à pontuação', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    await render(<CitizenAccess apiBase="https://demo.example/api/v1">{() => <Text>Privado</Text>}</CitizenAccess>);
    const input = await screen.findByLabelText('CPF');
    await fireEvent.changeText(input, '12345678901');
    expect(input).toHaveProp('value', '123.456.789-01');
    await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: 4, end: 5 } } });
    await fireEvent.changeText(input, '123.956.789-01');
    expect(input).toHaveProp('value', '123.956.789-01');
    expect(input).toHaveProp('selection', { start: 5, end: 5 });
    await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: 4, end: 4 } } });
    await fireEvent.changeText(input, '123956.789-01');
    expect(input).toHaveProp('selection', { start: 3, end: 3 });
    await fireEvent.changeText(input, '12.956.789-01');
    expect(input).toHaveProp('value', '129.567.890-1');
    expect(input).toHaveProp('selection', { start: 2, end: 2 });
});

it('pede os onze dígitos antes de enviar credenciais incompletas', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    const transport = jest.spyOn(globalThis, 'fetch');
    await render(<CitizenAccess apiBase="https://demo.example/api/v1">{() => <Text>Privado</Text>}</CitizenAccess>);
    await fireEvent.changeText(await screen.findByLabelText('CPF'), '000000');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'secreta');
    await fireEvent.press(screen.getByText('Entrar'));
    expect(await screen.findByText('Informe os 11 dígitos do CPF.')).toBeVisible();
    expect(transport).not.toHaveBeenCalled();
});

it('insere pontos e hífen à medida que os dígitos chegam', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    await render(<CitizenAccess apiBase="https://demo.example/api/v1">{() => <Text>Privado</Text>}</CitizenAccess>);
    const input = await screen.findByLabelText('CPF');
    const user = userEvent.setup();
    await user.type(input, '0123');
    expect(input).toHaveProp('value', '012.3');
    await user.type(input, '456');
    expect(input).toHaveProp('value', '012.345.6');
    await user.type(input, '789');
    expect(input).toHaveProp('value', '012.345.678-9');
});

it('exibe a abertura até concluir a leitura da sessão e então libera o login', async () => {
    let finish!: (token: string | null) => void;
    jest.mocked(SecureStore.getItemAsync).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    await render(<CitizenAccess apiBase="https://demo.example/api/v1">{() => <Text>Privado</Text>}</CitizenAccess>);
    expect(screen.getByRole('progressbar', { name: 'Abrindo MyCity' })).toBeVisible();
    expect(screen.queryByLabelText('CPF')).toBeNull();
    await act(async () => finish(null));
    expect(await screen.findByLabelText('CPF')).toBeVisible();
    expect(screen.queryByRole('progressbar')).toBeNull();
});
