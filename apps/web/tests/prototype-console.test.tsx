import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import * as confirmationStore from '../src/prototype/confirmation-store';
import { Detail } from '../src/prototype/detail';
import { records } from '../src/prototype/demo';
import { PrototypeConsole } from '../src/prototype/console';
import credits from '../src/prototype/images/report-credits.json';

it('opens the administrative overview and navigates to the full queue without a fragment', async () => {
    history.replaceState(null, '', '/visao-geral');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Visão geral' })).toBeVisible();
    await user.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Atendimento' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Atendimento' })).toBeVisible();
    expect(screen.getByRole('table')).toBeVisible();
    expect(location.pathname).toBe('/atendimento');
    expect(location.hash).toBe('');
});

it('follows a chart into a filtered queue, handles the case and returns to its filter', async () => {
    history.replaceState(null, '', '/visao-geral');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    await user.click(await screen.findByRole('link', { name: 'Filtrar por Enviado' }));
    const filteredUrl = location.pathname + location.search;
    expect(location.search).not.toBe('');
    await user.click(await screen.findByRole('link', { name: 'Abrir denúncia MC-1048' }));
    expect(location.pathname).toMatch(/^\/atendimento\/.+/);
    await user.click(await screen.findByRole('button', { name: 'Iniciar análise' }));
    await user.click(screen.getByRole('link', { name: 'Voltar ao atendimento' }));
    await waitFor(() => expect(location.pathname + location.search).toBe(filteredUrl));
    expect(screen.queryByRole('link', { name: 'Abrir denúncia MC-1048' })).toBeNull();
});

it('separates archived categories and restores focus after archiving, canceling, reactivating and recovery', async () => {
    history.replaceState(null, '', '/categorias');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    await user.click(screen.getByRole('button', { name: 'Arquivar Buraco na via' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    const disclosure = screen.getByRole('button', { name: 'Ver categorias arquivadas (1)' });
    await waitFor(() => expect(disclosure).toHaveFocus());
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Reativar Buraco na via' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Categoria arquivada.');
    await user.keyboard('{Enter}');
    const reactivate = screen.getByRole('button', { name: 'Reativar Buraco na via' });
    await user.click(reactivate);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(reactivate).toHaveFocus());
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Arquivar Buraco na via' })).toHaveFocus());
    expect(screen.getByRole('status')).toHaveTextContent('Categoria reativada.');
    expect(screen.getByText('Nenhuma categoria arquivada.')).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado da prévia' }), 'error');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(screen.getByRole('main')).toHaveFocus();
});

it('keeps queue controls in place and restores category focus when filters are cleared', async () => {
    history.replaceState(null, '', '/atendimento');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const category = screen.getByRole('combobox', { name: 'Categoria' });
    const reset = screen.getByRole('button', { name: 'Limpar filtros' });
    expect(reset).toBeDisabled();
    await user.selectOptions(category, 'POTHOLE');
    expect(category).toHaveFocus();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Situação' }), 'SENT');
    await user.click(reset);
    expect(location.search).toBe('');
    expect(category).toHaveFocus();
    expect(reset).toBeDisabled();
});

it('opens category registration in a dialog and returns focus on Escape', async () => {
    history.replaceState(null, '', '/categorias');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const add = screen.getByRole('button', { name: 'Adicionar categoria' });
    await user.click(add);
    expect(screen.getByRole('dialog', { name: 'Adicionar categoria' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Nome da categoria' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(add).toHaveFocus());
    expect(screen.queryByRole('dialog')).toBeNull();
});

it('applies the chart day to the queue and preserves it during a category change', async () => {
    history.replaceState(null, '', '/atendimento?dia=2026-11-19');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-11-19');
    expect(screen.getByLabelText('Data final')).toHaveValue('2026-11-19');
    const dates = screen.getAllByRole('cell', { name: '19/11/2026' });
    expect(screen.getAllByRole('row')).toHaveLength(dates.length + 1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), 'POTHOLE');
    expect(new URLSearchParams(location.search).get('dia')).toBe('2026-11-19');
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(location.search).toBe('');
});

it('opens the leading category in the ranked list with the same pending count', async () => {
    history.replaceState(null, '', '/visao-geral');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const ranking = within(screen.getByRole('region', { name: 'Pendências por categoria' }));
    const first = ranking.getAllByRole('link')[0]!;
    expect(first).toHaveAccessibleName('Filtrar por Buraco na via');
    expect(first).toHaveAccessibleDescription('4 pendências');
    await user.click(first);
    expect(screen.getByLabelText('Categoria')).toHaveValue('POTHOLE');
    expect(screen.getByLabelText('Situação')).toHaveValue('pending');
    expect(screen.getByText('4 ocorrências')).toBeVisible();
});

it('preserves access to all categories when the last active category is archived', async () => {
    history.replaceState(null, '', '/categorias');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const active = within(screen.getByRole('region', { name: 'Categorias ativas' }));
    expect(active.getAllByRole('button', { name: /^Editar / })).toHaveLength(6);
    const names = active.getAllByRole('button', { name: /^Arquivar / }).map((button) => button.getAttribute('aria-label')!);
    expect(names).toHaveLength(6);
    for (const name of names) {
        await user.click(active.getByRole('button', { name }));
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    }
    expect(active.getByText('Nenhuma categoria ativa.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Ver categorias arquivadas (6)' }));
    expect(screen.getAllByRole('button', { name: /^Reativar / })).toHaveLength(6);
});

it('keeps pagination reachable by keyboard while moving through the queue', async () => {
    history.replaceState(null, '', '/atendimento');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const next = screen.getByRole('button', { name: 'Próxima' });
    const previous = screen.getByRole('button', { name: 'Anterior' });
    next.focus();
    await user.keyboard('{Enter}');
    expect(next).toHaveFocus();
    expect(screen.getByText('Página 2 de 3')).toBeVisible();
    await user.keyboard('{Enter}');
    expect(previous).toHaveFocus();
    expect(screen.getByText('Página 3 de 3')).toBeVisible();
    await user.keyboard('{Enter}');
    expect(screen.getByText('Página 2 de 3')).toBeVisible();
});

it('confirms a reply next to the editor and keeps the keyboard at the confirmation', async () => {
    history.replaceState(null, '', '/atendimento/MC-1048');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const field = screen.getByRole('textbox', { name: 'Responder ao cidadão' });
    await user.type(field, 'Vistoria realizada.');
    await user.click(screen.getByRole('button', { name: 'Publicar resposta' }));
    const editor = screen.getByRole('form', { name: 'Responder ao cidadão' });
    expect(within(editor).getByRole('status')).toHaveTextContent('Resposta publicada.');
    expect(within(editor).getByRole('status')).toHaveFocus();
    expect(within(screen.getByRole('region', { name: 'Histórico' })).getByText('Vistoria realizada.')).toBeVisible();
});

it('mantém os quatro registros mais recentes e permite consultar os anteriores', async () => {
    history.replaceState(null, '', '/atendimento/MC-1048');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const historyRegion = within(screen.getByRole('region', { name: 'Histórico' }));
    for (const text of ['Primeira resposta', 'Segunda resposta', 'Terceira resposta', 'Quarta resposta']) {
        await user.type(screen.getByRole('textbox', { name: 'Responder ao cidadão' }), text);
        await user.click(screen.getByRole('button', { name: 'Publicar resposta' }));
    }
    expect(historyRegion.getAllByRole('listitem')).toHaveLength(4);
    expect(historyRegion.getAllByRole('listitem')[0]).toHaveTextContent('Resposta pública');
    expect(historyRegion.getAllByRole('listitem')[0]).toHaveTextContent('Quarta resposta');
    const older = historyRegion.getByRole('button', { name: /Ver registros anteriores/ });
    await user.click(older);
    expect(historyRegion.getAllByRole('listitem')).toHaveLength(5);
    expect(older).toHaveAttribute('aria-expanded', 'true');
    await user.click(older);
    expect(historyRegion.getAllByRole('listitem')).toHaveLength(4);
});

it('marks archived categories in the management filter while preserving their reports', async () => {
    history.replaceState(null, '', '/categorias');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    await user.click(screen.getByRole('button', { name: 'Arquivar Buraco na via' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await user.click(screen.getByRole('link', { name: 'Atendimento' }));
    const category = screen.getByRole('combobox', { name: 'Categoria' });
    await user.selectOptions(category, within(category).getByRole('option', { name: 'Buraco na via (arquivada)' }));
    expect(screen.getByRole('link', { name: 'Abrir denúncia MC-1048' })).toBeVisible();
});

it('shows distinct photographs for reports of the same category and keeps the selected image and attribution in detail', async () => {
    history.replaceState(null, '', '/atendimento?category=POTHOLE');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const photos = Array.from(screen.getByRole('table').querySelectorAll('tbody img'), (image) => image.getAttribute('src'));
    expect(photos).toHaveLength(4);
    expect(new Set(photos).size).toBe(4);
    const open = screen.getByRole('link', { name: 'Abrir denúncia MC-1042' });
    const preview = open.closest('tr')!.querySelector('img')!.getAttribute('src');
    await user.click(open);
    const image = screen.getByRole('img', { name: 'Foto demonstrativa da ocorrência de Buraco na via' });
    expect(image).toHaveAttribute('src', preview);
    expect(preview).toMatch(/pothole-3\.jpg/);
    const links = within(image.closest('figure')!);
    expect(links.queryByRole('button')).toBeNull();
    expect(links.queryByRole('status')).toBeNull();
    expect(links.getByRole('link', { name: credits.POTHOLE_3.author })).toHaveAttribute('href', credits.POTHOLE_3.source);
    expect(links.getByRole('link', { name: credits.POTHOLE_3.license })).toHaveAttribute('href', credits.POTHOLE_3.licenseUrl);
});

it('links the occurrence title to its detail with one keyboard stop per table row', async () => {
    history.replaceState(null, '', '/atendimento');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const table = within(screen.getByRole('table'));
    expect(table.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Ocorrência', 'Situação', 'Registro', 'Confirmações']);
    const row = within(table.getAllByRole('row')[1]!);
    const cells = row.getAllByRole('cell');
    expect(cells).toHaveLength(4);
    const link = within(cells[0]!).getByRole('link', { name: 'Abrir denúncia MC-1048' });
    expect(link).toHaveTextContent('Buraco próximo à travessia de pedestres');
    expect(within(cells[0]!).getByText('MC-1048')).toBeVisible();
    expect(within(cells[0]!).getByText('Rua dos Passos, 38')).toBeVisible();
    expect(row.getAllByRole('link')).toEqual([link]);
    link.focus();
    await user.keyboard('{Enter}');
    expect(location.pathname).toBe('/atendimento/MC-1048');
    await user.click(screen.getByRole('link', { name: 'Voltar ao atendimento' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Abrir denúncia MC-1048' })).toHaveFocus());
});

it('searches the full queue by protocol, address and report text and keeps focus while typing', async () => {
    history.replaceState(null, '', '/atendimento?pagina=2');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const input = screen.getByRole('searchbox', { name: 'Buscar denúncias' });
    await user.type(input, 'mc1035');
    expect(screen.getByText('1 ocorrência')).toBeVisible();
    expect(location.search).not.toContain('pagina=');
    expect(screen.getByRole('link', { name: /MC-1035/ })).toBeVisible();
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, 'rua dos passos, 38');
    expect(screen.getByText('1 ocorrência')).toBeVisible();
    expect(screen.getByRole('link', { name: /MC-1048/ })).toBeVisible();
    await user.clear(input);
    await user.type(input, 'travessia de pedestres');
    expect(screen.getByText('4 ocorrências')).toBeVisible();
});

it('combines inclusive registration dates with sorting and prevents exporting an invalid period', async () => {
    history.replaceState(null, '', '/atendimento?de=2026-11-11&ate=2026-11-13');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    expect(screen.getByText('3 ocorrências')).toBeVisible();
    const order = screen.getByRole('combobox', { name: 'Ordenar por' });
    await user.selectOptions(order, 'recentes');
    expect(within(screen.getAllByRole('row')[1]!).getByRole('link')).toHaveAttribute('href', '/atendimento/MC-1046');
    await user.selectOptions(order, 'antigas');
    expect(within(screen.getAllByRole('row')[1]!).getByRole('link')).toHaveAttribute('href', '/atendimento/MC-1048');
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-11-10' } });
    expect(screen.getByRole('alert')).toHaveTextContent('A data final deve ser igual ou posterior à inicial.');
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('15 ocorrências')).toBeVisible();
    expect(order).toHaveValue('prioridade');
});

it.each([
    ['MC-1046', 'WASTE', 'WASTE_2'],
    ['MC-1049', 'WASTE_2', 'WASTE'],
] as const)('shows each full image and its attribution in the gallery of %s', async (id, first, second) => {
    const user = userEvent.setup();
    history.replaceState(null, '', '/atendimento/' + id);
    render(<PrototypeConsole />);
    const gallery = within(screen.getByRole('figure', { name: 'Fotos da ocorrência' }));
    const viewer = within(gallery.getByRole('group', { name: 'Visualização das fotos' }));
    expect(viewer.getByRole('img')).toBeVisible();
    expect(viewer.getByRole('button', { name: 'Foto anterior' })).toHaveAttribute('aria-disabled', 'true');
    expect(viewer.getByRole('button', { name: 'Próxima foto' })).toHaveAttribute('aria-disabled', 'false');
    const counter = gallery.getByRole('status');
    expect(counter).toHaveTextContent('Foto 1 de 2');
    expect(gallery.getByRole('link', { name: credits[first].author })).toHaveAttribute('href', credits[first].source);
    const cover = gallery.getByRole('img').getAttribute('src');
    await user.click(gallery.getByRole('button', { name: 'Próxima foto' }));
    expect(counter).toHaveTextContent('Foto 2 de 2');
    expect(gallery.getByRole('img')).not.toHaveAttribute('src', cover);
    expect(gallery.getByRole('link', { name: credits[second].author })).toHaveAttribute('href', credits[second].source);
    expect(gallery.getByRole('link', { name: credits[second].license })).toHaveAttribute('href', credits[second].licenseUrl);
    await user.keyboard('{ArrowLeft}');
    expect(counter).toHaveTextContent('Foto 1 de 2');
    expect(gallery.getByRole('img')).toHaveAttribute('src', cover);
});

it('mantém o mesmo vínculo ao editar o nome de uma categoria utilizada', async () => {
    history.replaceState(null, '', '/categorias');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    await user.click(screen.getByRole('button', { name: 'Editar Lixo não coletado' }));
    const field = screen.getByRole('textbox', { name: 'Nome da categoria' });
    await user.clear(field);
    await user.type(field, 'Coleta de resíduos');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await user.click(screen.getByRole('link', { name: 'Atendimento' }));
    await user.selectOptions(screen.getByLabelText('Categoria'), 'WASTE');
    await user.click(screen.getByRole('link', { name: 'Abrir denúncia MC-1046' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Coleta de resíduos' })).toBeVisible();
});

it('corrige a etapa aberta e reabre uma solicitação encerrada preservando o histórico', async () => {
    history.replaceState(null, '', '/atendimento/MC-1046');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Outras ações de situação' }));
    await user.click(screen.getByRole('menuitem', { name: 'Voltar para análise' }));
    await user.click(screen.getByRole('button', { name: 'Outras ações de situação' }));
    expect(screen.queryByRole('menuitem', { name: 'Devolver para Enviado' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Iniciar atendimento' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Iniciar atendimento' }));
    await user.click(screen.getByRole('button', { name: 'Marcar como resolvida' }));
    await user.click(screen.getByRole('button', { name: 'Reabrir solicitação' }));
    expect(screen.getByRole('button', { name: 'Iniciar atendimento' })).toBeVisible();
    expect(screen.getByText('Reaberta: Resolvido → Em análise')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Outras ações de situação' }));
    expect(screen.queryByRole('menuitem', { name: 'Devolver para Enviado' })).toBeNull();
    await user.keyboard('{Escape}');
});

it('separa rejeição e recuo do avanço principal e devolve o foco ao cancelar a justificativa', async () => {
    history.replaceState(null, '', '/atendimento/MC-1047');
    const user = userEvent.setup();
    render(<PrototypeConsole />);
    const primary = screen.getByRole('button', { name: 'Iniciar atendimento' });
    expect(primary).toBeVisible();
    const trigger = screen.getByRole('button', { name: 'Outras ações de situação' });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Devolver para Enviado' })).toBeVisible();
    await user.click(screen.getByRole('menuitem', { name: 'Rejeitar denúncia' }));
    expect(screen.getByRole('textbox', { name: 'Justificativa da rejeição' })).toHaveFocus();
    expect(primary).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(trigger).toHaveFocus();
    await user.click(primary);
    expect(screen.getByText('Situação atualizada para Em andamento.')).toHaveFocus();
});

it('fecha a rejeição que perdeu a validade após outra aba avançar o atendimento', async () => {
    const user = userEvent.setup();
    const row = records.find((item) => item.id === 'MC-1047')!;
    const update = () => true;
    const view = render(<Detail row={row} update={update} />);
    await user.click(screen.getByRole('button', { name: 'Outras ações de situação' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rejeitar denúncia' }));
    await user.type(screen.getByRole('textbox', { name: 'Justificativa da rejeição' }), 'Relato em revisão.');
    view.rerender(<Detail row={{ ...row, status: 'IN_PROGRESS', statusTrail: [...row.statusTrail, 'IN_PROGRESS'] }} update={update} />);
    expect(screen.queryByRole('button', { name: 'Confirmar rejeição' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Marcar como resolvida' })).toBeEnabled();
    expect(screen.getByText('A situação mudou. Confira a etapa atual antes de continuar.')).toHaveFocus();
});

it('mantém a justificativa no histórico ao reabrir o detalhe após rejeitar', async () => {
    const peer = vi.spyOn(confirmationStore, 'previewPeer').mockReturnValue('http://localhost:8093');
    try {
        history.replaceState(null, '', '/atendimento/MC-1047');
        const user = userEvent.setup();
        const view = render(<PrototypeConsole />);
        await user.click(screen.getByRole('button', { name: 'Outras ações de situação' }));
        await user.click(screen.getByRole('menuitem', { name: 'Rejeitar denúncia' }));
        await user.type(screen.getByRole('textbox', { name: 'Justificativa da rejeição' }), 'Registro duplicado.');
        await user.click(screen.getByRole('button', { name: 'Confirmar rejeição' }));
        view.unmount();
        render(<PrototypeConsole />);
        const log = within(screen.getByRole('region', { name: 'Histórico' }));
        expect(await log.findByText('Em análise → Rejeitado — Registro duplicado.')).toBeVisible();
        expect(screen.getByRole('button', { name: 'Reabrir solicitação' })).toBeVisible();
    } finally {
        peer.mockRestore();
        localStorage.clear();
    }
});
