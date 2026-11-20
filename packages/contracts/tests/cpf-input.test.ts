import { expect, it } from 'vitest';
import { formatCpfInput, cpfDigits } from '../src/index.js';
it.each([
    ['', ''],
    ['0', '0'],
    ['000', '000'],
    ['0001', '000.1'],
    ['0001234', '000.123.4'],
    ['0001234567', '000.123.456-7'],
    ['00000000003', '000.000.000-03'],
    [' 000.000.000-03 ', '000.000.000-03'],
])('formata os separadores sem perder zeros durante a edição de %j', (input, formatted) => {
    expect(formatCpfInput(input)).toBe(formatted);
    expect(formatCpfInput(formatted)).toBe(formatted);
});
it('extrai os dígitos do CPF como texto sem converter o identificador em número', () => {
    expect(cpfDigits(' 000.000.000-03 ')).toBe('00000000003');
});
