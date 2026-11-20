import { useFonts } from 'expo-font';
import { Text, TextInput } from '../src/components/typography';
import { AppFonts } from '../src/components/app-fonts';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActionButton } from '../src/components/action-button';
import { CpfInput } from '../src/components/cpf-input';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));

jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));

it('aplica a face da Nunito correspondente ao peso do título, do texto e do campo', async () => {
    await render(
        <>
            <Text accessibilityRole="header" style={{ fontWeight: '800' }}>
                Início
            </Text>
            <Text>Equipe encaminhada para vistoria.</Text>
            <TextInput accessibilityLabel="Relato" style={{ fontWeight: '400' }} />
        </>,
    );
    expect(screen.getByRole('header', { name: 'Início' })).toHaveStyle({ fontFamily: 'Nunito-ExtraBold', fontWeight: 'normal' });
    expect(screen.getByText('Equipe encaminhada para vistoria.')).toHaveStyle({ fontFamily: 'Nunito-Regular' });
    expect(screen.getByLabelText('Relato')).toHaveStyle({ fontFamily: 'Nunito-Regular' });
});

it('preserva semântica e edição nos componentes usados pela autenticação', async () => {
    const change = jest.fn();
    const activate = jest.fn();
    await render(
        <>
            <CpfInput accessibilityLabel="CPF" value="" onChangeText={change} />
            <ActionButton label="Entrar" onPress={activate} />
        </>,
    );
    const input = screen.getByLabelText('CPF');
    expect(input).toHaveStyle({ fontFamily: 'Nunito-Regular' });
    expect(screen.getByText('Entrar')).toHaveStyle({ fontFamily: 'Nunito-Bold' });
    await fireEvent.changeText(input, '00000000001');
    expect(change).toHaveBeenCalledWith('000.000.000-01');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(activate).toHaveBeenCalledTimes(1);
});

it.each([true, false])('libera o conteúdo quando termina a tentativa de carregar as fontes (disponíveis: %s)', async (ready) => {
    const fonts = jest.mocked(useFonts);
    fonts.mockReturnValue([false, null]);
    const content = (
        <AppFonts>
            <Text>Conteúdo do app</Text>
        </AppFonts>
    );
    const view = await render(content);
    expect(screen.getByRole('progressbar', { name: 'Abrindo MyCity' })).toBeVisible();
    fonts.mockReturnValue([ready, ready ? null : new Error('Falha na fonte')]);
    await view.rerender(
        <AppFonts>
            <Text>Conteúdo do app</Text>
        </AppFonts>,
    );
    expect(screen.getByText('Conteúdo do app')).toBeVisible();
    expect(screen.queryByRole('progressbar')).toBeNull();
});
