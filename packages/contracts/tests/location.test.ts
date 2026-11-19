import { describe, expect, it } from 'vitest';
import { locationSchema } from '../src/index.js';

describe('localização de uma denúncia', () => {
    it('aceita um ponto manual inclusive nas coordenadas zero', () => {
        expect(locationSchema.parse({ latitude: 0, longitude: 0, source: 'MANUAL' })).toEqual({
            latitude: 0,
            longitude: 0,
            source: 'MANUAL',
        });
    });

    it.each([
        { latitude: 91, longitude: 0, source: 'GPS' },
        { latitude: 0, longitude: -181, source: 'GPS' },
        { latitude: '0', longitude: 0, source: 'GPS' },
        { latitude: 0, longitude: 0, source: 'SEED' },
        { latitude: 0, source: 'GPS' },
    ])('rejeita uma localização inválida: %j', (location) => {
        expect(locationSchema.safeParse(location).success).toBe(false);
    });
});
