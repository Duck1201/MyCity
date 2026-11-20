import { renderToStaticMarkup } from 'react-dom/server';
import { Icon } from '../src/prototype/civic-header';

jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('react-native-svg', () => jest.requireActual('react-native-svg/src/elements.web'));

it('renderiza um ícone decorativo no DOM com atributos de acessibilidade da web', () => {
    const errors = jest.spyOn(console, 'error');
    try {
        const markup = renderToStaticMarkup(<Icon name="pin" />);
        expect(markup).toContain('aria-hidden="true"');
        expect(markup).toContain('tabindex="-1"');
        expect(errors).not.toHaveBeenCalled();
    } finally {
        errors.mockRestore();
    }
});
