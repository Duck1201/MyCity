import { fireEvent, render, screen } from '@testing-library/react-native';
import { CitizenPrototype } from '../src/prototype/citizen-prototype';
import { ActionButton } from '../src/components/action-button';
import { CpfInput } from '../src/components/cpf-input';

jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));

it('aplica as faces locais da Nunito ao título, ao texto e ao campo do protótipo', async () => {
    await render(<CitizenPrototype />);
    expect(screen.getByRole('header', { name: 'Início' })).toHaveStyle({ fontFamily: 'Nunito-ExtraBold' });
    expect(screen.getByText('Equipe encaminhada para vistoria.')).toHaveStyle({ fontFamily: 'Nunito-Regular' });
    await fireEvent.press(screen.getByRole('button', { name: 'Nova denúncia' }));
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
