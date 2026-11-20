import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CategoryManager } from '../src/category-manager';

afterEach(() => vi.unstubAllGlobals());

it('cadastra a categoria e atualiza o catálogo após confirmação da API', async () => {
    const user = userEvent.setup();
    const existing = [{ id: 'WASTE', name: 'Lixo não coletado' }];
    const created = { id: 'id-adicionado', name: 'Sinalização viária' };
    const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
        expect(url).toBe('/api/v1/categories');
        if (options?.method === 'POST') {
            expect(options.headers).toMatchObject({ 'Content-Type': 'application/json', 'X-MyCity-Client': 'web' });
            expect(JSON.parse(String(options.body))).toEqual({ name: 'Sinalização viária', icon: 'signs' });
            existing.push(created);
            return Response.json({ data: created }, { status: 201 });
        }
        return Response.json({ data: existing });
    });
    vi.stubGlobal('fetch', fetcher);
    const notify = vi.fn();
    render(<CategoryManager onSessionExpired={vi.fn()} onCreated={notify} />);
    expect(await screen.findByText('Lixo não coletado')).toBeVisible();
    const trigger = screen.getByRole('button', { name: 'Adicionar categoria' });
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(trigger);
    const field = screen.getByRole('textbox', { name: 'Nome da categoria' });
    expect(field).toHaveFocus();
    await user.type(field, '  Sinalização   viária ');
    await user.click(screen.getByRole('radio', { name: 'Sinalização' }));
    await user.click(screen.getByRole('button', { name: 'Salvar categoria' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Categoria adicionada');
    expect(await within(screen.getByRole('list')).findByText('Sinalização viária')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(notify).toHaveBeenCalledWith(created);
});

it('preserva a entrada em caso de duplicidade e reconhece sessão expirada no cadastro', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const expire = vi.fn();
    vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string, options?: RequestInit) => {
            if (options?.method === 'POST') {
                attempts++;
                return attempts === 1 ? Response.json({ error: { code: 'CATEGORY_EXISTS' } }, { status: 409 }) : new Response(null, { status: 401 });
            }
            return Response.json({ data: [{ id: 'WASTE', name: 'Lixo não coletado' }] });
        }),
    );
    render(<CategoryManager onSessionExpired={expire} />);
    const trigger = screen.getByRole('button', { name: 'Adicionar categoria' });
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(trigger);
    const field = screen.getByRole('textbox', { name: 'Nome da categoria' });
    expect(field).toHaveFocus();
    const save = screen.getByRole('button', { name: 'Salvar categoria' });
    expect(save).toBeDisabled();
    await user.type(field, '...');
    expect(save).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('letra ou número');
    await user.clear(field);
    await user.type(field, 'Lixo não coletado');
    await user.click(save);
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe uma categoria com esse nome');
    expect(field).toHaveValue('Lixo não coletado');
    await user.clear(field);
    await user.type(field, 'Transporte');
    await user.click(save);
    expect(expire).toHaveBeenCalledOnce();
});

it('descarta o rascunho ao cancelar ou pressionar Escape e retorna ao cadastro', async () => {
    const user = userEvent.setup();
    const api = vi.fn(async () => Response.json({ data: [] }));
    vi.stubGlobal('fetch', api);
    render(<CategoryManager onSessionExpired={vi.fn()} />);
    expect(await screen.findByText('Nenhuma categoria ativa.')).toBeVisible();
    const trigger = screen.getByRole('button', { name: 'Adicionar categoria' });
    await user.click(trigger);
    await user.type(screen.getByRole('textbox', { name: 'Nome da categoria' }), 'Rascunho');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByRole('textbox', { name: 'Nome da categoria' })).toHaveValue('');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(api).toHaveBeenCalledTimes(1);
});

it('edita uma categoria existente, reenviando o mesmo ID e o novo nome', async () => {
    const user = userEvent.setup();
    let item = { id: 'WASTE', name: 'Lixo não coletado' };
    const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.method === 'PATCH') {
            expect(url).toBe('/api/v1/categories/WASTE');
            item = { ...item, name: JSON.parse(String(options.body)).name };
            return Response.json({ data: item });
        }
        return Response.json({ data: [item] });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<CategoryManager onSessionExpired={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Editar Lixo não coletado' }));
    const field = screen.getByRole('textbox', { name: 'Nome da categoria' });
    expect(field).toHaveValue(item.name);
    await user.clear(field);
    await user.type(field, 'Coleta de resíduos');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByRole('button', { name: 'Editar Coleta de resíduos' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Categoria atualizada.');
});

it('confirma arquivamento e reativação pelo ID e preserva o nome da categoria', async () => {
    const user = userEvent.setup();
    let item = { id: 'WASTE', name: 'Resíduos', archived: false };
    const changes: unknown[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, options?: RequestInit) => {
            if (options?.method === 'PATCH') {
                expect(url).toBe('/api/v1/categories/WASTE');
                expect(options.headers).toMatchObject({ 'X-MyCity-Client': 'web' });
                const payload = JSON.parse(String(options.body));
                changes.push(payload);
                item = { ...item, ...payload };
                return Response.json({ data: item });
            }
            return Response.json({ data: [item] });
        }),
    );
    render(<CategoryManager onSessionExpired={vi.fn()} />);
    const archive = await screen.findByRole('button', { name: 'Arquivar Resíduos' });
    await user.click(archive);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(changes).toEqual([]);
    expect(archive).toHaveFocus();
    await user.click(archive);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
    const archived = await screen.findByRole('button', { name: 'Ver categorias arquivadas (1)' });
    expect(archived).toHaveFocus();
    await user.click(archived);
    const restore = await screen.findByRole('button', { name: 'Reativar Resíduos' });
    expect(archived).toHaveAttribute('aria-expanded', 'true');
    await user.click(restore);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('button', { name: 'Arquivar Resíduos' })).toHaveFocus();
    expect(screen.getByText('Nenhuma categoria arquivada.')).toBeVisible();
    expect(changes).toEqual([{ archived: true }, { archived: false }]);
});

it('mantém a seção ativa ao expandir as arquivadas e abre a fila pelo total real', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
            Response.json({
                data: [
                    { id: 'TREE', name: 'Árvores', archived: false, reportCount: 2 },
                    { id: 'WASTE', name: 'Resíduos', archived: true, reportCount: 4 },
                ],
            }),
        ),
    );
    const user = userEvent.setup();
    render(<CategoryManager onSessionExpired={vi.fn()} />);
    const active = await screen.findByRole('region', { name: 'Categorias ativas' });
    expect(await within(active).findByRole('link', { name: '2 denúncias de Árvores' })).toHaveAttribute('href', '/atendimento?category=TREE');
    await user.click(screen.getByRole('button', { name: 'Ver categorias arquivadas (1)' }));
    expect(within(active).getByText('Árvores')).toBeVisible();
    expect(screen.getByRole('link', { name: '4 denúncias de Resíduos' })).toHaveAttribute('href', '/atendimento?category=WASTE');
});
