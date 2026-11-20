import { describe, expect, it } from 'vitest';
import { canTransition } from '../src/modules/reports/index.js';

describe('transições públicas de atendimento', () => {
    it.each([
        ['SENT', 'UNDER_REVIEW'],
        ['UNDER_REVIEW', 'IN_PROGRESS'],
        ['UNDER_REVIEW', 'REJECTED'],
        ['IN_PROGRESS', 'RESOLVED'],
        ['RESOLVED', 'UNDER_REVIEW'],
        ['REJECTED', 'UNDER_REVIEW'],
        ['CANCELED', 'UNDER_REVIEW'],
    ] as const)('permite ao gestor %s → %s', (from, to) => {
        expect(canTransition({ from, to, role: 'MANAGER', isAuthor: false })).toBe(true);
    });

    it.each([
        ['UNDER_REVIEW', 'SENT', 'SENT', true],
        ['IN_PROGRESS', 'UNDER_REVIEW', 'UNDER_REVIEW', true],
        ['UNDER_REVIEW', 'SENT', 'IN_PROGRESS', false],
        ['UNDER_REVIEW', 'SENT', 'RESOLVED', false],
        ['UNDER_REVIEW', 'SENT', 'REJECTED', false],
        ['UNDER_REVIEW', 'SENT', 'CANCELED', false],
        ['UNDER_REVIEW', 'SENT', undefined, false],
        ['IN_PROGRESS', 'UNDER_REVIEW', undefined, false],
    ] as const)('correção %s → %s com etapa anterior %s: %s', (from, to, previousStatus, allowed) => {
        expect(canTransition({ from, to, previousStatus, role: 'MANAGER', isAuthor: false })).toBe(allowed);
    });

    it.each(['SENT', 'UNDER_REVIEW'] as const)('autor cancela em %s', (from) => {
        expect(canTransition({ from, to: 'CANCELED', role: 'CITIZEN', isAuthor: true })).toBe(true);
    });

    it.each([
        ['SENT', 'RESOLVED', 'MANAGER', false],
        ['IN_PROGRESS', 'SENT', 'MANAGER', false],
        ['RESOLVED', 'IN_PROGRESS', 'MANAGER', false],
        ['REJECTED', 'SENT', 'MANAGER', false],
        ['RESOLVED', 'UNDER_REVIEW', 'CITIZEN', true],
        ['CANCELED', 'UNDER_REVIEW', 'CITIZEN', true],
        ['SENT', 'CANCELED', 'CITIZEN', false],
        ['IN_PROGRESS', 'CANCELED', 'CITIZEN', true],
        ['SENT', 'UNDER_REVIEW', 'CITIZEN', true],
        ['SENT', 'CANCELED', 'MANAGER', false],
    ] as const)('bloqueia %s → %s por %s', (from, to, role, isAuthor) => {
        expect(canTransition({ from, to, role, isAuthor })).toBe(false);
    });
});
