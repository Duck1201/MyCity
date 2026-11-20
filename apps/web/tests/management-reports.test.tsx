import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { categoriesResponse } from './category-fixture';
import { QueueJourney } from './queue-journey';

afterEach(() => vi.unstubAllGlobals());

it('consulta a fila do gestor e abre o protocolo anônimo com as fotos em ordem', async () => {
    const report = { id: '12279c23-d2b1-47ed-8879-59ed67e0e9f1', description: 'Buraco na esquina', category: 'POTHOLE', confirmationCount: 0, status: 'SENT', createdAt: '2026-11-19T14:00:00Z', location: { latitude: -20.75, longitude: -42.88, source: 'MANUAL' }, showIdentity: false };
    const photos = [1, 2].map((n) => ({ id: String(n), contentPath: '/api/v1/reports/' + report.id + '/photos/' + n }));
    const fetcher = vi.fn(async (url: string) => {
        if (url.endsWith('/categories')) return categoriesResponse();
        if (url.includes('/queue?')) return Response.json({ data: [report], page: 1, total: 1, counts: { SENT: 1, REJECTED: 0, CANCELED: 0, IN_PROGRESS: 0, UNDER_REVIEW: 0, RESOLVED: 0 } });
        if (url.includes('/history?')) return Response.json({ data: [], page: { nextCursor: null } });
        return Response.json({ data: { ...report, photos } });
    });
    vi.stubGlobal('fetch', fetcher);
    history.replaceState({}, '', '/atendimento');
    render(<QueueJourney />);
    expect(screen.getByRole('status', { name: 'Carregando painel' })).toBeVisible();
    expect(await screen.findAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Atendimento' })).toBeVisible();
    for (const label of ['Ocorrência', 'Situação', 'Confirmações', 'Registro']) expect(await screen.findByRole('columnheader', { name: label })).toBeInTheDocument();
    await screen.findByText(report.description);
    expect(screen.queryByText(report.id)).toBeNull();
    const link = screen.getByRole('link', { name: 'Abrir denúncia: Buraco na esquina' });
    expect(link).toHaveAttribute('href', '/atendimento/' + report.id);
    expect(link).toHaveAttribute('id', 'open-' + report.id);
    await userEvent.click(link);
    expect(await screen.findByRole('img', { name: /Foto 1 de 2/ })).toBeVisible();
    expect(screen.getByText(report.id)).toBeVisible();
    expect(screen.getByRole('img', { name: /Foto 1 de 2/ })).toHaveAttribute('src', photos[0]!.contentPath);
    await userEvent.click(screen.getByRole('button', { name: 'Próxima foto' }));
    expect(screen.getByRole('img', { name: /Foto 2 de 2/ })).toHaveAttribute('src', photos[1]!.contentPath);
    expect(screen.getByText('Anônimo')).toBeVisible();
    const back = screen.getByRole('link', { name: 'Voltar ao atendimento' });
    expect(back).toHaveAttribute('href', '/atendimento');
    await userEvent.click(back);
    expect(await screen.findByRole('link', { name: 'Abrir denúncia: Buraco na esquina' })).toHaveFocus();
});
