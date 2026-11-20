import { expect, it } from 'vitest';
import { readDemoConfirmations, readDemoStatuses, readDemoTrail, writeDemoConfirmation, writeDemoStatus } from '../src/prototype/confirmation-store';

it('preserves a single confirmation per eligible report and ignores own, closed and unknown examples', () => {
    localStorage.clear();
    writeDemoConfirmation(1048, true);
    writeDemoConfirmation(1048, true);
    writeDemoConfirmation(1047, true);
    for (const id of [1042, 1038, 1037, 9000]) writeDemoConfirmation(id, true);
    expect(readDemoConfirmations()).toEqual([1048, 1047]);
    writeDemoConfirmation(1048, false);
    expect(readDemoConfirmations()).toEqual([1047]);
});

it('freezes a confirmation once the manager closes its case and restores the final state on the next read', () => {
    localStorage.clear();
    writeDemoConfirmation(1048, true);
    writeDemoStatus(1048, 'UNDER_REVIEW');
    writeDemoStatus(1048, 'REJECTED');
    expect(readDemoStatuses()[1048]).toBe('REJECTED');
    expect(writeDemoConfirmation(1048, false)).toBe(false);
    expect(readDemoConfirmations()).toContain(1048);
});

it('persiste a correção de um avanço e impede encadear um segundo recuo', () => {
    localStorage.clear();
    writeDemoStatus(1048, 'UNDER_REVIEW');
    writeDemoStatus(1048, 'IN_PROGRESS');
    writeDemoStatus(1048, 'UNDER_REVIEW');
    writeDemoStatus(1048, 'SENT');
    expect(readDemoStatuses()[1048]).toBe('UNDER_REVIEW');
    writeDemoStatus(1036, 'UNDER_REVIEW');
    writeDemoStatus(1036, 'SENT');
    expect(readDemoStatuses()[1036]).toBe('UNDER_REVIEW');
});

it('restaura a justificativa de uma rejeição em uma trilha anterior à gravação de motivos', () => {
    localStorage.clear();
    localStorage.setItem('mycity.preview.status.v1:1048', JSON.stringify(['SENT', 'UNDER_REVIEW']));
    expect(writeDemoStatus(1048, 'REJECTED', 'Registro duplicado.')).toBe(true);
    expect(writeDemoStatus(1048, 'UNDER_REVIEW')).toBe(true);
    expect(readDemoTrail(1048)).toEqual([{ status: 'SENT' }, { status: 'UNDER_REVIEW' }, { status: 'REJECTED', reason: 'Registro duplicado.' }, { status: 'UNDER_REVIEW' }]);
    expect(readDemoStatuses()[1048]).toBe('UNDER_REVIEW');
});
