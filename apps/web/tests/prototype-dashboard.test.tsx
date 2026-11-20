import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { PrototypeConsole } from '../src/prototype/console';

it('groups the queue indicators over a municipality-neutral cover and opens the oldest pending case', async () => {
    const user = userEvent.setup();
    history.replaceState(null, '', '/visao-geral');
    render(<PrototypeConsole />);
    const region = screen.getByRole('region', { name: 'Visão geral' });
    const cover = within(region);
    expect(region.querySelector('img[alt=""]')).toHaveAttribute('src', '/images/urban-grid.svg');
    expect(region).not.toHaveTextContent(/Viçosa|Lagoa da UFV/);
    expect(cover.getByRole('link', { name: /10 Denúncias pendentes/ })).toHaveAttribute('href', '/atendimento?status=pending');
    const oldest = cover.getByRole('link', { name: /8 dias Pendência mais antiga/ });
    oldest.focus();
    await user.keyboard('{Enter}');
    expect(location.pathname).toBe('/atendimento/MC-1048');
    expect(screen.getByText('Rua dos Passos, 38')).toBeVisible();
});

it('shows a proportional slice for each populated status with the total in the center and values in the legend', async () => {
    const user = userEvent.setup();
    history.replaceState(null, '', '/visao-geral');
    render(<PrototypeConsole />);
    const chart = within(screen.getByRole('region', { name: 'Denúncias por situação' }));
    const ring = within(chart.getByRole('group', { name: 'Distribuição por situação' }));
    expect(ring.getAllByRole('link')).toHaveLength(6);
    expect(ring.getByText('15')).toBeVisible();
    const sent = ring.getByRole('link', { name: 'Enviado (6)' });
    const legend = chart.getByRole('link', { name: 'Filtrar por Enviado' });
    expect(legend).toHaveAccessibleDescription('6 de 15 denúncias, 40%');
    await user.hover(sent);
    expect(ring.getByText('15')).toBeVisible();
    expect(within(legend).getByText('40%')).toBeVisible();
    expect(chart.queryByRole('tooltip')).toBeNull();
    ring.getByRole('link', { name: 'Cancelado (1)' }).focus();
    await user.tab();
    expect(legend).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(location.search).toBe('?status=SENT');
});

it('presents a single first-use state when no report has been registered', async () => {
    const user = userEvent.setup();
    history.replaceState(null, '', '/visao-geral');
    render(<PrototypeConsole />);
    await user.selectOptions(screen.getByLabelText('Estado da prévia'), 'empty');
    expect(screen.getByRole('heading', { name: 'Nenhuma denúncia registrada' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Consultar categorias' })).toHaveAttribute('href', '/categorias');
    expect(screen.queryByRole('region', { name: 'Denúncias por situação' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Prioridade de atendimento' })).toBeNull();
});

it('moves the highlighted slice with the keyboard when the pointer stays on the previous status', async () => {
    const user = userEvent.setup();
    history.replaceState(null, '', '/visao-geral');
    render(<PrototypeConsole />);
    const sent = screen.getByRole('link', { name: 'Filtrar por Enviado' });
    await user.hover(sent);
    sent.focus();
    await user.tab();
    const review = screen.getByRole('link', { name: 'Filtrar por Em análise' });
    expect(review).toHaveFocus();
    expect(review).toHaveAttribute('data-active', 'true');
    expect(sent).not.toHaveAttribute('data-active');
});

it('gives a keyboard user the context of each priority link before opening it', () => {
    history.replaceState(null, '', '/visao-geral');
    render(<PrototypeConsole />);
    expect(screen.getByRole('link', { name: 'Abrir denúncia MC-1048' })).toHaveAccessibleDescription(/Buraco próximo à travessia de pedestres.*Enviado.*18 confirmações/);
});
