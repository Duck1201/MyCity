import { AccessibilityInfo, Animated, Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { ScreenTransition } from '../src/components/navigation-motion';

afterEach(() => jest.restoreAllMocks());

it('apresenta o destino imediatamente, conserva a animação durante atualização e interrompe ao reduzir movimento', async () => {
    let changePreference: ((value: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((name, callback) => {
        if (name === 'reduceMotionChanged') changePreference = callback as (v: boolean) => void;
        return { remove: jest.fn() };
    });
    const stop = jest.fn();
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop, reset: jest.fn() }));
    const page = (route: string, depth: number, text: string) => (
        <ScreenTransition route={route} depth={depth}>
            <Text>{text}</Text>
        </ScreenTransition>
    );
    const view = await render(page('lista', 0, 'Lista'));
    await view.rerender(page('detalhe', 1, 'Relato'));
    expect(screen.getByText('Relato')).toBeVisible();
    expect(timing).toHaveBeenCalled();
    const moves = timing.mock.calls.length;
    await view.rerender(page('detalhe', 1, 'Relato atualizado'));
    expect(timing).toHaveBeenCalledTimes(moves);
    await act(() => changePreference?.(true));
    expect(stop).toHaveBeenCalled();
    await view.rerender(page('lista', 0, 'Lista'));
    expect(screen.getByText('Lista')).toBeVisible();
    expect(timing).toHaveBeenCalledTimes(moves);
});
