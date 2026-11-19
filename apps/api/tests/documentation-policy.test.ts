import { expect, it } from 'vitest';
import { apiListenHost } from '../src/documentation-policy.js';

it('limita o listener ao loopback quando Swagger está habilitado', () => {
    expect(apiListenHost({ environment: 'development', enableDocs: true })).toBe('127.0.0.1');
    expect(apiListenHost({ environment: 'development', enableDocs: false })).toBe('0.0.0.0');
    expect(apiListenHost({ environment: 'production', enableDocs: true })).toBe('0.0.0.0');
});
