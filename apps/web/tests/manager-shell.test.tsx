import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ManagerAccess } from '../src/manager-access';

function openPanel() {
    return render(<ManagerAccess>{(_expire, navigation) => <p>Área atual {navigation.section}</p>}</ManagerAccess>);
}
beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ data: { role: 'MANAGER' } }, { headers: { 'X-Session-Expires-At': new Date(Date.now() + 86400000).toISOString() } })),
    );
});
afterEach(() => vi.unstubAllGlobals());

it('abre consultas e mantém o menu recolhido após recarregar, preservando a largura escolhida', async () => {
    const user = userEvent.setup();
    const panel = openPanel();
    const separator = await screen.findByRole('separator', { name: 'Largura do menu lateral' });
    // jsdom has pointer events but no native pointer capture.
    Object.defineProperty(separator, 'setPointerCapture', { value: () => {} });
    const start = Number(separator.getAttribute('aria-valuenow'));
    const pointer = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 };
    fireEvent.pointerDown(separator, { ...pointer, clientX: start });
    fireEvent.pointerMove(separator, { ...pointer, clientX: start + 25 });
    fireEvent.pointerUp(separator, { ...pointer, clientX: start + 25 });
    expect(separator).toHaveAttribute('aria-valuenow', String(start + 25));
    separator.focus();
    await user.keyboard('{End}');
    expect(separator).toHaveAttribute('aria-valuenow', separator.getAttribute('aria-valuemax'));
    expect(
        screen
            .getAllByRole('link')
            .filter((link) => link.classList.contains('desk-link'))
            .map((link) => link.textContent),
    ).toEqual(['Visão geral', 'Atendimento', 'Categorias']);
    await user.click(screen.getByRole('link', { name: 'Categorias' }));
    expect(await screen.findByText('Área atual categories')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Categorias' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Recolher menu lateral' }));
    expect(screen.queryByRole('separator', { name: 'Largura do menu lateral' })).toBeNull();
    panel.unmount();
    openPanel();
    await user.click(await screen.findByRole('button', { name: 'Expandir menu lateral' }));
    const restored = screen.getByRole('separator', { name: 'Largura do menu lateral' });
    expect(restored).toHaveAttribute('aria-valuenow', restored.getAttribute('aria-valuemax'));
    restored.focus();
    await user.keyboard('{Home}{ArrowRight}');
    expect(Number(restored.getAttribute('aria-valuenow'))).toBe(Number(restored.getAttribute('aria-valuemin')) + 16);
});
it('abre a gaveta no celular, fecha com Escape e devolve foco ao acionador', async () => {
    vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({ matches: query.includes('760px'), addEventListener: () => {}, removeEventListener: () => {} })),
    );
    const user = userEvent.setup();
    openPanel();
    const trigger = await screen.findByRole('button', { name: 'Abrir menu lateral' });
    await user.click(trigger);
    const drawer = screen.getByRole('dialog', { name: 'Menu do gestor' });
    expect(drawer).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole('link', { name: 'Categorias' }));
    expect(await screen.findByText('Área atual categories')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
});

it('restaura a área pelo endereço e acompanha Voltar e Avançar', async () => {
    window.history.replaceState(null, '', '/#categorias');
    const user = userEvent.setup();
    openPanel();
    expect(await screen.findByText('Área atual categories')).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Atendimento' }));
    expect(await screen.findByText('Área atual queue')).toBeVisible();
    expect(window.location.pathname).toBe('/atendimento');
    window.history.back();
    expect(await screen.findByText('Área atual categories')).toBeVisible();
    window.history.forward();
    expect(await screen.findByText('Área atual queue')).toBeVisible();
});

it.each([false, true])('respeita a preferência de movimento ao trocar áreas e voltar (reduzido: %s)', async (reduced) => {
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }));
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }));
    const user = userEvent.setup();
    try {
        openPanel();
        const categories = await screen.findByRole('link', { name: 'Categorias' });
        animate.mockClear();
        await user.click(categories);
        expect(await screen.findByText('Área atual categories')).toBeVisible();
        expect(animate).toHaveBeenCalledTimes(reduced ? 0 : 1);
        window.history.back();
        expect(await screen.findByText('Área atual overview')).toBeVisible();
        expect(animate).toHaveBeenCalledTimes(reduced ? 0 : 2);
        if (!reduced) expect(cancel).toHaveBeenCalled();
    } finally {
        if (original) Object.defineProperty(HTMLElement.prototype, 'animate', original);
        else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    }
});

it('permite pular a navegação lateral e entrar no conteúdo atual pelo teclado', async () => {
    const user = userEvent.setup();
    openPanel();
    const skip = await screen.findByRole('link', { name: 'Ir para o conteúdo' });
    skip.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toContainElement(screen.getByText('Área atual overview'));
    expect(window.location.hash).toBe('');
});

it('mantém um único carregamento identificado até o catálogo chegar e preserva o menu', async () => {
    const { CategoryManager } = await import('../src/category-manager');
    let finish!: (r: Response) => void;
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
            url === '/api/v1/me'
                ? Response.json({ data: { role: 'MANAGER' } }, { headers: { 'X-Session-Expires-At': new Date(Date.now() + 60000).toISOString() } })
                : new Promise<Response>((ok) => {
                      finish = ok;
                  }),
        ),
    );
    render(<ManagerAccess>{(expire, nav) => (nav.section === 'categories' ? <CategoryManager onSessionExpired={expire} /> : <p>Início do gestor</p>)}</ManagerAccess>);
    const menu = await screen.findByRole('link', { name: 'Categorias' });
    await userEvent.click(menu);
    expect(screen.getByRole('status', { name: 'Carregando painel' })).toHaveTextContent('MyCity');
    expect(screen.getByRole('link', { name: 'Categorias' })).toBe(menu);
    finish(Response.json({ data: [{ id: 'TREE', name: 'Árvores', archived: false }] }));
    expect(await screen.findByRole('button', { name: 'Editar Árvores' })).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Carregando painel' })).toBeNull();
});
