import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
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

it('anima o toque e respeita a preferência de movimento reduzido', async () => {
    const { AccessibilityInfo, Animated } = jest.requireActual<typeof import('react-native')>('react-native');
    let reduce: ((reduced: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, callback) => {
        if (event === 'reduceMotionChanged') reduce = callback as (value: boolean) => void;
        return { remove: jest.fn() };
    });
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
    try {
        await render(<ActionButton label="Abrir" onPress={jest.fn()} />);
        const button = screen.getByRole('button', { name: 'Abrir' });
        await fireEvent(button, 'pressIn', {});
        await fireEvent(button, 'pressOut', {});
        expect(timing.mock.calls.map(([, config]) => config.toValue)).toEqual([0.97, 1]);
        await act(() => reduce?.(true));
        await fireEvent(button, 'pressIn', {});
        expect(timing).toHaveBeenCalledTimes(2);
    } finally {
        jest.restoreAllMocks();
    }
});
