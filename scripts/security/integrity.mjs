import { createHash } from 'node:crypto';

export function verifySha256(bytes, expected) {
    return /^[a-f0-9]{64}$/.test(expected) && createHash('sha256').update(bytes).digest('hex') === expected;
}
