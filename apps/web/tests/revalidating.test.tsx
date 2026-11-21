import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ManagerAccess } from '../src/manager-access';
import { ManagerOverview } from '../src/manager-overview';
import { ManagementReports } from '../src/management-reports';
import { ReportService } from '../src/report-service';
import { categoriesResponse } from './category-fixture';

afterEach(() => vi.unstubAllGlobals());

const session = () => new Response(JSON.stringify({ data: { id: 'gestor', role: 'MANAGER' } }), { headers: { 'Content-Type': 'application/json', 'X-Session-Expires-At': new Date(Date.now() + 86_400_000).toISOString() } });
const counts = { SENT: 1, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 };
const report = { id: '7d1f6a5e-4c2b-4f0a-9e3d-2b1c0a9f8e7d', description: 'Poste apagado na praça', category: 'LIGHTING', categoryName: 'Iluminação pública', status: 'SENT', version: 1, confirmationCount: 0, allowedActions: ['UNDER_REVIEW', 'REPLY'], photos: [], location: { latitude: -20, longitude: -40, source: 'GPS' }, latitude: -20, longitude: -40, createdAt: '2026-11-19T14:00:00Z' };
const reads = (url: string) => {
    if (url.endsWith('/categories')) return categoriesResponse();
    if (url.includes('/history')) return Response.json({ data: [], page: { nextCursor: null } });
    if (url.includes('/overview')) return Response.json({ data: { counts, oldest: { id: report.id, createdAt: report.createdAt }, categories: [{ id: 'LIGHTING', name: 'Iluminação pública', archived: false, count: 1 }], priorities: [{ id: report.id, category: 'LIGHTING', description: report.description, status: 'SENT', confirmationCount: 0, createdAt: report.createdAt }] } });
    if (url.includes('/queue')) return Response.json({ data: [report], page: 1, total: 1, counts });
    return Response.json({ data: report });
};

function Toggle({ children }: { children: ReactNode }) {
    const [shown, setShown] = useState(true);
    return (
        <>
            <button onClick={() => setShown(!shown)}>Trocar tela</button>
            {shown ? children : <p>Outra tela</p>}
        </>
    );
}

it.each([
    ['Atendimento', (expire: () => void) => <ManagementReports onSessionExpired={expire} />],
    ['detalhe', (expire: () => void) => <ReportService id={report.id} onSessionExpired={expire} />],
])('avisa em %s que a leitura guardada está sendo atualizada até a rede responder', async (_screen, section) => {
    let holding = false;
    const held: (() => void)[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
            if (url === '/api/v1/me') return Promise.resolve(session());
            if (!holding) return Promise.resolve(reads(url));
            return new Promise<Response>((resolve) => held.push(() => resolve(reads(url))));
        }),
    );
    history.replaceState({}, '', '/');
    const user = userEvent.setup();
    render(<ManagerAccess>{(expire) => <Toggle>{section(expire)}</Toggle>}</ManagerAccess>);
    // The panel keeps the section hidden behind its loading scene until the first read lands.
    const toggle = await screen.findByRole('button', { name: 'Trocar tela' }, { timeout: 3000 });
    expect(screen.getAllByText(/Poste apagado na praça|Iluminação pública/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Atualizando…/)).toBeNull();
    holding = true;
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Trocar tela' }));
    expect(screen.getAllByText(/Poste apagado na praça|Iluminação pública/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Atualizando…/)).toBeVisible();
    await act(async () => {
        held.splice(0).forEach((release) => release());
    });
    expect(screen.queryByText(/Atualizando…/)).toBeNull();
});

it('não mostra "Atualizando…" na capa da Visão geral enquanto revalida a leitura guardada', async () => {
    let holding = false;
    const held: (() => void)[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
            if (url === '/api/v1/me') return Promise.resolve(session());
            if (!holding) return Promise.resolve(reads(url));
            return new Promise<Response>((resolve) => held.push(() => resolve(reads(url))));
        }),
    );
    history.replaceState({}, '', '/');
    const user = userEvent.setup();
    render(
        <ManagerAccess>
            {(expire) => (
                <Toggle>
                    <ManagerOverview onSessionExpired={expire} />
                </Toggle>
            )}
        </ManagerAccess>,
    );
    const toggle = await screen.findByRole('button', { name: 'Trocar tela' }, { timeout: 3000 });
    holding = true;
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Trocar tela' }));
    expect(screen.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
    expect(held.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Atualizando/)).toBeNull();
    await act(async () => {
        held.splice(0).forEach((release) => release());
    });
});
