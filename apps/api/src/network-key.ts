import { isIPv6 } from 'node:net';

export function networkKey(ip: string) {
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return mapped[1]!;
    if (!isIPv6(ip)) return ip;
    const [left, right] = ip.split('::');
    const head = left ? left.split(':') : [];
    const tail = right ? right.split(':') : [];
    const words = [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail];
    return (
        words
            .slice(0, 4)
            .map((word) => Number.parseInt(word, 16).toString(16))
            .join(':') + '::/64'
    );
}
