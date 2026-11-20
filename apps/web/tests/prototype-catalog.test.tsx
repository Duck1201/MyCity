import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { PrototypeConsole } from '../src/prototype/console';
import { records } from '../src/prototype/demo';

it('links the full volume of a category to its queue, including closed reports', async () => {
    history.replaceState(null, '', '/categorias');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const total = records.filter((row) => row.category === 'LIGHTING').length;
    expect(records.some((row) => row.category === 'LIGHTING' && row.status === 'RESOLVED')).toBe(true);
    const link = screen.getByRole('link', { name: total + ' denúncias de Iluminação pública' });
    await user.click(link);
    expect(location.pathname + location.search).toBe('/atendimento?category=LIGHTING');
    expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveValue('LIGHTING');
});

it('finds archived categories by name without accents while keeping the archive collapsed', async () => {
    history.replaceState(null, '', '/categorias');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    await user.click(screen.getByRole('button', { name: 'Arquivar Iluminação pública' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    const search = screen.getByRole('searchbox', { name: 'Buscar categoria' });
    await user.type(search, 'ILUMINACAO');
    expect(within(screen.getByRole('region', { name: 'Categorias ativas' })).getByText('Nenhuma categoria ativa corresponde à busca.')).toBeVisible();
    const archived = screen.getByRole('button', { name: 'Ver categorias arquivadas (1)' });
    expect(archived).toHaveAttribute('aria-expanded', 'false');
    await user.click(archived);
    expect(screen.getByRole('button', { name: 'Reativar Iluminação pública' })).toBeVisible();
    await user.clear(search);
    expect(screen.getByRole('button', { name: 'Editar Lixo não coletado' })).toBeVisible();
});

it('uses the chosen symbol across the catalog, ranking, queue and report detail', async () => {
    history.replaceState(null, '', '/categorias');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    await user.click(screen.getByRole('button', { name: 'Editar Iluminação pública' }));
    await user.click(screen.getByRole('radio', { name: 'Energia' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    const category = screen.getByText('Iluminação pública').closest('li')!;
    expect(category.querySelector('[data-icon="energy"]')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'MyCity — Visão geral' }));
    const rank = screen.getByRole('link', { name: 'Filtrar por Iluminação pública' });
    expect(rank.querySelector('[data-icon="energy"]')).toBeInTheDocument();
    await user.click(rank);
    const first = screen.getAllByRole('link', { name: /Abrir denúncia/ })[0]!;
    expect(first.closest('tr')?.querySelector('[data-icon="energy"]')).toBeInTheDocument();
    await user.click(first);
    expect(screen.getByRole('heading', { name: 'Iluminação pública' }).querySelector('[data-icon="energy"]')).toBeInTheDocument();
});

it('suggests different icons for new groups and preserves the selection on rename', async () => {
    history.replaceState(null, '', '/categorias');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const chosen: string[] = [];
    for (const name of ['Ciclovias', 'Praças']) {
        await user.click(screen.getByRole('button', { name: 'Adicionar categoria' }));
        const selected = screen.getByRole('radio', { checked: true });
        chosen.push(selected.getAttribute('aria-label')!);
        await user.type(screen.getByRole('textbox', { name: 'Nome da categoria' }), name);
        await user.click(screen.getByRole('button', { name: 'Salvar categoria' }));
    }
    expect(new Set(chosen).size).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Editar Ciclovias' }));
    expect(screen.getByRole('radio', { name: chosen[0]!, checked: true })).toBeChecked();
    const field = screen.getByRole('textbox', { name: 'Nome da categoria' });
    await user.clear(field);
    await user.type(field, 'Mobilidade');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await user.click(screen.getByRole('link', { name: 'MyCity — Visão geral' }));
    await user.click(screen.getByRole('button', { name: 'Ver todas as categorias' }));
    const link = screen.getByRole('link', { name: 'Filtrar por Mobilidade' });
    expect(link).toHaveAccessibleDescription('0 pendências');
    await user.click(link);
    const filter = screen.getByRole('combobox', { name: 'Categoria' });
    expect(within(filter).getByRole('option', { selected: true })).toHaveTextContent('Mobilidade');
});
