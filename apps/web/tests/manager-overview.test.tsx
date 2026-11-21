import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ManagerOverview } from '../src/manager-overview';

it('consulta os indicadores autenticados e abre a fila e o detalhe pelos IDs do servidor', async () => {
    const payload = { counts: { SENT: 61, UNDER_REVIEW: 11, IN_PROGRESS: 3, RESOLVED: 6, REJECTED: 1, CANCELED: 2 }, oldest: { id: 'antiga', createdAt: '2025-01-01T12:00:00Z' }, categories: [{ id: 'grupo', name: 'Ciclovias', icon: 'cycling', archived: true, count: 75 }], priorities: [{ id: 'prioritaria', category: 'grupo', description: 'Buraco no cruzamento', status: 'SENT', confirmationCount: 20 }] };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: payload }));
    try {
        render(<ManagerOverview onSessionExpired={vi.fn()} />);
        expect(await screen.findByRole('link', { name: /75 Denúncias pendentes/ })).toHaveAttribute('href', '/atendimento?status=pending');
        expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/reports/overview');
        expect(screen.getByRole('link', { name: /Pendência mais antiga/ })).toHaveAttribute('href', '/atendimento/antiga');
        expect(screen.getByRole('link', { name: 'Abrir denúncia: Buraco no cruzamento' })).toHaveAccessibleDescription(/Buraco no cruzamento.*Ciclovias.*20 confirmações/);
        expect(screen.queryByRole('combobox', { name: 'Indicador' })).toBeNull();
        const chart = within(screen.getByRole('region', { name: 'Denúncias por situação' }));
        expect(chart.getByRole('link', { name: 'Filtrar por Enviado' })).toHaveAccessibleDescription('61 de 84 denúncias, 73%');
        expect(screen.getByRole('link', { name: 'Filtrar por Ciclovias' })).toHaveAttribute('href', '/atendimento?category=grupo&status=pending');
    } finally {
        fetcher.mockRestore();
    }
});

it('mostra os registros recentes e o total encerrado quando a fila está em dia', async () => {
    const counts = { SENT: 0, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 4, REJECTED: 1, CANCELED: 1 };
    const recent = { id: 'id-real-da-ocorrencia', status: 'RESOLVED', category: 'LIGHTING', categoryName: 'Iluminação', description: 'Luminária da praça', confirmationCount: 3, coverPhotoId: 'foto' };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => Response.json(String(input).includes('/queue?') ? { data: [recent], total: 6, page: 1, counts } : { data: { counts, oldest: null, priorities: [], categories: [] } }));
    try {
        render(<ManagerOverview onSessionExpired={vi.fn()} />);
        const recentSection = within(await screen.findByRole('region', { name: 'Registros recentes' }));
        expect(await recentSection.findByRole('link', { name: /Luminária da praça/ })).toHaveAttribute('href', '/atendimento/id-real-da-ocorrencia');
        expect(recentSection.getByRole('link', { name: /Luminária da praça/ }).querySelector('img')).toHaveAttribute('src', '/api/v1/reports/id-real-da-ocorrencia/photos/foto/thumb');
        expect(screen.getByRole('link', { name: /6 Ocorrências encerradas/ })).toHaveAttribute('href', '/atendimento?ordem=recentes');
        expect(screen.getByText('Sem pendências')).toBeVisible();
        expect(screen.queryByRole('region', { name: 'Pendências por categoria' })).toBeNull();
        expect(screen.queryByRole('heading', { name: 'Prioridade de atendimento' })).toBeNull();
    } finally {
        fetcher.mockRestore();
    }
});

it('mantém o ranking expandido compacto e acessível quando o catálogo cresce', async () => {
    const counts = { SENT: 12, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 };
    const categories = Array.from({ length: 12 }, (_, i) => ({ id: 'grupo-' + i, name: 'Grupo ' + (i + 1), archived: false, count: 1 }));
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: { counts, categories, oldest: null, priorities: [] } }));
    try {
        const user = userEvent.setup();
        render(<ManagerOverview onSessionExpired={vi.fn()} />);
        const ranking = within(await screen.findByRole('region', { name: 'Pendências por categoria' }));
        await user.click(ranking.getByRole('button', { name: 'Ver todas as categorias' }));
        expect(ranking.getAllByRole('link')).toHaveLength(8);
        await user.click(ranking.getByRole('button', { name: 'Próximas categorias' }));
        expect(ranking.getAllByRole('link')).toHaveLength(4);
        expect(ranking.getByRole('link', { name: 'Filtrar por Grupo 12' })).toHaveAttribute('href', '/atendimento?category=grupo-11&status=pending');
    } finally {
        fetcher.mockRestore();
    }
});

it('mostra em cada prioridade a categoria com o ícone e há quanto tempo foi aberta', async () => {
    const day = 86_400_000;
    const at = (days: number) => new Date(Date.now() - days * day - 60_000).toISOString();
    const priorities = [
        { id: 'p1', category: 'grupo', description: 'Buraco no cruzamento', status: 'SENT', confirmationCount: 4, createdAt: at(3) },
        { id: 'p2', category: 'grupo', description: 'Poste apagado', status: 'UNDER_REVIEW', confirmationCount: 1, createdAt: at(1) },
        { id: 'p3', category: 'grupo', description: 'Lixo na calçada', status: 'SENT', confirmationCount: 0, createdAt: at(0) },
    ];
    const payload = { counts: { SENT: 2, UNDER_REVIEW: 1, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 }, oldest: { id: 'p1', createdAt: priorities[0]!.createdAt }, categories: [{ id: 'grupo', name: 'Ciclovias', icon: 'cycling', archived: false, count: 3 }], priorities };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: payload }));
    try {
        render(<ManagerOverview onSessionExpired={vi.fn()} />);
        const first = await screen.findByRole('link', { name: 'Abrir denúncia: Buraco no cruzamento' });
        expect(first).toHaveAccessibleDescription(/Ciclovias · há 3 dias/);
        expect(screen.getByRole('link', { name: 'Abrir denúncia: Poste apagado' })).toHaveAccessibleDescription(/Ciclovias · há 1 dia\b/);
        expect(screen.getByRole('link', { name: 'Abrir denúncia: Lixo na calçada' })).toHaveAccessibleDescription(/Ciclovias · hoje/);
        // The icon sits inside the category line, so it cannot wrap onto a line of its own.
        const category = within(first).getByText(/Ciclovias/);
        expect(category.querySelector('svg.category-symbol')).not.toBeNull();
        expect(first.textContent).not.toContain('p1');
    } finally {
        fetcher.mockRestore();
    }
});
