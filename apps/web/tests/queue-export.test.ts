import { afterEach, expect, it, vi } from 'vitest';
import { records } from '../src/prototype/demo';
import { exportQueue } from '../src/prototype/queue-export';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

it('downloads only the supplied rows, encoding labels, accents, delimiters, line breaks and spreadsheet text safely', async () => {
    const create = vi.fn<(file: Blob) => string>().mockReturnValue('blob:queue-export');
    const revoke = vi.fn();
    vi.stubGlobal(
        'URL',
        class extends URL {
            static override createObjectURL = create;
            static override revokeObjectURL = revoke;
        },
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.href).toBe('blob:queue-export');
        expect(this.download).toMatch(/\.csv$/);
    });
    const first = { ...records[0]!, address: 'Rua; "com aspas"\nSegunda linha', id: '  =1+1', count: 12 };
    const second = { ...records[1]!, id: '+1', address: '@texto' };

    vi.useFakeTimers();
    exportQueue([second, first]);
    expect(click).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:queue-export');
    vi.useRealTimers();

    const file = create.mock.calls[0]![0];
    expect(file.type).toBe('text/csv;charset=utf-8');
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
    expect(Array.from(new Uint8Array(bytes).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(['"Protocolo";"Categoria";"Relato";"Endereço";"Situação";"Data de registro";"Confirmações"', `"'+1";"Iluminação pública";"${second.description}";"'@texto";"Em análise";"${second.date}";"${second.count}"`, `"'  =1+1";"Buraco na via";"${first.description}";"Rua; ""com aspas""\nSegunda linha";"Enviado";"${first.date}";"12"`].join('\r\n'));
});
