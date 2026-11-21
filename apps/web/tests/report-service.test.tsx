import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { categoriesResponse } from './category-fixture';
import { ReportService } from '../src/report-service';
import { ManagerDetail } from '../src/manager-detail';

afterEach(() => vi.unstubAllGlobals());
const report = { id: 'teste', description: 'Poste apagado', category: 'LIGHTING', status: 'SENT', version: 1, confirmationCount: 0, allowedActions: ['UNDER_REVIEW', 'REPLY'], photos: [], location: { latitude: -20, longitude: -40 }, createdAt: '2026-11-19T14:00:00Z' };
const created = { id: 'evento-1', type: 'CREATED', actorRole: 'CITIZEN', toStatus: 'SENT', createdAt: report.createdAt };
const summary = () => Response.json({ data: { SENT: 1, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 } });
const page = (data: unknown[], nextCursor: string | null = null) => Response.json({ data, page: { nextCursor } });

it('inicia análise com a versão exibida e apresenta o evento confirmado no histórico', async () => {
    const user = userEvent.setup();
    const updated = { ...report, status: 'UNDER_REVIEW', version: 2, allowedActions: ['IN_PROGRESS', 'REJECTED', 'REPLY'] };
    let submitted = false;
    const api = vi.fn(async (url: string, options?: RequestInit) => {
        if (url.endsWith('/transitions')) {
            expect(options?.method).toBe('POST');
            expect(options?.headers).toMatchObject({ 'X-MyCity-Client': 'web' });
            expect(JSON.parse(String(options?.body))).toEqual({ targetStatus: 'UNDER_REVIEW', expectedVersion: 1 });
            submitted = true;
            return Response.json({ data: updated });
        }
        if (url.includes('/history')) return page(submitted ? [created, { id: 'evento-2', type: 'STATUS_CHANGED', actorRole: 'MANAGER', fromStatus: 'SENT', toStatus: 'UNDER_REVIEW', createdAt: report.createdAt }] : [created]);
        if (url.endsWith('/categories')) return categoriesResponse();
        if (url.includes('/summary')) return summary();
        if (url.includes('?scope=')) return page([submitted ? updated : report]);
        return Response.json({ data: submitted ? updated : report });
    });
    vi.stubGlobal('fetch', api);
    render(<ManagerDetail id="teste" onSessionExpired={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Iniciar análise' }));
    expect(await screen.findByRole('button', { name: 'Iniciar atendimento' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Marcar como resolvida' })).toBeNull();
    expect(screen.getByText('Status atualizado para Em análise.')).toHaveFocus();
    expect(await within(screen.getByRole('region', { name: 'Histórico' })).findByText('Enviado → Em análise')).toBeVisible();
});

it('exige justificativa da rejeição e recarrega o estado após conflito sem repetir a ação', async () => {
    const user = userEvent.setup();
    const current = { ...report, status: 'UNDER_REVIEW', version: 4, allowedActions: ['IN_PROGRESS', 'REJECTED', 'REPLY'] };
    const advanced = { ...report, status: 'IN_PROGRESS', version: 5, allowedActions: ['RESOLVED', 'REPLY'] };
    let conflict = false;
    const calls: unknown[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, opt?: RequestInit) => {
            if (url.endsWith('/transitions')) {
                calls.push(JSON.parse(String(opt?.body)));
                conflict = true;
                return Response.json({ error: { code: 'VERSION_CONFLICT' } }, { status: 409 });
            }
            if (url.includes('/history')) return page([created]);
            if (url.endsWith('/categories')) return categoriesResponse();
            if (url.includes('/summary')) return summary();
            if (url.includes('?scope=')) return page([conflict ? advanced : current]);
            return Response.json({ data: conflict ? advanced : current });
        }),
    );
    render(<ManagerDetail id="teste" onSessionExpired={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Outras ações de situação' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rejeitar denúncia' }));
    expect(screen.getByRole('button', { name: 'Confirmar rejeição' })).toBeDisabled();
    await user.type(screen.getByLabelText('Justificativa da rejeição'), '  Ocorrência duplicada.  ');
    await user.click(screen.getByRole('button', { name: 'Confirmar rejeição' }));
    expect(await screen.findByRole('button', { name: 'Marcar como resolvida' })).toBeVisible();
    expect(await screen.findByText(/alterada por outra operação/i)).toBeVisible();
    expect(calls).toEqual([{ targetStatus: 'REJECTED', expectedVersion: 4, reason: 'Ocorrência duplicada.' }]);
    expect(screen.queryByRole('button', { name: 'Confirmar rejeição' })).toBeNull();
});

it('preserva e reenvia a resposta com a mesma chave após perda de rede, inclusive em denúncia resolvida', async () => {
    const user = userEvent.setup();
    const current = { ...report, status: 'RESOLVED', version: 7, allowedActions: ['REPLY'] };
    const calls: { text: string; clientRequestId: string }[] = [];
    const reply = { id: 'resposta', type: 'REPLY', actorRole: 'MANAGER', text: 'Vistoria concluída.', createdAt: report.createdAt };
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, opt?: RequestInit) => {
            if (url.endsWith('/replies')) {
                calls.push(JSON.parse(String(opt?.body)));
                if (calls.length === 1) throw new TypeError('sem rede');
                return Response.json({ data: reply });
            }
            if (url.includes('&cursor=')) return page([created]);
            if (url.includes('/history')) return calls.length ? page([reply], reply.id) : page([created]);
            if (url.endsWith('/categories')) return categoriesResponse();
            if (url.includes('/summary')) return summary();
            if (url.includes('?scope=')) return page([current]);
            return Response.json({ data: current });
        }),
    );
    render(<ManagerDetail id="teste" onSessionExpired={vi.fn()} />);
    const text = await screen.findByRole('textbox', { name: 'Responder ao cidadão' });
    await user.type(text, '  Vistoria concluída.  ');
    await user.click(screen.getByRole('button', { name: 'Publicar resposta' }));
    expect(await screen.findByText(/não foi possível confirmar a publicação/i)).toBeVisible();
    expect(text).toHaveValue('  Vistoria concluída.  ');
    await user.click(screen.getByRole('button', { name: 'Publicar resposta' }));
    expect(await screen.findByText('Resposta publicada.')).toBeVisible();
    expect(text).toHaveValue('');
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(calls[0]).toEqual({ text: 'Vistoria concluída.', clientRequestId: expect.any(String) });
    expect(await within(screen.getByRole('region', { name: 'Histórico' })).findByText('Vistoria concluída.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Ver registros anteriores/ }));
    expect(await screen.findByText('Denúncia enviada')).toBeVisible();
    expect(screen.getByText('Vistoria concluída.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Recolher histórico' }));
    expect(screen.queryByText('Denúncia enviada')).toBeNull();
    expect(await screen.findByText('Vistoria concluída.')).toBeVisible();
});

it('atualiza o detalhe e histórico a cada cinco segundos, pausa em segundo plano e conserva o texto em edição', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    let status = 'SENT';
    let detailReads = 0;
    let historyReads = 0;
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.endsWith('/categories')) return categoriesResponse();
            if (url.includes('/summary')) return summary();
            if (url.includes('?scope=')) return page([report]);
            if (url.includes('/history')) {
                historyReads++;
                return page([created]);
            }
            detailReads++;
            return Response.json({ data: { ...report, status } });
        }),
    );
    try {
        await act(async () => {
            render(<ManagerDetail id="teste" onSessionExpired={vi.fn()} />);
        });
        const text = screen.getByRole('textbox', { name: 'Responder ao cidadão' });
        fireEvent.change(text, { target: { value: 'Em preparação' } });
        text.focus();
        status = 'UNDER_REVIEW';
        await act(async () => vi.advanceTimersByTimeAsync(4999));
        expect(detailReads).toBe(1);
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(detailReads).toBe(2);
        expect(historyReads).toBe(2);
        expect(within(screen.getByRole('main', { name: 'Detalhes da denúncia' })).getByText('Em análise')).toBeVisible();
        expect(text).toHaveValue('Em preparação');
        expect(text).toHaveFocus();
        visibility.mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
        await act(async () => vi.advanceTimersByTimeAsync(10000));
        expect(detailReads).toBe(2);
        expect(historyReads).toBe(2);
        visibility.mockReturnValue(false);
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(detailReads).toBe(3);
        expect(historyReads).toBe(3);
    } finally {
        visibility.mockRestore();
        vi.useRealTimers();
    }
});

it.each(['RESOLVED', 'REJECTED', 'CANCELED'])('reabre %s com a versão exibida e identifica a reabertura no histórico', async (status) => {
    const user = userEvent.setup();
    let current = { ...report, status, version: 4 };
    const api = vi.fn(async (url: string, options?: RequestInit) => {
        if (url.endsWith('/transitions')) {
            expect(JSON.parse(String(options?.body))).toEqual({ targetStatus: 'UNDER_REVIEW', expectedVersion: 4 });
            current = { ...current, status: 'UNDER_REVIEW', version: 5, allowedActions: ['REPLY', 'IN_PROGRESS', 'REJECTED', 'SENT'] };
            return Response.json({ data: current });
        }
        if (url.includes('/history')) return page(current.version === 5 ? [{ ...created, id: 'reabertura', type: 'STATUS_CHANGED', actorRole: 'MANAGER', fromStatus: status, toStatus: 'UNDER_REVIEW' }] : []);
        if (url.endsWith('/categories')) return categoriesResponse();
        if (url.includes('/summary')) return summary();
        if (url.includes('?scope=')) return page([current]);
        return Response.json({ data: current });
    });
    vi.stubGlobal('fetch', api);
    render(<ManagerDetail id="teste" onSessionExpired={vi.fn()} />);
    const reopen = await screen.findByRole('button', { name: 'Reabrir solicitação' });
    expect(reopen).toHaveAccessibleDescription(/fotos voltam ao feed/);
    await user.click(reopen);
    expect(await screen.findByText(/^Reaberta: .+ → Em análise$/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Outras ações de situação' }));
    expect(screen.getByRole('menuitem', { name: 'Devolver para Enviado' })).toBeVisible();
});

it('identifica no histórico quando o cidadão reabre a própria denúncia cancelada', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.includes('/history')) return page([{ ...created, type: 'STATUS_CHANGED', fromStatus: 'CANCELED', toStatus: 'SENT' }]);
            if (url.endsWith('/categories')) return categoriesResponse();
            return Response.json({ data: report });
        }),
    );
    render(<ReportService id="teste" onSessionExpired={vi.fn()} />);
    expect(await screen.findByText('Reaberta: Cancelado → Enviado')).toBeVisible();
});

it('reserva a proporção original para ampliar uma foto pequena no detalhe', async () => {
    const photo = { id: 'foto-pequena', position: 0, contentPath: '/api/v1/reports/teste/photos/pequena', width: 74, height: 52, byteSize: 1200 };
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.includes('/history')) return page([created]);
            if (url.endsWith('/categories')) return categoriesResponse();
            return Response.json({ data: { ...report, photos: [photo] } });
        }),
    );
    render(<ReportService id="teste" onSessionExpired={vi.fn()} />);
    const img = within(await screen.findByRole('figure', { name: 'Fotos da ocorrência' })).getByRole('img');
    expect(img).toHaveAttribute('width', '74');
    expect(img).toHaveAttribute('height', '52');
    expect(img).toHaveAttribute('src', photo.contentPath);
});

it('exibe relato e galeria autenticada, editor e histórico simultaneamente como na versão aprovada', async () => {
    const user = userEvent.setup();
    const photos = [1, 2].map((position) => ({ id: 'foto-' + position, position, contentPath: '/api/v1/reports/teste/photos/' + position }));
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.includes('/history')) return page([created]);
            if (url.endsWith('/categories')) return categoriesResponse();
            return Response.json({ data: { ...report, photos } });
        }),
    );
    render(<ReportService id="teste" onSessionExpired={vi.fn()} onChange={vi.fn()} />);
    expect(await screen.findByRole('region', { name: 'Relato do cidadão' })).toBeVisible();
    expect(screen.queryByRole('tablist')).toBeNull();
    const gallery = screen.getByRole('figure', { name: 'Fotos da ocorrência' });
    expect(within(gallery).getByRole('img')).toHaveAttribute('src', photos[0]!.contentPath);
    await user.click(within(gallery).getByRole('button', { name: 'Próxima foto' }));
    expect(within(gallery).getByRole('img')).toHaveAttribute('src', photos[1]!.contentPath);
    expect(screen.getByRole('textbox', { name: 'Responder ao cidadão' })).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Responder ao cidadão' }), 'Em preparação');
    expect(await screen.findByText('Denúncia enviada')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Responder ao cidadão' })).toHaveValue('Em preparação');
});

it('fecha a justificativa e avisa o gestor quando outra operação muda a etapa durante a edição', async () => {
    const user = userEvent.setup();
    let current = { ...report, status: 'UNDER_REVIEW', allowedActions: ['IN_PROGRESS', 'REJECTED', 'REPLY'] };
    const api = vi.fn(async (url: string) => {
        if (url.endsWith('/categories')) return categoriesResponse();
        if (url.includes('/history')) return page([created]);
        return Response.json({ data: current });
    });
    vi.stubGlobal('fetch', api);
    render(<ManagerDetail id="teste" onSessionExpired={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Outras ações de situação' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rejeitar denúncia' }));
    await user.type(screen.getByRole('textbox', { name: 'Justificativa da rejeição' }), 'Em revisão');
    current = { ...current, status: 'IN_PROGRESS', version: 2, allowedActions: ['RESOLVED', 'REPLY'] };
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(await screen.findByRole('alert')).toHaveFocus();
    expect(screen.queryByRole('textbox', { name: 'Justificativa da rejeição' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Marcar como resolvida' })).toBeEnabled();
    expect(api.mock.calls.some(([url]) => url.endsWith('/transitions'))).toBe(false);
});

it('permite ler por inteiro relatos e eventos extensos sem ocupar a página inteira ao abrir', async () => {
    const user = userEvent.setup();
    const description = 'Pavimento irregular na travessia. '.repeat(16).trim();
    const reply = 'Inspeção realizada pela equipe. '.repeat(22).trim();
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.endsWith('/categories')) return categoriesResponse();
            if (url.includes('/history')) return page([{ ...created, type: 'REPLY', actorRole: 'MANAGER', text: reply }]);
            return Response.json({ data: { ...report, description } });
        }),
    );
    render(<ManagerDetail id="teste" onSessionExpired={vi.fn()} />);
    const read = await screen.findByText('Ler relato completo');
    expect(screen.getByText(description)).not.toBeVisible();
    await user.click(read);
    expect(screen.getByText(description)).toBeVisible();
    expect(screen.getByText(reply)).not.toBeVisible();
    await user.click(screen.getByText('Ler texto completo'));
    expect(screen.getByText(reply)).toBeVisible();
});

it('destaca o motivo da rejeição no topo e marca a justificativa no histórico', async () => {
    const reason = 'Fora da competência municipal.';
    const rejected = { ...report, status: 'REJECTED', version: 3, allowedActions: ['UNDER_REVIEW', 'REPLY'], rejectionReason: reason };
    const change = { id: 'evento-2', type: 'STATUS_CHANGED', actorRole: 'MANAGER', fromStatus: 'UNDER_REVIEW', toStatus: 'REJECTED', text: reason, createdAt: report.createdAt };
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.includes('/history')) return page([change, created]);
            if (url.endsWith('/categories')) return categoriesResponse();
            return Response.json({ data: rejected });
        }),
    );
    render(<ReportService id="teste" onSessionExpired={vi.fn()} />);
    const motive = await screen.findByRole('note', { name: 'Motivo da rejeição' });
    expect(motive).toHaveTextContent(reason);
    const entry = within(document.getElementById('occurrence-history')!).getByText(reason).closest('li')!;
    expect(entry).toHaveTextContent('Justificativa: ' + reason);
});

it('anima a lista do histórico ao expandir e recolher e marca só os registros que chegam depois', async () => {
    const user = userEvent.setup();
    const events = [1, 2, 3, 4].map((n) => ({ id: 'recente-' + n, type: 'REPLY', actorRole: 'MANAGER', text: 'Resposta ' + n, createdAt: report.createdAt }));
    let latest = events;
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.includes('cursor=pagina-seguinte')) return page([created]);
            if (url.includes('cursor=')) return page([{ ...created, type: 'REPLY', text: 'Primeira resposta arquivada.', id: 'pagina-seguinte' }], 'pagina-seguinte');
            if (url.includes('/history')) return page(latest, 'recente-4');
            if (url.endsWith('/categories')) return categoriesResponse();
            return Response.json({ data: report });
        }),
    );
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    const original = HTMLElement.prototype.getAnimations;
    HTMLElement.prototype.getAnimations = () => [{ finished } as unknown as Animation];
    try {
        render(<ReportService id="teste" onSessionExpired={vi.fn()} />);
        const history = within(await screen.findByRole('region', { name: 'Histórico' }));
        await history.findByText('Resposta 1');
        expect(document.querySelectorAll('#occurrence-history li[data-fresh]')).toHaveLength(0);
        const toggle = screen.getByRole('button', { name: /Ver registros anteriores/ });
        await user.click(toggle);
        await user.click(await history.findByRole('button', { name: 'Ver mais registros' }));
        await history.findByText('Denúncia enviada');
        expect(history.getByText('Primeira resposta arquivada.')).toBeVisible();
        await user.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).toBeEnabled();
        expect(toggle).toHaveFocus();
        const archive = document.getElementById(toggle.getAttribute('aria-controls')!)!;
        expect(archive).toHaveAttribute('inert');
        await user.click(toggle);
        await act(async () => finish());
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(archive).not.toHaveAttribute('inert');
        expect(history.getByText('Primeira resposta arquivada.')).toBeVisible();
        expect(history.getByText('Denúncia enviada')).toBeVisible();
        await user.click(toggle);
        expect(history.queryByText('Denúncia enviada')).toBeNull();
        // An entry that arrives later is marked to come in with a short entrance.
        latest = [{ id: 'nova', type: 'REPLY', actorRole: 'MANAGER', text: 'Resposta nova', createdAt: report.createdAt }, ...events.slice(0, 3)];
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5200));
        });
        expect((await history.findByText('Resposta nova')).closest('li')).toHaveAttribute('data-fresh');
    } finally {
        HTMLElement.prototype.getAnimations = original;
    }
}, 15000);

it('usa toda a largura do relato quando a ocorrência não tem galeria', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.includes('/history')) return page([created]);
            if (url.endsWith('/categories')) return categoriesResponse();
            return Response.json({ data: { ...report, photos: [] } });
        }),
    );
    render(
        <div className="console occurrence">
            <style>{readFileSync('src/occurrence-detail.css', 'utf8')}</style>
            <ReportService id="teste" onSessionExpired={vi.fn()} />
        </div>,
    );
    const section = await screen.findByRole('region', { name: 'Relato do cidadão' });
    expect(within(section).queryByRole('figure')).toBeNull();
    expect(getComputedStyle(section).gridTemplateColumns).toBe('minmax(0px, 1fr)');
});

it('alinha os valores dos metadados e mantém avatar e nome na mesma linha', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.includes('/history')) return page([created]);
            if (url.endsWith('/categories')) return categoriesResponse();
            return Response.json({ data: { ...report, author: { name: 'Pessoa de exemplo', photoUrl: '/avatar.jpg' } } });
        }),
    );
    render(
        <div className="console occurrence">
            <style>{readFileSync('src/occurrence-detail.css', 'utf8')}</style>
            <ReportService id="teste" onSessionExpired={vi.fn()} />
        </div>,
    );
    const section = await screen.findByRole('region', { name: 'Relato do cidadão' });
    const metadata = section.querySelector('dl')!;
    expect(getComputedStyle(metadata).display).toBe('grid');
    const values = within(metadata).getAllByRole('definition');
    expect(values).toHaveLength(4);
    for (const value of values) {
        expect(getComputedStyle(value).display).toBe('flex');
        expect(getComputedStyle(value).alignItems).toBe('center');
    }
    const author = within(metadata).getByText('Pessoa de exemplo').closest('dd')!;
    expect(author.querySelector('img')).not.toBeNull();
});
