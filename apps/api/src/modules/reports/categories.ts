import { Router, json, type ErrorRequestHandler, type RequestHandler } from 'express';
import { createCategorySchema, updateCategorySchema } from '@mycity/contracts';
import type { Database } from '../../database.js';
import { Prisma } from '../../generated/prisma/client.js';

export function categoryNameKey(name: string) {
    return name
        .normalize('NFD')
        .replace(/\p{M}+/gu, '')
        .toLocaleLowerCase('pt-BR');
}

export function createCategoriesRouter(db: Database) {
    const router = Router();
    const select = { id: true, name: true, archived: true, icon: true } as const;
    router.get('/', async (_req, res) => {
        const manager = res.locals.user.role === 'MANAGER';
        const rows = await db.reportCategoryDefinition.findMany({ select: { ...select, _count: manager && { select: { reports: true } } }, orderBy: [{ position: 'asc' }, { nameKey: 'asc' }] });
        res.json({ data: rows.map(({ icon, _count, ...category }) => ({ ...category, ...(icon && { icon }), ...(manager && { reportCount: _count.reports }) })) });
    });
    const requireManager: RequestHandler = (_req, res, next) => {
        if (res.locals.user.role !== 'MANAGER') {
            res.status(403).json({ error: { code: 'FORBIDDEN', message: 'A gestão de categorias exige uma conta de gestor.' }, requestId: res.locals.requestId });
            return;
        }
        next();
    };
    const parse = json({ limit: '4kb' });
    router.post('/', requireManager, parse, async (req, res) => {
        const parsed = createCategorySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Informe um nome de categoria com até 80 caracteres.' }, requestId: res.locals.requestId });
            return;
        }
        const { name, icon } = parsed.data;
        const data = await db.reportCategoryDefinition.create({ data: { name, icon: icon ?? null, nameKey: categoryNameKey(name) }, select });
        res.status(201).json({ data: { ...data, icon: data.icon ?? undefined } });
    });
    router.patch<{ id: string }>('/:id', requireManager, parse, async (req, res) => {
        const parsed = updateCategorySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Informe um nome válido ou o estado de arquivamento da categoria.' }, requestId: res.locals.requestId });
            return;
        }
        const change = parsed.data;
        const data = await db.reportCategoryDefinition.update({ where: { id: req.params.id }, data: 'name' in change ? { name: change.name, ...(change.icon && { icon: change.icon }), nameKey: categoryNameKey(change.name) } : change, select });
        res.json({ data: { ...data, icon: data.icon ?? undefined } });
    });
    const handleError: ErrorRequestHandler = (error, _req, res, next) => {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return next(error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Categoria não encontrada.' }, requestId: res.locals.requestId });
            return;
        }
        if (error.code !== 'P2002') return next(error);
        res.status(409).json({ error: { code: 'CATEGORY_EXISTS', message: 'Já existe uma categoria com esse nome.' }, requestId: res.locals.requestId });
    };
    router.use(handleError);
    return router;
}
