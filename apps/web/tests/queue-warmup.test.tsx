import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ManagerApp } from '../src/manager-app';
import { defaultQueueEndpoint } from '../src/queue-endpoint';
import { categoriesResponse } from './category-fixture';

afterEach(() => vi.unstubAllGlobals());

const session = () => new Response(JSON.stringify({ data: { id: 'gestor', role: 'MANAGER' } }), { headers: { 'Content-Type': 'application/json', 'X-Session-Expires-At': new Date(Date.now() + 86_400_000).toISOString() } });
const counts = { SENT: 1, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 };
const row = { id: '7d1f6a5e-4c2b-4f0a-9e3d-2b1c0a9f8e7d', description: 'Poste apagado na praça', category: 'LIGHTING', categoryName: 'Iluminação pública', status: 'SENT', confirmationCount: 0, latitude: -20, longitude: -40, createdAt: '2026-11-19T14:00:00Z', coverPhotoId: null };

it('abre o Atendimento com a fila já carregada quando o gestor chega pela Visão geral', async () => {
    let holdQueue = false;
    const queueRequests: string[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
            if (url === '/api/v1/me') return Promise.resolve(session());
            if (url.endsWith('/categories')) return Promise.resolve(categoriesResponse());
            if (url.includes('/reports/overview')) return Promise.resolve(Response.json({ data: { counts, oldest: { id: row.id, createdAt: row.createdAt }, categories: [], priorities: [] } }));
            if (url.includes('/reports/queue')) {
                queueRequests.push(url);
                if (holdQueue) return new Promise<Response>(() => {});
                return Promise.resolve(Response.json({ data: [row], page: 1, total: 1, counts }));
            }
            return Promise.resolve(Response.json({ data: [], page: { nextCursor: null } }));
        }),
    );
    history.replaceState(null, '', '/visao-geral');
    const user = userEvent.setup();
    render(<ManagerApp />);
    await screen.findByRole('heading', { name: 'Visão geral' }, { timeout: 3000 });
    await vi.waitFor(() => expect(queueRequests).toContain(defaultQueueEndpoint));
    const warmed = queueRequests.filter((url) => url === defaultQueueEndpoint).length;

    holdQueue = true;
    await user.click(within(screen.getByRole('navigation', { name: 'Navegação do gestor' })).getByRole('link', { name: 'Atendimento' }));

    expect(await screen.findByText('Poste apagado na praça', {}, { timeout: 1000 })).toBeVisible();
    // The screen asks for the same URL the warm-up already cached.
    expect(queueRequests.filter((url) => url === defaultQueueEndpoint)).toHaveLength(warmed + 1);
});

const detail = { ...row, version: 1, allowedActions: ['UNDER_REVIEW', 'REPLY'], photos: [], location: { latitude: -20, longitude: -40, source: 'GPS' } };
function serve(hold: (url: string) => boolean, requests: string[] = []) {
    vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
            requests.push(url);
            if (url === '/api/v1/me') return Promise.resolve(session());
            if (hold(url)) return new Promise<Response>(() => {});
            if (url.endsWith('/categories')) return Promise.resolve(categoriesResponse());
            if (url.includes('/reports/overview')) return Promise.resolve(Response.json({ data: { counts, oldest: { id: row.id, createdAt: row.createdAt }, categories: [], priorities: [] } }));
            if (url.includes('/reports/queue')) return Promise.resolve(Response.json({ data: [row], page: 1, total: 1, counts }));
            if (url.includes('/history')) return Promise.resolve(Response.json({ data: [], page: { nextCursor: null } }));
            if (url.endsWith('/reports/' + row.id)) return Promise.resolve(Response.json({ data: detail }));
            return Promise.resolve(Response.json({ data: [], page: { nextCursor: null } }));
        }),
    );
}

it('abre a Visão geral na hora quando o gestor chega pelo Atendimento', async () => {
    let hold = false;
    serve((url) => hold && url.includes('/reports/overview'));
    history.replaceState(null, '', '/atendimento');
    const user = userEvent.setup();
    render(<ManagerApp />);
    await screen.findByText('Poste apagado na praça', {}, { timeout: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    hold = true;
    await user.click(within(screen.getByRole('navigation', { name: 'Navegação do gestor' })).getByRole('link', { name: 'Visão geral' }));
    expect(await screen.findByText(/Denúncias pendentes/, {}, { timeout: 1000 })).toBeVisible();
});

it('abre o detalhe na hora depois que o gestor aponta para a denúncia na fila', async () => {
    let hold = false;
    serve((url) => hold && url.includes('/reports/' + row.id));
    history.replaceState(null, '', '/atendimento');
    const user = userEvent.setup();
    render(<ManagerApp />);
    const open = await screen.findByRole('link', { name: 'Abrir denúncia: Poste apagado na praça' }, { timeout: 3000 });
    await user.hover(open);
    await new Promise((resolve) => setTimeout(resolve, 50));
    hold = true;
    await user.click(open);
    expect(await screen.findByRole('heading', { name: 'Iluminação pública' }, { timeout: 1000 })).toBeVisible();
});
