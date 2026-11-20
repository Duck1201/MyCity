import { QueueJourney } from './queue-journey';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { categoriesResponse } from './category-fixture';
import { ManagementReports } from '../src/management-reports';

afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState({}, '', '/atendimento');
});

it('filtra a fila sem levar a página anterior para outro filtro e usa os totais do servidor', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async (url: string) => {
        const { pathname, searchParams } = new URL(url, 'http://localhost');
        if (pathname.endsWith('/categories')) return categoriesResponse();
        const light = searchParams.get('category') === 'LIGHTING';
        const counts = { SENT: light ? 12 : 32, UNDER_REVIEW: 2, IN_PROGRESS: 1, RESOLVED: 4, REJECTED: 0, CANCELED: 0 };
        const filtered = searchParams.has('status');
        const next = searchParams.get('pagina') === '2';
        const item = { id: next ? 'segundo' : 'primeiro', category: 'LIGHTING', categoryName: 'Iluminação pública', latitude: -20, longitude: -42, status: filtered ? 'UNDER_REVIEW' : 'SENT', description: next ? 'Outra rua' : 'Poste apagado', createdAt: '2026-11-20T11:00:00Z', confirmationCount: next ? 1 : 8 };
        return Response.json({ data: [item], page: next ? 2 : 1, total: filtered ? 2 : light ? 19 : 39, counts });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<ManagementReports onSessionExpired={vi.fn()} />);
    expect(await screen.findByRole('option', { name: 'Enviado (32)' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Todas (39)', selected: true })).toBeVisible();
    expect(await screen.findByRole('cell', { name: '8 confirmações' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByRole('cell', { name: '1 confirmação' })).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: /^Categoria$/ }), 'LIGHTING');
    expect(await screen.findByRole('option', { name: 'Enviado (12)' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Todas (19)', selected: true })).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Situação'), 'UNDER_REVIEW');
    expect(await screen.findByRole('option', { name: 'Em análise (2)', selected: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Situação')).toHaveFocus();
    const requested = fetcher.mock.calls.map(([url]) => new URL(url, 'http://localhost'));
    const list = requested.filter((u) => u.pathname.endsWith('/queue')).at(-1)!;
    expect(list.searchParams.get('category')).toBe('LIGHTING');
    expect(list.searchParams.get('status')).toBe('UNDER_REVIEW');
    expect(list.searchParams.get('pagina')).toBeNull();
    expect(list.searchParams.get('limit')).toBe('6');
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await screen.findByRole('option', { name: 'Enviado (32)', selected: false })).toBeVisible();
    expect(screen.getByRole('combobox', { name: /^Categoria$/ })).toHaveValue('');
});

it('reflete o novo status nos totais e devolve o foco à lista quando a ocorrência sai do filtro ativo', async () => {
    const user = userEvent.setup();
    let status = 'SENT';
    const row = () => ({ id: 'poste', description: 'Poste da praça', category: 'LIGHTING', status, confirmationCount: 3, location: { latitude: 0, longitude: 0 }, createdAt: '2026-11-19T11:00:00Z', photos: [], version: status === 'SENT' ? 1 : 2, allowedActions: status === 'SENT' ? ['UNDER_REVIEW'] : ['IN_PROGRESS'] });
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string) => {
            const url = new URL(input, 'http://localhost');
            if (url.pathname.endsWith('/categories')) return categoriesResponse();
            if (url.pathname.endsWith('/transitions')) {
                status = 'UNDER_REVIEW';
                return Response.json({ data: row() });
            }
            if (url.pathname.endsWith('/history')) return Response.json({ data: [], page: { nextCursor: null } });
            if (url.pathname.endsWith('/queue')) {
                const data = !url.searchParams.has('status') || url.searchParams.get('status') === status ? [row()] : [];
                return Response.json({ data, total: data.length, page: 1, counts: { SENT: Number(status === 'SENT'), UNDER_REVIEW: Number(status === 'UNDER_REVIEW'), IN_PROGRESS: 0, REJECTED: 0, CANCELED: 0, RESOLVED: 0 } });
            }
            return Response.json({ data: row() });
        }),
    );
    history.replaceState({}, '', '/atendimento');
    render(<QueueJourney />);
    await user.selectOptions(screen.getByLabelText('Situação'), await screen.findByRole('option', { name: 'Enviado (1)' }));
    await user.click(await screen.findByRole('link', { name: 'Abrir denúncia: Poste da praça' }));
    await user.click(await screen.findByRole('button', { name: 'Iniciar análise' }));
    await user.click(screen.getByRole('link', { name: 'Voltar ao atendimento' }));
    expect(await screen.findByRole('option', { name: 'Enviado (0)', selected: true })).toBeVisible();
    expect(await screen.findByRole('option', { name: 'Em análise (1)' })).toBeVisible();
    expect(screen.getByText('Nenhuma denúncia corresponde aos filtros.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Atendimento' })).toHaveFocus();
});

it('ao limpar, exibe a situação Todas, mantém a ação no lugar e devolve foco à categoria', async () => {
    const user = userEvent.setup();
    const totals = { SENT: 2, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 1 };
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.endsWith('/categories')) return categoriesResponse();
            return Response.json({ data: [], counts: totals, total: 0, page: 1 });
        }),
    );
    render(<ManagementReports onSessionExpired={vi.fn()} />);
    const category = screen.getByRole('combobox', { name: 'Categoria' });
    const status = screen.getByRole('combobox', { name: 'Situação' });
    const canceled = await screen.findByRole('option', { name: 'Cancelado (1)' });
    await user.selectOptions(category, 'WASTE');
    await user.selectOptions(status, canceled);
    expect(status).toHaveValue('CANCELED');
    const clear = screen.getByRole('button', { name: 'Limpar filtros' });
    await user.click(clear);
    expect(status).toHaveValue('');
    expect(clear).toHaveAccessibleName('Filtros limpos');
    expect(clear).toBeInTheDocument();
    expect(clear).toBeDisabled();
    expect(category).toHaveValue('');
    expect(category).toHaveFocus();
    expect(screen.getByRole('option', { name: 'Todas (3)', selected: true })).toBeVisible();
});

it('uma resposta filtrada atrasada não repõe uma categoria já limpa', async () => {
    const user = userEvent.setup();
    let resolveFiltered!: (response: Response) => void;
    const late = new Promise<Response>((resolve) => {
        resolveFiltered = resolve;
    });
    const totals = { SENT: 0, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 };
    const fetcher = vi.fn(async (input: string) => {
        const url = new URL(input, 'http://localhost');
        if (url.pathname.endsWith('/categories')) return categoriesResponse();
        if (url.searchParams.has('category')) return late;
        return Response.json({ data: [], counts: totals, total: 0, page: 1 });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<ManagementReports onSessionExpired={vi.fn()} />);
    const category = screen.getByRole('combobox', { name: 'Categoria' });
    await user.selectOptions(category, await screen.findByRole('option', { name: 'Lixo não coletado' }));
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await screen.findByText('Nenhuma denúncia recebida.')).toBeVisible();
    await act(async () => resolveFiltered(Response.json({ data: [{ id: 'tardia', description: 'Resposta tardia', category: 'LEAK', createdAt: '2026-11-19T12:00:00Z', status: 'SENT', confirmationCount: 0 }], page: 1, total: 1, counts: { ...totals, SENT: 1 } })));
    expect(screen.queryByText('Resposta tardia')).toBeNull();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    expect(fetcher.mock.calls.filter(([url]) => url.includes('/queue?')).at(-1)?.[0]).toBe('/api/v1/reports/queue?limit=6');
});

it.each([
    [false, 'Sinalização viária'],
    [true, 'Sinalização viária (arquivada)'],
] as const)('filtra a categoria cadastrada pelo gestor inclusive quando arquivada (%s)', async (archived, label) => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async (input: string) => {
        const url = new URL(input, 'http://localhost');
        if (url.pathname.endsWith('/categories')) return Response.json({ data: [{ id: 'categoria-viaria', name: 'Sinalização viária', archived }] });
        return Response.json({ data: [], counts: { SENT: 0, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, CANCELED: 0, REJECTED: 0 }, total: 0, page: 1 });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<ManagementReports onSessionExpired={vi.fn()} />);
    const option = await screen.findByRole('option', { name: label });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), option);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/reports/queue?category=categoria-viaria&limit=6', expect.anything());
});

it('restaura busca, ordenação e página da URL, exportando os mesmos filtros sem paginação', async () => {
    history.replaceState({}, '', '/atendimento?status=pending&q=poste&de=2026-11-01&ordem=recentes&pagina=2');
    const fetcher = vi.fn(async (input: string) => (input.endsWith('/categories') ? categoriesResponse() : Response.json({ data: [], page: 2, total: 12, counts: { SENT: 12 } })));
    vi.stubGlobal('fetch', fetcher);
    render(<ManagementReports onSessionExpired={() => {}} />);
    expect(screen.getByRole('searchbox')).toHaveValue('poste');
    expect(screen.getByLabelText('Situação')).toHaveValue('pending');
    expect(screen.getByLabelText('Ordenar por')).toHaveValue('recentes');
    expect(await screen.findByText(/Página 2 de/)).toBeVisible();
    const link = new URL(screen.getByRole('link', { name: 'Exportar CSV' }).getAttribute('href')!, 'http://localhost');
    expect(link.pathname).toBe('/api/v1/reports/queue.csv');
    expect(Object.fromEntries(link.searchParams)).toEqual({ status: 'pending', q: 'poste', de: '2026-11-01', ordem: 'recentes' });
    history.replaceState({}, '', '/');
});

it('mantém filtros, resultados e paginação juntos em telas estreitas', async () => {
    history.replaceState({}, '', '/atendimento');
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 760px)' }));
    const fetcher = vi.fn(async (input: string) => (input.endsWith('/categories') ? categoriesResponse() : Response.json({ data: [], page: 1, total: 0, counts: { SENT: 0, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 } })));
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    render(<ManagementReports onSessionExpired={() => {}} />);
    expect(screen.getByRole('searchbox')).toBeVisible();
    const term = screen.getByRole('searchbox');
    await user.type(term, 'poste');
    expect(term).toHaveFocus();
    expect(await screen.findByText('Nenhuma denúncia corresponde aos filtros.')).toBeVisible();
    expect(screen.getByRole('searchbox')).toBeVisible();
    expect(screen.getByText('Página 1 de 1')).toBeVisible();
    expect(new URL(location.href).searchParams.get('q')).toBe('poste');
    expect(fetcher.mock.calls.some(([url]) => url.includes('/queue?q=poste&limit=6'))).toBe(true);
});

it('traz a linha focada à vista quando a consulta termina após voltar do detalhe', async () => {
    history.replaceState({ focus: 'open-alvo' }, '', '/atendimento');
    const scrollIntoView = vi.fn();
    const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scrollIntoView, configurable: true });
    try {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => (url.endsWith('/categories') ? categoriesResponse() : Response.json({ data: [{ id: 'alvo', category: 'LIGHTING', categoryName: 'Iluminação', description: 'Poste da praça', status: 'SENT', createdAt: '2026-11-19T12:00:00Z', confirmationCount: 0, latitude: 0, longitude: 0 }], page: 1, total: 1, counts: { SENT: 1 } }))),
        );
        render(<ManagementReports onSessionExpired={() => {}} />);
        const rowLink = await screen.findByRole('link', { name: 'Abrir denúncia: Poste da praça' });
        expect(rowLink).toHaveFocus();
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
        expect(scrollIntoView.mock.instances[0]).toBe(rowLink.closest('tr'));
    } finally {
        if (previous) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previous);
        else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
});
