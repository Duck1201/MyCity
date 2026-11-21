import filesystem from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import express from 'express';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createDatabase } from '../src/database.js';
import { createReportsRouter } from '../src/modules/reports/index.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw new Error('Use o banco local de teste.');
const db = createDatabase(url.toString());
const dir = await mkdtemp(join(tmpdir(), 'mycity-reports-'));
const citizen = { id: randomUUID(), role: 'CITIZEN' as const };
const pageCategory = randomUUID();
const manager = { id: randomUUID(), role: 'MANAGER' as const };
const appFor = (actor: typeof citizen | typeof manager, transport: 'cookie' | 'bearer' = 'cookie') =>
    express()
        .use((_req, res, next) => {
            res.locals.user = actor;
            res.locals.transport = transport;
            next();
        })
        .use('/api/v1/reports', createReportsRouter(db, dir));
const meta = { category: 'POTHOLE', description: 'Rua do teste', location: { latitude: 0, longitude: -40, source: 'GPS' }, showIdentity: false, clientRequestId: randomUUID() };
const jpeg = await sharp({ create: { width: 2, height: 3, channels: 3, background: 'red' } })
    .jpeg()
    .toBuffer();
const upload = (metadata = meta, photos = [jpeg], actor: typeof citizen | typeof manager = citizen) => {
    const op = request(appFor(actor)).post('/api/v1/reports').field('metadata', JSON.stringify(metadata));
    for (const photo of photos) op.attach('photos', photo, 'imagem.jpg');
    return op;
};
beforeAll(async () => {
    await db.user.create({ data: { ...citizen, cpf: '00000000082', password: 'fixture' } });
});
afterAll(async () => {
    await db.report.deleteMany({ where: { authorId: citizen.id } });
    await db.reportCategoryDefinition.deleteMany({ where: { id: pageCategory } });
    await db.user.deleteMany({ where: { id: citizen.id } });
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true });
});

it('publica uma denúncia e uma foto visíveis ao gestor sem expor autor anônimo', async () => {
    const response = await upload().expect(201);
    const report = response.body.data;
    expect(report).toMatchObject({ category: 'POTHOLE', description: meta.description, status: 'SENT', isMine: true, location: meta.location, photos: [{ width: 2, height: 3, position: 0 }] });
    const detail = await request(appFor(manager))
        .get('/api/v1/reports/' + report.id)
        .expect(200);
    expect(detail.body.data).not.toHaveProperty('author');
    expect(JSON.stringify(detail.body)).not.toContain(citizen.id);
    await request(appFor(manager))
        .get(report.photos[0].contentPath)
        .expect('Content-Type', /image\/jpeg/)
        .expect(200);
    const list = await request(appFor(manager)).get('/api/v1/reports?scope=management').expect(200);
    expect(list.body.data).toContainEqual(expect.objectContaining({ id: report.id, isMine: false }));
});

it('exige perfil provisionado para exibir identificação e retorna apenas nome e retrato', async () => {
    const metadata = { ...meta, clientRequestId: randomUUID(), showIdentity: true };
    await upload(metadata).expect(409);
    const photoUrl = 'data:image/jpeg;base64,' + jpeg.toString('base64');
    await db.profile.create({ data: { userId: citizen.id, name: 'Perfil de teste', photoUrl } });
    const created = await upload(metadata).expect(201);
    const detail = await request(appFor(manager))
        .get('/api/v1/reports/' + created.body.data.id)
        .expect(200);
    expect(detail.body.data.author).toEqual({ name: 'Perfil de teste', photoUrl });
});

it('serializa dois envios iguais, rejeita mudanças e mantém um evento e três fotos ordenadas', async () => {
    const key = { ...meta, clientRequestId: randomUUID() };
    const rotated = await sharp({ create: { width: 7, height: 4, channels: 3, background: 'blue' } })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer();
    const photos = [jpeg, rotated, jpeg];
    const before = await readdir(dir);
    const replies = await Promise.all([upload(key, photos), upload(key, photos)]);
    expect(replies.map((r) => r.status).sort()).toEqual([200, 201]);
    const report = replies[0]!.body.data;
    expect(replies[1]!.body.data.id).toEqual(report.id);
    expect(report.photos.map((p: { width: number; height: number }) => [p.width, p.height])).toEqual([
        [2, 3],
        [4, 7],
        [2, 3],
    ]);
    const stored = await request(appFor(manager)).get(report.photos[1].contentPath).expect(200);
    const info = await sharp(stored.body).metadata();
    expect(info.exif).toBeUndefined();
    expect(info.orientation).toBeUndefined();
    expect(await db.reportEvent.findMany({ where: { reportId: report.id }, select: { type: true, toStatus: true, actorId: true } })).toEqual([{ type: 'CREATED', toStatus: 'SENT', actorId: citizen.id }]);
    await upload({ ...key, description: 'Outro conteúdo' }, photos).expect(409);
    await upload(key, [rotated, jpeg, jpeg]).expect(409);
    expect((await readdir(dir)).length).toBe(before.length + 1);
});

it('rejeita anexos inválidos ou fora dos limites sem gravar denúncia nem arquivo', async () => {
    const before = await readdir(dir);
    const invalidPhotos = [
        [],
        [jpeg, jpeg, jpeg, jpeg],
        [jpeg, Buffer.from('imagem danificada')],
        [Buffer.alloc(5 * 1024 * 1024 + 1)],
        [
            await sharp({ create: { width: 1601, height: 1, channels: 3, background: 'red' } })
                .jpeg()
                .toBuffer(),
        ],
    ];
    for (const photos of invalidPhotos) {
        const key = { ...meta, clientRequestId: randomUUID() };
        await upload(key, photos).expect(422);
        expect(await db.report.count({ where: { clientRequestId: key.clientRequestId } })).toBe(0);
    }
    await upload({ ...meta, clientRequestId: randomUUID() }, [Buffer.alloc(16 * 1024 * 1024)]).expect(413);
    expect(await readdir(dir)).toEqual(before);
});

it('consulta de outra foto, gestão por cidadão e envio por gestor são recusados', async () => {
    await db.reportCategoryDefinition.create({ data: { id: pageCategory, name: 'Paginação ' + pageCategory, nameKey: pageCategory } });
    const publish = () => upload({ ...meta, category: pageCategory, clientRequestId: randomUUID() }).expect(201);
    const first = await publish();
    const second = await publish();
    await request(appFor(manager))
        .get('/api/v1/reports/' + first.body.data.id + '/photos/' + second.body.data.photos[0].id)
        .expect(404);
    await request(appFor(citizen)).get('/api/v1/reports?scope=management').expect(403);
    const before = await readdir(dir);
    await upload({ ...meta, clientRequestId: randomUUID() }, [jpeg], manager).expect(403);
    expect(await readdir(dir)).toEqual(before);
    const filters = { scope: 'management', limit: 1, category: pageCategory };
    const page = await request(appFor(manager)).get('/api/v1/reports').query(filters).expect(200);
    expect(page.body.data.map((item: { id: string }) => item.id)).toEqual([first.body.data.id]);
    expect(page.body.page.nextCursor).toBeTruthy();
    const next = await request(appFor(manager))
        .get('/api/v1/reports')
        .query({ ...filters, cursor: page.body.page.nextCursor })
        .expect(200);
    expect(next.body.data.map((item: { id: string }) => item.id)).toEqual([second.body.data.id]);
    expect(next.body.page.nextCursor).toBeNull();
});

it('remove fotos preparadas quando o banco recusa a criação inteira', async () => {
    const missingCitizen = { id: randomUUID(), role: 'CITIZEN' as const };
    const before = await readdir(dir);
    const key = { ...meta, clientRequestId: randomUUID() };
    await upload(key, [jpeg], missingCitizen).expect(500);
    expect(await readdir(dir)).toEqual(before);
    expect(await db.report.count({ where: { clientRequestId: key.clientRequestId } })).toBe(0);
});

it('recusa envio antes da escrita quando a reserva do volume está comprometida', async () => {
    const before = await readdir(dir);
    const free = await filesystem.statfs(dir);
    const stats = vi.spyOn(filesystem, 'statfs').mockResolvedValue({ ...free, bavail: 1, bsize: 4096 });
    try {
        const response = await upload({ ...meta, clientRequestId: randomUUID() }).expect(507);
        expect(response.body.error.code).toBe('INSUFFICIENT_STORAGE');
    } finally {
        stats.mockRestore();
    }
    expect(await readdir(dir)).toEqual(before);
});

it('protege detalhe e foto cancelados contra acesso de outro cidadão', async () => {
    const report = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    await db.report.update({ where: { id: report.id }, data: { status: 'CANCELED' } });
    const other = appFor({ id: randomUUID(), role: 'CITIZEN' });
    for (const path of ['/api/v1/reports/' + report.id, report.photos[0].contentPath]) {
        await request(other).get(path).expect(404);
        await request(appFor(citizen)).get(path).expect(200);
        await request(appFor(manager)).get(path).expect(200);
    }
});

const immutablePrivate = 'private, max-age=31536000, immutable';
const binary = (res: request.Response, callback: (error: Error | null, body: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
};

it('não deixa o cache HTTP do app guardar as fotos', async () => {
    const report = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    const [photo] = report.photos;
    for (const path of [photo.contentPath, photo.thumbnailPath]) {
        const fromApp = await request(appFor(manager, 'bearer')).get(path).buffer(true).parse(binary).expect(200);
        expect(fromApp.headers['cache-control']).toBe('no-store');
    }
});

it('gera no envio uma miniatura de até 320 px servida com cache privado e imutável', async () => {
    const large = await sharp({ create: { width: 1200, height: 900, channels: 3, background: 'blue' } })
        .jpeg()
        .toBuffer();
    const report = (await upload({ ...meta, clientRequestId: randomUUID() }, [large, jpeg]).expect(201)).body.data;
    const [wide, tiny] = report.photos;
    expect(wide.thumbnailPath).toBe(wide.contentPath + '/thumb');
    const thumb = await request(appFor(manager))
        .get(wide.thumbnailPath)
        .buffer(true)
        .parse(binary)
        .expect('Content-Type', /image\/jpeg/)
        .expect(200);
    expect(thumb.headers['cache-control']).toBe(immutablePrivate);
    expect(await sharp(thumb.body).metadata()).toMatchObject({ format: 'jpeg', width: 320, height: 240 });
    const original = await request(appFor(manager)).get(wide.contentPath).buffer(true).parse(binary).expect(200);
    expect(original.headers['cache-control']).toBe(immutablePrivate);
    expect(await sharp(original.body).metadata()).toMatchObject({ width: 1200, height: 900 });
    expect(thumb.body.length).toBeLessThan(original.body.length);
    // Small photos are never enlarged.
    const small = await request(appFor(manager)).get(tiny.thumbnailPath).buffer(true).parse(binary).expect(200);
    expect(await sharp(small.body).metadata()).toMatchObject({ width: 2, height: 3 });
});

it('aplica à miniatura a mesma autorização da foto original', async () => {
    const first = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    const second = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    await request(appFor(manager))
        .get('/api/v1/reports/' + first.id + '/photos/' + second.photos[0].id + '/thumb')
        .expect(404);
    await db.report.update({ where: { id: first.id }, data: { status: 'CANCELED' } });
    const other = await request(appFor({ id: randomUUID(), role: 'CITIZEN' }))
        .get(first.photos[0].thumbnailPath)
        .expect(404);
    expect(other.headers['cache-control']).not.toBe(immutablePrivate);
    await request(appFor(citizen)).get(first.photos[0].thumbnailPath).expect(200);
});

it('serve a original no lugar de uma miniatura ainda não gerada', async () => {
    const report = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    await rm(join(dir, report.id, report.photos[0].id + '.thumb.jpg'));
    const response = await request(appFor(manager)).get(report.photos[0].thumbnailPath).buffer(true).parse(binary).expect(200);
    expect(response.body.equals(await readFile(join(dir, report.id, report.photos[0].id + '.jpg')))).toBe(true);
});
