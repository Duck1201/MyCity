import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { hashPassword } from '../src/modules/identity/password.js';

const url = new URL(process.env.DATABASE_URL!);
if (url.pathname !== '/mycity_test' || !['localhost', 'test-db', '127.0.0.1'].includes(url.hostname)) throw Error('Use o banco de teste isolado.');
const db = createDatabase(url.href);
const directory = await mkdtemp(join(tmpdir(), 'mycity-category-'));
const app = createApp(db, { uploadDir: directory });
const userIds: string[] = [];
const tokens: Record<string, string> = {};
const name = 'Área escolar ' + randomUUID().slice(0, 8);
const renamed = 'Travessia escolar ' + randomUUID().slice(0, 8);
const origin = 'http://localhost:8090';
let managerCookie: string;
beforeAll(async () => {
    for (const [cpf, role] of [
        ['00000000714', 'CITIZEN'],
        ['00000000715', 'MANAGER'],
    ] as const) {
        const password = randomUUID();
        const user = await db.user.create({ data: { cpf, role, password: await hashPassword(password), loginEnabled: true } });
        userIds.push(user.id);
        const login = await request(app).post('/api/v1/sessions').send({ cpf, password, transport: 'bearer' }).expect(201);
        tokens[role] = 'Bearer ' + login.body.data.token;
        if (role === 'MANAGER') {
            const cookieLogin = await request(app).post('/api/v1/sessions').set('Origin', origin).set('X-MyCity-Client', 'web').send({ cpf, password, transport: 'cookie' }).expect(201);
            managerCookie = cookieLogin.get('set-cookie')![0]!.split(';')[0]!;
        }
    }
});
afterAll(async () => {
    await db.report.deleteMany({ where: { authorId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    // Remove only the category created by this test run.
    await db.reportCategoryDefinition.deleteMany({ where: { name: { in: [name, renamed] } } });
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
});
it('preserva as categorias iniciais e reserva o cadastro ao gestor', async () => {
    await request(app).get('/api/v1/categories').expect(401);
    const list = await request(app).get('/api/v1/categories').set('Authorization', tokens.CITIZEN!).expect(200);
    expect(list.body.data).toEqual(
        expect.arrayContaining([
            { archived: false, id: 'POTHOLE', name: 'Buraco na via' },
            { archived: false, id: 'WASTE', name: 'Lixo não coletado' },
            { archived: false, id: 'LIGHTING', name: 'Iluminação pública' },
            { archived: false, id: 'DEBRIS', name: 'Entulho irregular' },
            { archived: false, id: 'LEAK', name: 'Vazamento de água/esgoto' },
            { archived: false, id: 'TREE', name: 'Poda/risco de árvore' },
        ]),
    );
    await request(app).post('/api/v1/categories').set('Authorization', tokens.CITIZEN!).send({ name }).expect(403);
    for (const invalid of ['  ', 'a'.repeat(81)]) await request(app).post('/api/v1/categories').set('Authorization', tokens.MANAGER!).send({ name: invalid }).expect(422);
});
it('cadastro concorrente mantém um único grupo disponível para criar e filtrar denúncias', async () => {
    const post = (value: string) => request(app).post('/api/v1/categories').set('Authorization', tokens.MANAGER!).send({ name: value, icon: 'walkway' });
    const attempts = await Promise.all([post('   ' + name.replace('Área escolar', 'Área   escolar') + ' '), post(name)]);
    expect(attempts.map((a) => a.status).sort()).toEqual([201, 409]);
    const category = attempts.find((a) => a.status === 201)!.body.data;
    expect(category).toEqual({ id: expect.any(String), name, archived: false, icon: 'walkway' });
    const repeated = await Promise.all([post(name), post(name.toUpperCase().replace('Á', 'A'))]);
    expect(repeated.map((r) => r.status)).toEqual([409, 409]);
    const list = await request(app).get('/api/v1/categories').set('Authorization', tokens.CITIZEN!).expect(200);
    expect(list.body.data.filter((c: { id: string }) => c.id === category.id)).toEqual([category]);
    const jpeg = await sharp({ create: { width: 12, height: 8, channels: 3, background: 'blue' } })
        .jpeg()
        .toBuffer();
    const upload = (id: string, clientRequestId = randomUUID()) =>
        request(app)
            .post('/api/v1/reports')
            .set('Authorization', tokens.CITIZEN!)
            .field('metadata', JSON.stringify({ category: id, clientRequestId, showIdentity: false, description: 'Faixa de pedestres da escola', location: { source: 'MANUAL', latitude: -20, longitude: -42 } }))
            .attach('photos', jpeg, 'test.jpg');
    await upload(randomUUID()).expect(422);
    const requestId = randomUUID();
    const report = await upload(category.id, requestId).expect(201);
    expect(report.body.data).toMatchObject({ category: category.id, categoryName: name });
    for (const endpoint of ['/reports?scope=management&', '/reports/map?']) {
        const result = await request(app)
            .get('/api/v1' + endpoint + 'category=' + category.id)
            .set('Authorization', tokens.MANAGER!)
            .expect(200);
        expect(result.body.data).toEqual([expect.objectContaining({ id: report.body.data.id, category: category.id, categoryName: name })]);
    }

    const patch = (value: string) =>
        request(app)
            .patch('/api/v1/categories/' + category.id)
            .set('Cookie', managerCookie)
            .set('Origin', origin)
            .set('X-MyCity-Client', 'web')
            .send({ name: value });
    const updated = await patch('  ' + renamed.replace('Travessia escolar', 'Travessia   escolar') + ' ').expect(200);
    expect(updated.body.data).toEqual({ id: category.id, name: renamed, archived: false, icon: 'walkway' });
    expect((await patch(renamed).expect(200)).body.data).toEqual(updated.body.data);
    expect((await patch('  ILUMINACAO PUBLICA ').expect(409)).body.error.code).toBe('CATEGORY_EXISTS');
    const catalog = await request(app).get('/api/v1/categories').set('Authorization', tokens.CITIZEN!).expect(200);
    expect(catalog.body.data).toContainEqual(updated.body.data);
    expect(catalog.body.data).not.toContainEqual(category);
    expect(
        (
            await request(app)
                .get('/api/v1/reports/' + report.body.data.id)
                .set('Authorization', tokens.CITIZEN!)
                .expect(200)
        ).body.data,
    ).toMatchObject({ category: category.id, categoryName: renamed });
    for (const endpoint of ['/reports?scope=management&', '/reports/map?']) {
        const result = await request(app)
            .get('/api/v1' + endpoint + 'category=' + category.id)
            .set('Authorization', tokens.MANAGER!)
            .expect(200);
        expect(result.body.data).toEqual([expect.objectContaining({ id: report.body.data.id, category: category.id, categoryName: renamed })]);
    }
    const setArchived = (archived: boolean) =>
        request(app)
            .patch('/api/v1/categories/' + category.id)
            .set('Authorization', tokens.MANAGER!)
            .send({ archived });
    await request(app)
        .patch('/api/v1/categories/' + category.id)
        .set('Authorization', tokens.CITIZEN!)
        .send({ archived: true })
        .expect(403);
    expect((await setArchived(true).expect(200)).body.data).toEqual({ ...updated.body.data, archived: true });
    const archivedCatalog = await request(app).get('/api/v1/categories').set('Authorization', tokens.CITIZEN!).expect(200);
    expect(archivedCatalog.body.data).toContainEqual({ ...updated.body.data, archived: true });
    const existingPhotos = await readdir(directory);
    const pending = randomUUID();
    expect((await upload(category.id, pending).expect(409)).body.error.code).toBe('CATEGORY_ARCHIVED');
    expect(await db.report.count({ where: { clientRequestId: pending } })).toBe(0);
    expect(await readdir(directory)).toEqual(existingPhotos);
    expect((await upload(category.id, requestId).expect(200)).body.data.id).toBe(report.body.data.id);
    const filtered = await request(app).get('/api/v1/reports').query({ scope: 'management', category: category.id }).set('Authorization', tokens.MANAGER!).expect(200);
    expect(filtered.body.data.map((item: { id: string }) => item.id)).toEqual([report.body.data.id]);
    expect((await setArchived(false).expect(200)).body.data).toEqual(updated.body.data);
    await upload(category.id, pending).expect(201);

    const concurrentId = randomUUID();
    const [attempt] = await Promise.all([upload(category.id, concurrentId), setArchived(true).expect(200)]);
    const accepted = attempt.status === 201;
    if (!accepted) expect([attempt.status, attempt.body.error.code]).toEqual([409, 'CATEGORY_ARCHIVED']);
    expect(await db.report.count({ where: { clientRequestId: concurrentId } })).toBe(accepted ? 1 : 0);
    const retry = await upload(category.id, concurrentId).expect(accepted ? 200 : 409);
    if (accepted) expect(retry.body.data.id).toBe(attempt.body.data.id);
});

it('verifica sessão, origem e papel antes de ler o nome na edição de uma categoria', async () => {
    const route = '/api/v1/categories/' + randomUUID();
    const malformed = () => request(app).patch(route).set('Content-Type', 'application/json').send('{');
    await malformed().expect(401);
    await malformed().set('Authorization', tokens.CITIZEN!).expect(403);
    await malformed().set('Cookie', managerCookie).set('Origin', origin).expect(403);
    await malformed().set('Cookie', managerCookie).set('Origin', 'https://outro.example').set('X-MyCity-Client', 'web').expect(403);
    await malformed().set('Authorization', tokens.MANAGER!).expect(400);
    for (const body of [{ name: '   ' }, { name: 'a'.repeat(81) }, { name: 'Exemplo', position: 0 }]) {
        const result = await request(app).patch(route).set('Authorization', tokens.MANAGER!).send(body).expect(422);
        expect(result.body.error.code).toBe('VALIDATION_ERROR');
    }
    const missing = await request(app).patch(route).set('Authorization', tokens.MANAGER!).send({ name: 'Grupo de exemplo' }).expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
});
