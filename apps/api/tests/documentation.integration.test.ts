import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';

const database = createDatabase(process.env.DATABASE_URL!);
afterAll(() => database.$disconnect());

describe('documentação OpenAPI local', () => {
    it('entrega Swagger local e contrato válido dos endpoints implementados', async () => {
        const app = createApp(database, { environment: 'development', enableDocs: true });
        const ui = await request(app).get('/api/docs/');
        expect(ui.status).toBe(200);
        expect(ui.text).toContain('swagger-ui');
        expect(ui.headers['content-security-policy']).toContain("frame-ancestors 'none'");
        expect(ui.headers['cache-control']).toBe('no-store');
        const response = await request(app).get('/api/openapi.json');
        expect(response.status).toBe(200);
        const spec = await SwaggerParser.validate(response.body);
        expect(Object.keys(spec.paths!)).toEqual(['/api/v1/health/live', '/api/v1/health/ready']);
        expect(response.body.components.schemas.Liveness.required).toEqual(['data']);
        expect(response.body.components.schemas.Liveness.properties.data.properties.status.enum).toEqual(['alive']);
        expect(Object.keys(response.body.paths['/api/v1/health/ready'].get.responses['503'].content)).toEqual(['application/json']);
        for (const path of Object.keys(spec.paths!)) expect((await request(app).get(path)).status).toBe(200);
        const bundle = await request(app).get('/api/docs/swagger-ui-bundle.js');
        expect(bundle.status).toBe(200);
        expect(bundle.headers['content-type']).toContain('javascript');
        const initializer = await request(app).get('/api/docs/swagger-ui-init.js');
        expect(initializer.text).toMatch(/"validatorUrl":\s*null/);
        expect(initializer.text).toMatch(/"persistAuthorization":\s*false/);
    });

    it.each([undefined, { environment: 'production', enableDocs: true }, { environment: 'development', enableDocs: false }, { environment: 'staging', enableDocs: true }])('não expõe schema nem assets fora do opt-in de desenvolvimento: %j', async (options) => {
        const app = createApp(database, options);
        for (const path of ['/api/docs', '/api/docs/', '/api/openapi.json', '/api/docs/swagger-ui-init.js', '/api/docs/swagger-ui-bundle.js']) {
            const response = await request(app).get(path);
            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe('NOT_FOUND');
        }
    });
});
