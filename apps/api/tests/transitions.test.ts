import { describe, expect, it } from 'vitest';
import { canTransition } from '../src/modules/reports/index.js';

describe('transições públicas de atendimento', () => {
    it.each([
        ['SENT', 'UNDER_REVIEW'],
        ['UNDER_REVIEW', 'IN_PROGRESS'],
        ['UNDER_REVIEW', 'REJECTED'],
        ['IN_PROGRESS', 'RESOLVED'],
    ] as const)('permite ao gestor %s → %s', (from, to) => {
        expect(canTransition({ from, to, role: 'MANAGER', isAuthor: false })).toBe(true);
    });

    it.each(['SENT', 'UNDER_REVIEW'] as const)('autor cancela em %s', (from) => {
        expect(canTransition({ from, to: 'CANCELED', role: 'CITIZEN', isAuthor: true })).toBe(true);
    });

    it.each([
        ['SENT', 'RESOLVED', 'MANAGER', false],
        ['UNDER_REVIEW', 'SENT', 'MANAGER', false],
        ['RESOLVED', 'UNDER_REVIEW', 'MANAGER', false],
        ['REJECTED', 'UNDER_REVIEW', 'MANAGER', false],
        ['CANCELED', 'UNDER_REVIEW', 'MANAGER', false],
        ['SENT', 'CANCELED', 'CITIZEN', false],
        ['IN_PROGRESS', 'CANCELED', 'CITIZEN', true],
        ['SENT', 'UNDER_REVIEW', 'CITIZEN', true],
        ['SENT', 'CANCELED', 'MANAGER', false],
    ] as const)('bloqueia %s → %s por %s', (from, to, role, isAuthor) => {
        expect(canTransition({ from, to, role, isAuthor })).toBe(false);
    });
});
