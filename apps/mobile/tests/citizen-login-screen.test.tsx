import { fireEvent, render, screen } from '@testing-library/react-native';
import { CitizenLoginScreen } from '../src/components/citizen-login-screen';

it('apresenta a praça, a marca e os campos editáveis e envia pelo botão Entrar', async () => {
    const enter = jest.fn();
    const setCpf = jest.fn();
    const setPassword = jest.fn();
    await render(<CitizenLoginScreen onEnter={enter} credentials={{ cpf: '', password: '', setCpf, setPassword, message: '', busy: false, motion: false }} />);

    expect(screen.getByRole('image', { name: 'Praça Silviano Brandão com o Santuário Santa Rita de Cássia, em Viçosa' })).toBeVisible();
    expect(screen.getByLabelText('MyCity, Viçosa, MG')).toBeVisible();
    expect(screen.getByRole('header', { name: 'Entrar no MyCity' })).toBeVisible();
    expect(screen.getByLabelText('CPF')).toHaveProp('autoComplete', 'username');
    expect(screen.getByLabelText('Senha')).toHaveProp('autoComplete', 'current-password');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha-ficticia');
    expect(setPassword).toHaveBeenCalledWith('senha-ficticia');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(enter).toHaveBeenCalledTimes(1);
});
