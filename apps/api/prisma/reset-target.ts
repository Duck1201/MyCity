export function resetTarget(raw: string) {
    const target = URL.canParse(raw) ? new URL(raw) : null;
    if (!target || process.env.NODE_ENV === 'production' || !['postgresql:', 'postgres:'].includes(target.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/mycity' || target.hash || (target.search !== '' && target.search !== '?schema=public')) {
        throw new Error('O reset exige o banco local mycity no schema public de desenvolvimento.');
    }
    // node-postgres otherwise inherits PGPORT while Prisma defaults to 5432.
    if (!target.port) target.port = '5432';
    return target;
}
