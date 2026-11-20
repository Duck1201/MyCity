import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrototypeConsole } from '../src/prototype/console';

beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/visao-geral');
});
afterEach(() => vi.unstubAllGlobals());

it('preserves the chosen rail width and collapsed state between visits to the preview', async () => {
    const user = userEvent.setup();
    const view = render(<PrototypeConsole />);
    const separator = screen.getByRole('separator', { name: 'Largura do menu lateral' });
    separator.focus();
    await user.keyboard('{End}');
    const saved = separator.getAttribute('aria-valuemax');
    await user.click(screen.getByRole('button', { name: 'Recolher menu lateral' }));
    view.unmount();
    render(<PrototypeConsole />);
    await user.click(screen.getByRole('button', { name: 'Expandir menu lateral' }));
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', saved);
    await user.click(screen.getByRole('link', { name: 'Atendimento' }));
    expect(location.pathname).toBe('/atendimento');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado da prévia' }), 'loading');
    expect(screen.getByRole('status', { name: 'Carregando denúncias' })).toBeVisible();
});
it('opens the mobile drawer, returns focus on Escape and follows a clean path', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('760px'), addEventListener: () => {}, removeEventListener: () => {} }));
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const trigger = screen.getByRole('button', { name: 'Abrir menu lateral' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole('link', { name: 'Categorias' }));
    expect(await screen.findByRole('heading', { name: 'Categorias', level: 1 })).toBeVisible();
    expect(location.pathname).toBe('/categorias');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('main')).toHaveFocus();
});

it('ends the demo from the manager account footer and can start a fresh preview', async () => {
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    expect(screen.getByText('Gestor público')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(screen.getByRole('heading', { name: 'Prévia encerrada' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Abrir painel demonstrativo' }));
    expect(screen.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
});

it('identifies the case in the browser tab and skips to content without changing its clean URL', async () => {
    history.replaceState(null, '', '/atendimento/MC-1048');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    expect(document.title).toBe('MC-1048 · Atendimento · MyCity');
    await user.click(screen.getByRole('link', { name: 'Ir para o conteúdo' }));
    expect(location.hash).toBe('');
    expect(screen.getByRole('main')).toHaveFocus();
});

it('moves between views and reverses the detail transition on browser Back without replaying it for filters', async () => {
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const main = screen.getByRole('main');
    const cancel = vi.fn();
    const animate = vi.fn<(frames: Keyframe[]) => { cancel: typeof cancel }>(() => ({ cancel }));
    Object.defineProperty(main, 'animate', { value: animate });
    await user.click(screen.getByRole('link', { name: 'Atendimento' }));
    expect(animate).toHaveBeenCalledTimes(1);
    const category = screen.getByRole('combobox', { name: 'Categoria' });
    await user.selectOptions(category, 'POTHOLE');
    expect(screen.getByRole('combobox', { name: 'Categoria' })).toBe(category);
    expect(animate).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('link', { name: 'Abrir denúncia MC-1048' }));
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls.at(-1)?.[0][0]?.transform).toMatch(/^translateX\(\d/);
    history.back();
    await waitFor(() => expect(location.pathname).toBe('/atendimento'));
    expect(animate).toHaveBeenCalledTimes(3);
    expect(animate.mock.calls.at(-1)?.[0][0]?.transform).toMatch(/^translateX\(-/);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('link', { name: 'Abrir denúncia MC-1048' })).toHaveFocus();
});

it('keeps navigation immediate when reduced motion is enabled', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduced-motion'), addEventListener: () => {}, removeEventListener: () => {} }));
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const main = screen.getByRole('main');
    const animate = vi.fn();
    Object.defineProperty(main, 'animate', { value: animate });
    await user.click(screen.getByRole('link', { name: 'Categorias' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Categorias' })).toBeVisible();
    expect(main).toHaveFocus();
    expect(animate).not.toHaveBeenCalled();
});

it.each([false, true])('abre a visão geral pela marca sem recarregar o painel, inclusive na gaveta (%s)', async (mobile) => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: mobile && query.includes('760px'), addEventListener: () => {}, removeEventListener: () => {} }));
    history.replaceState(null, '', '/atendimento/MC-1048');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    if (mobile) await user.click(screen.getByRole('button', { name: 'Abrir menu lateral' }));
    const brand = screen.getByRole('link', { name: 'MyCity — Visão geral' });
    expect(brand).toHaveAttribute('href', '/visao-geral');
    brand.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'Visão geral', level: 1 })).toBeVisible();
    expect(location.pathname).toBe('/visao-geral');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
});
