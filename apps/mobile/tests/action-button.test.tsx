import { render, screen, userEvent } from '@testing-library/react-native';
import { ActionButton } from '../src/components/action-button';

it('impede envio duplicado enquanto a operação está pendente', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    const { rerender } = await render(<ActionButton pending label="Enviar denúncia" onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Enviar denúncia' })).toBeDisabled();
    await user.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
    expect(onPress).not.toHaveBeenCalled();
    await rerender(<ActionButton pending={false} label="Enviar denúncia" onPress={onPress} />);
    await user.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
    expect(onPress).toHaveBeenCalledTimes(1);
});
