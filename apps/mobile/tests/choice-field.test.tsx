import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ChoiceField } from '../src/prototype/choice-field';

it('mantém a seleção de categoria dentro da prévia web após redimensionar a janela', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    let bounds = { left: 445, top: 52, width: 390, height: 772 };
    const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const events = new EventTarget();
    const properties = ['addEventListener', 'removeEventListener'] as const;
    const previous = properties.map((name) => Object.getOwnPropertyDescriptor(window, name));
    for (const name of properties) Object.defineProperty(window, name, { configurable: true, value: events[name].bind(events) });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => ({ getBoundingClientRect: () => bounds }) } });
    try {
        await render(<ChoiceField label="Categoria" placeholder="Todas" value={null} options={[{ label: 'Vias', value: 'vias' }]} onChange={jest.fn()} />);
        await fireEvent.press(screen.getByRole('button', { name: 'Categoria' }));
        const stage = () => screen.getByTestId('choice-sheet');
        expect(stage()).toHaveStyle(bounds);
        bounds = { left: 0, top: 28, width: 320, height: 602 };
        await act(() => {
            events.dispatchEvent(new Event('resize'));
        });
        expect(stage()).toHaveStyle(bounds);
        await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    } finally {
        if (original) Object.defineProperty(globalThis, 'document', original);
        else Reflect.deleteProperty(globalThis, 'document');
        properties.forEach((name, i) => {
            if (previous[i]) Object.defineProperty(window, name, previous[i]!);
            else Reflect.deleteProperty(window, name);
        });
        jest.restoreAllMocks();
    }
});
