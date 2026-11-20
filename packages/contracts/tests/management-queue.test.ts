import { describe, expect, it } from 'vitest';
import { csvLine } from '../src/management-queue';

describe('csvLine', () => {
    it.each(['=1+1', '+1', '-2', '@SUM(A1)', '  =cmd', '＝1', '\tvalue', '\rvalue', '\nvalue'])('neutraliza o valor %j que uma planilha executaria como fórmula', (value) => {
        expect(csvLine([value])).toBe('"\'' + value + '"');
    });

    it('preserva texto comum, números negativos e escapa aspas, separadores e quebras de linha', () => {
        expect(csvLine(['Rua; "com aspas"\nSegunda linha', -20.75, 3, 'Buraco na via'])).toBe('"Rua; ""com aspas""\nSegunda linha";"-20.75";"3";"Buraco na via"');
    });
});
