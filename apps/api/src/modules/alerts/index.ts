import { Router } from 'express';
import { weatherAlertQuerySchema, type WeatherAlert } from '@mycity/contracts';

// Ordered by severity. All dates belong to the fixed demonstration scenario.
const scenarios: readonly WeatherAlert[] = [
    {
        id: 'demo-flood',
        level: 'EMERGENCY',
        title: 'Alagamento na área ribeirinha',
        message: 'Neste cenário simulado, o rio transbordou e a água cobriu as ruas mais baixas próximas à margem.',
        regionLabel: 'Vila das Pontes',
        issuedAt: '2026-11-25T14:30:00Z',
        expiresAt: '2026-11-25T20:00:00Z',
        simulated: true,
    },
    {
        id: 'demo-wind',
        level: 'ALERT',
        title: 'Vento forte na serra',
        message: 'Neste cenário simulado, rajadas de vento atingem a parte alta do bairro, com possibilidade de queda de galhos.',
        regionLabel: 'Alto da Serra',
        issuedAt: '2026-11-25T13:00:00Z',
        expiresAt: '2026-11-25T18:00:00Z',
        simulated: true,
    },
    {
        id: 'demo-rain',
        level: 'ATTENTION',
        title: 'Chuva moderada no vale',
        message: 'Neste cenário simulado, há previsão de chuva moderada durante a tarde, com acúmulo de água em pontos de drenagem lenta.',
        regionLabel: 'Vale do Ipê',
        issuedAt: '2026-11-25T12:00:00Z',
        expiresAt: '2026-11-25T21:00:00Z',
        simulated: true,
    },
];

export function createWeatherAlertsRouter() {
    const router = Router();
    router.get('/', (req, res) => {
        const parsed = weatherAlertQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Parâmetros de consulta inválidos.' }, requestId: res.locals.requestId });
            return;
        }
        const { limit, cursor } = parsed.data;
        const start = cursor ? scenarios.findIndex((item) => item.id === cursor) + 1 : 0;
        if (cursor && !start) {
            res.status(400).json({ error: { code: 'INVALID_CURSOR', message: 'Página inválida.' }, requestId: res.locals.requestId });
            return;
        }
        const data = scenarios.slice(start, start + limit);
        res.json({ data, page: { nextCursor: start + limit < scenarios.length ? data.at(-1)!.id : null } });
    });
    router.get('/:id', (req, res) => {
        const data = scenarios.find((item) => item.id === req.params.id);
        if (!data) {
            res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cenário simulado não encontrado.' }, requestId: res.locals.requestId });
            return;
        }
        res.json({ data });
    });
    return router;
}
