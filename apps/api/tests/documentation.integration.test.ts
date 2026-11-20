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
        expect(Object.keys(spec.paths!)).toEqual(['/api/v1/health/live', '/api/v1/health/ready', '/api/v1/sessions', '/api/v1/me', '/api/v1/sessions/current', '/api/v1/reports', '/api/v1/reports/{id}', '/api/v1/reports/{id}/photos/{photoId}', '/api/v1/reports/{id}/history', '/api/v1/reports/{id}/transitions', '/api/v1/reports/{id}/replies', '/api/v1/notifications', '/api/v1/notifications/{id}/read', '/api/v1/reports/map', '/api/v1/reports/overview', '/api/v1/reports/queue', '/api/v1/reports/queue.csv', '/api/v1/reports/summary', '/api/v1/reports/{id}/confirmation', '/api/v1/reports/{id}/cancellation', '/api/v1/weather-alerts', '/api/v1/weather-alerts/{id}', '/api/v1/categories', '/api/v1/categories/{id}']);
        expect(Object.keys(response.body.paths['/api/v1/categories/{id}'].patch.responses)).toEqual(['200', '401', '403', '404', '409', '422']);
        const alert = response.body.components.schemas.WeatherAlert;
        expect(alert.required).toContain('simulated');
        expect(alert.properties.simulated.enum).toEqual([true]);
        expect(alert.properties.level.enum).toEqual(['ATTENTION', 'ALERT', 'EMERGENCY']);
        expect(response.body.components.schemas.Liveness.required).toEqual(['data']);
        expect(response.body.components.schemas.Liveness.properties.data.properties.status.enum).toEqual(['alive']);
        expect(Object.keys(response.body.paths['/api/v1/health/ready'].get.responses['503'].content)).toEqual(['application/json']);
        for (const path of ['/api/v1/health/live', '/api/v1/health/ready']) expect((await request(app).get(path)).status).toBe(200);
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
