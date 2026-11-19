import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

function derive(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
            if (error) reject(error);
            else resolve(key);
        });
    });
}

export async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = await derive(password, salt);
    return `scrypt$32768$8$1$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded?: string) {
    const match = encoded?.match(/^scrypt\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/);
    const key = await derive(password, match?.[1] ?? '00000000000000000000000000000000');
    if (!match?.[2]) return false;
    return timingSafeEqual(key, Buffer.from(match[2], 'hex'));
}
