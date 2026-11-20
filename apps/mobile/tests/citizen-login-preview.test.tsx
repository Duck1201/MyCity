import { fireEvent, render, screen } from '@testing-library/react-native';
import { CitizenLoginScreen } from '../src/components/citizen-login-screen';

it('exibe o formulário de login na prévia sem aceitar credenciais e abre somente a demonstração', async () => {
    const openPreview = jest.fn();
    const request = jest.spyOn(globalThis, 'fetch');
    try {
        await render(<CitizenLoginScreen onEnter={openPreview} />);
        expect(screen.getByRole('image', { name: 'Praça Silviano Brandão com o Santuário Santa Rita de Cássia, em Viçosa' })).toBeVisible();
        expect(screen.getByLabelText('MyCity, Viçosa, MG')).toBeVisible();
        expect(screen.getByRole('header', { name: 'Entrar no MyCity' })).toBeVisible();
        expect(screen.getByLabelText('CPF')).toHaveProp('editable', false);
        expect(screen.getByLabelText('Senha')).toHaveProp('editable', false);
        expect(screen.getByLabelText('Senha')).toHaveProp('autoComplete', 'off');
        await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
        expect(openPreview).toHaveBeenCalledTimes(1);
        expect(request).not.toHaveBeenCalled();
    } finally {
        request.mockRestore();
    }
});
