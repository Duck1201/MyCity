import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ManagementReports } from '../src/management-reports';

afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState({}, '', '/atendimento');
});
function deferred() {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>((done) => {
        resolve = done;
    });
    return { resolve, promise };
}
const item = { id: 'one', description: 'Rua com buraco', category: 'POTHOLE', categoryName: 'Buraco na via', status: 'SENT', createdAt: '2026-11-19T14:00:00Z', confirmationCount: 1 };
const page = (data: unknown[]) => Response.json({ data, page: 1, total: data.length, counts: { SENT: data.length, REJECTED: 0, CANCELED: 0, IN_PROGRESS: 0, UNDER_REVIEW: 0, RESOLVED: 0 } });
it('mostra carregamento inicial, mantém a fila ao filtrar e não a desmonta no polling', async () => {
    const first = deferred();
    const filtered = deferred();
    const update = deferred();
    let filters = 0;
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string) => {
            const url = new URL(input, 'http://localhost');
            if (url.pathname.endsWith('/categories')) return Response.json({ data: [{ id: 'WASTE', name: 'Lixo não coletado' }] });
            if (url.searchParams.has('category')) return (++filters === 1 ? filtered : update).promise;
            return first.promise;
        }),
    );
    render(<ManagementReports onSessionExpired={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Carregando denúncias' })).toBeInTheDocument();
    await act(async () => first.resolve(page([item])));
    const original = screen.getByRole('link', { name: /Abrir denúncia: Rua com buraco/ });
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Categoria' }), 'WASTE');
    expect(original).toBeInTheDocument();
    expect(original).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/1 ocorrência · Atualizando/)).toBeVisible();
    expect(screen.getByRole('status', { name: 'Atualizando fila' })).toBeVisible();
    await act(async () => filtered.resolve(page([{ ...item, id: 'two', description: 'Lixo na calçada', category: 'WASTE', categoryName: 'Lixo não coletado' }])));
    const row = screen.getByRole('link', { name: /Abrir denúncia: Lixo na calçada/ });
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByRole('link', { name: /Abrir denúncia: Lixo na calçada/ })).toBe(row);
    expect(screen.queryByRole('status', { name: 'Carregando denúncias' })).toBeNull();
    await act(async () => update.resolve(page([{ ...item, id: 'two', description: 'Lixo na calçada', category: 'WASTE', categoryName: 'Lixo não coletado' }])));
    expect(screen.getByRole('link', { name: /Abrir denúncia: Lixo na calçada/ })).toBe(row);
});

it('mantém a área da fila vazia durante a troca de filtro, sem repetir o carregamento inicial', async () => {
    const next = deferred();
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string) => {
            const url = new URL(input, 'http://localhost');
            if (url.pathname.endsWith('/categories')) return Response.json({ data: [{ id: 'WASTE', name: 'Lixo não coletado' }] });
            return url.searchParams.has('category') ? next.promise : page([]);
        }),
    );
    render(<ManagementReports onSessionExpired={vi.fn()} />);
    await screen.findByText('Nenhuma denúncia recebida.');
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'WASTE');
    expect(screen.queryByRole('status', { name: 'Carregando denúncias' })).toBeNull();
    expect(screen.getByRole('status', { name: 'Atualizando fila' })).toBeInTheDocument();
    await act(async () => next.resolve(page([])));
    expect(screen.getByText('Nenhuma denúncia corresponde aos filtros.')).toBeVisible();
});
