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

it('protege detalhe, original e miniatura cancelados sem atendimento contra acesso de terceiros', async () => {
    const report = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    await db.report.update({ where: { id: report.id }, data: { status: 'CANCELED' } });
    const other = appFor({ id: randomUUID(), role: 'CITIZEN' });
    for (const path of ['/api/v1/reports/' + report.id, report.photos[0].contentPath, report.photos[0].thumbnailPath]) {
        await request(other).get(path).expect(404);
        await request(appFor(citizen)).get(path).expect(200);
        await request(appFor(manager)).get(path).expect(404);
    }
});

const revalidatedPrivate = 'private, no-cache';
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

it('gera no envio uma miniatura de até 320 px servida com cache privado com revalidação', async () => {
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
    expect(thumb.headers['cache-control']).toBe(revalidatedPrivate);
    expect(await sharp(thumb.body).metadata()).toMatchObject({ format: 'jpeg', width: 320, height: 240 });
    const original = await request(appFor(manager)).get(wide.contentPath).buffer(true).parse(binary).expect(200);
    expect(original.headers['cache-control']).toBe(revalidatedPrivate);
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
    expect(other.headers['cache-control']).not.toBe(revalidatedPrivate);
    await request(appFor(citizen)).get(first.photos[0].thumbnailPath).expect(200);
});

it('serve a original no lugar de uma miniatura ainda não gerada', async () => {
    const report = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    await rm(join(dir, report.id, report.photos[0].id + '.thumb.jpg'));
    const response = await request(appFor(manager)).get(report.photos[0].thumbnailPath).buffer(true).parse(binary).expect(200);
    expect(response.body.equals(await readFile(join(dir, report.id, report.photos[0].id + '.jpg')))).toBe(true);
});

it('vence o acesso às fotos e capas no instante do prazo, antes da limpeza', async () => {
    const report = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    const viewer = request(appFor(manager));
    const path = '/api/v1/reports/' + report.id;
    const deadline = new Date('2031-05-04T12:00:00.000Z');
    await db.report.update({ where: { id: report.id }, data: { status: 'RESOLVED', photosExpireAt: deadline } });
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        vi.setSystemTime(deadline.getTime() - 1);
        const before = await viewer.get(path).expect(200);
        expect(before.body.data).toMatchObject({ photosExpireAt: deadline.toISOString(), coverPhoto: { id: report.photos[0].id } });
        for (const url of [report.photos[0].contentPath, report.photos[0].thumbnailPath]) await viewer.get(url).expect(200);
        vi.setSystemTime(deadline);
        for (const url of [report.photos[0].contentPath, report.photos[0].thumbnailPath]) await viewer.get(url).expect(404);
        const expired = (await viewer.get(path).expect(200)).body.data;
        expect(expired).toMatchObject({ photosExpireAt: deadline.toISOString(), photos: [] });
        expect(expired).not.toHaveProperty('coverPhoto');
        const list = (await viewer.get('/api/v1/reports').query({ scope: 'resolved' }).expect(200)).body.data;
        const entry = list.find((row: { id: string }) => row.id === report.id);
        expect(entry).toMatchObject({ photosExpireAt: deadline.toISOString() });
        expect(entry).not.toHaveProperty('coverPhoto');
        const queue = await viewer.get('/api/v1/reports/queue').query({ q: report.id }).expect(200);
        expect(queue.body.data).toMatchObject([{ id: report.id, coverPhotoId: null, photosExpireAt: deadline.toISOString() }]);
    } finally {
        vi.useRealTimers();
    }
});

it('permite editar o formulário inteiro antes do atendimento, mantendo o replay da criação', async () => {
    const key = { ...meta, clientRequestId: randomUUID() };
    const original = (await upload(key, [jpeg, jpeg, jpeg]).expect(201)).body.data;
    const path = '/api/v1/reports/' + original.id;
    await request(appFor(manager)).get(path).expect(200);
    const [first, removed, last] = original.photos;
    await db.profile.upsert({ where: { userId: citizen.id }, update: {}, create: { userId: citizen.id, name: 'Perfil fictício', photoUrl: 'data:image/jpeg;base64,' + jpeg.toString('base64') } });
    const fields = { expectedVersion: 1, category: 'TREE', location: { latitude: -10, longitude: -30, source: 'MANUAL' }, description: ' Relato corrigido ', showIdentity: true, retainedPhotoIds: [last.id, first.id] };
    const edit = (metadata = fields) => request(appFor(citizen)).patch(path).field('metadata', JSON.stringify(metadata)).attach('photos', jpeg, 'nova.jpg');
    const result = (await edit().expect(200)).body.data;
    expect(result).toMatchObject({ description: 'Relato corrigido', category: 'TREE', location: fields.location, version: 2, photos: [{ id: last.id, position: 0 }, { id: first.id, position: 1 }, { position: 2 }] });
    expect(result.allowedActions).toContain('EDIT');
    expect((await upload(key, [jpeg, jpeg, jpeg]).expect(200)).body.data).toEqual(result);
    await request(appFor(citizen)).get(removed.contentPath).expect(404);
    expect(await readdir(join(dir, original.id))).not.toContain(removed.id + '.thumb.jpg');
    await edit().expect(409);
    for (const ids of [[first.id, first.id], [randomUUID()], [first.id, last.id, result.photos[2].id]]) {
        await edit({ ...fields, expectedVersion: 2, retainedPhotoIds: ids }).expect(422);
    }
    expect(await readdir(join(dir, original.id))).toHaveLength(6);
    await request(appFor(manager)).patch(path).send('inválido').expect(403);
    await request(appFor({ id: randomUUID(), role: 'CITIZEN' }))
        .patch(path)
        .send('inválido')
        .expect(403);
});

it('edita e reabre a cancelada sem atendimento uma única vez, preservando privacidade até o salvamento', async () => {
    const report = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    const foreign = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    const path = '/api/v1/reports/' + report.id;
    const inactive = await request(appFor(citizen))
        .post(path + '/cancellation')
        .send({ expectedVersion: 1 })
        .expect(200);
    expect(inactive.body.data.allowedActions).toEqual(['EDIT', 'REOPEN']);
    const queue = () => request(appFor(manager)).get('/api/v1/reports/queue').query({ q: report.id }).expect(200);
    const fields = { expectedVersion: 2, category: 'TREE', description: 'Ponto corrigido', showIdentity: false, location: meta.location, retainedPhotoIds: [report.photos[0].id] };
    const edit = (ids: string[]) =>
        request(appFor(citizen))
            .patch(path)
            .field('metadata', JSON.stringify({ ...fields, retainedPhotoIds: ids }));
    await request(appFor(citizen)).patch(path).field('metadata', '{').expect(422);
    await edit([foreign.photos[0].id]).expect(422);
    expect((await queue()).body.total).toBe(0);
    const canceled = (await request(appFor(citizen)).get(path).expect(200)).body.data;
    expect(canceled).toEqual(inactive.body.data);
    const results = await Promise.all([edit(fields.retainedPhotoIds), edit(fields.retainedPhotoIds)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const changed = results.find((r) => r.status === 200)!.body.data;
    expect(changed).toMatchObject({ status: 'SENT', version: 3, description: fields.description, photos: [{ id: fields.retainedPhotoIds[0] }] });
    expect(changed).not.toHaveProperty('photosExpireAt');
    expect((await queue()).body.total).toBe(1);
    const history = (
        await request(appFor(citizen))
            .get(path + '/history')
            .expect(200)
    ).body.data;
    expect(history).toHaveLength(3);
    expect(history[2]).toMatchObject({ type: 'STATUS_CHANGED', actorRole: 'CITIZEN', fromStatus: 'CANCELED', toStatus: 'SENT' });
    expect(await db.notification.count({ where: { reportId: report.id, status: 'SENT', recipientId: citizen.id } })).toBe(1);
});

it('reabre com novas fotos depois do vencimento sem restaurar os anexos antigos', async () => {
    const report = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    const path = '/api/v1/reports/' + report.id;
    await request(appFor(citizen))
        .post(path + '/cancellation')
        .send({ expectedVersion: 1 })
        .expect(200);
    await db.report.update({ where: { id: report.id }, data: { photosExpireAt: new Date(0) } });
    const fields = { expectedVersion: 2, category: 'TREE', description: 'Nova amostra', showIdentity: false, location: meta.location };
    const edit = (retainedPhotoIds: string[]) =>
        request(appFor(citizen))
            .patch(path)
            .field('metadata', JSON.stringify({ ...fields, retainedPhotoIds }))
            .attach('photos', jpeg, 'nova.jpg');
    await edit([report.photos[0].id]).expect(422);
    const changed = (await edit([]).expect(200)).body.data;
    expect(changed).toMatchObject({ status: 'SENT', version: 3 });
    expect(changed.photos).toHaveLength(1);
    expect(changed.photos[0].id).not.toBe(report.photos[0].id);
    await request(appFor(citizen)).get(report.photos[0].contentPath).expect(404);
    await request(appFor(citizen)).get(changed.photos[0].contentPath).expect(200);
});

it('preserva os JPEG até a reconciliação se o banco falha ao concluir o commit da edição', async () => {
    const report = (await upload({ ...meta, clientRequestId: randomUUID() }).expect(201)).body.data;
    const path = '/api/v1/reports/' + report.id;
    await request(appFor(citizen))
        .post(path + '/cancellation')
        .send({ expectedVersion: 1 })
        .expect(200);
    // A deferred error is raised after the transaction callback has finished.
    await db.$executeRawUnsafe("CREATE FUNCTION test_edit_commit_error() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic commit failure'; END $$");
    try {
        await db.$executeRawUnsafe("CREATE CONSTRAINT TRIGGER test_edit_commit_error AFTER UPDATE ON reports DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.description = 'Ensaio de commit diferido') EXECUTE FUNCTION test_edit_commit_error()");
        const edit = { expectedVersion: 2, category: 'TREE', description: 'Ensaio de commit diferido', showIdentity: false, location: meta.location, retainedPhotoIds: [] };
        await request(appFor(citizen)).patch(path).field('metadata', JSON.stringify(edit)).attach('photos', jpeg, 'nova.jpg').expect(500);
        const unchanged = (await request(appFor(citizen)).get(path).expect(200)).body.data;
        expect(unchanged).toMatchObject({ status: 'CANCELED', version: 2, photos: [{ id: report.photos[0].id }] });
        expect((await readdir(join(dir, report.id))).length).toBe(4);
        await request(appFor(manager)).get(path).expect(404);
        expect(await db.reportEvent.count({ where: { reportId: report.id } })).toBe(2);
    } finally {
        await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_edit_commit_error ON reports');
        await db.$executeRawUnsafe('DROP FUNCTION test_edit_commit_error()');
    }
});
