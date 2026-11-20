import { fireEvent, render, screen } from '@testing-library/react-native';
import type { CitizenRequest } from '../src/citizen-api';
import { Filters, FilterVisibilityContext } from '../src/report-filters';

it('mostra os nomes dos filtros ativos com o painel fechado', async () => {
    const request: CitizenRequest = async () => {
        throw new Error('O painel está fechado.');
    };
    const props = { request, statuses: ['UNDER_REVIEW'] as const, onChange: jest.fn() };
    const view = await render(<Filters {...props} filters={{ category: 'POTHOLE', categoryName: 'Buraco na pista', status: 'UNDER_REVIEW' }} />);

    expect(screen.getByRole('button', { name: 'Filtros: Buraco na pista, Em análise', expanded: false })).toBeVisible();
    expect(screen.getByText('Buraco na pista · Em análise')).toBeVisible();

    await view.rerender(<Filters {...props} filters={{}} />);
    expect(screen.getByRole('button', { name: 'Filtros', expanded: false })).toBeVisible();
    expect(screen.queryByText('Buraco na pista · Em análise')).toBeNull();
});

it('mantém o atalho global oculto enquanto os filtros estão abertos e o libera ao sair da tela', async () => {
    const visibility = jest.fn();
    const view = await render(
        <FilterVisibilityContext.Provider value={visibility}>
            <Filters
                request={async () => {
                    throw new Error();
                }}
                statuses={[]}
                filters={{}}
                onChange={jest.fn()}
            />
        </FilterVisibilityContext.Provider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
    expect(visibility).toHaveBeenLastCalledWith(true);
    await view.unmount();
    expect(visibility).toHaveBeenLastCalledWith(false);
});

it('mantém o botão Limpar no rodapé após limpar e aguarda a aplicação', async () => {
    const onChange = jest.fn();
    await render(<Filters filters={{ status: 'UNDER_REVIEW' }} statuses={['UNDER_REVIEW']} request={jest.fn()} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Filtros: Em análise' }));
    const clear = screen.getByRole('button', { name: 'Limpar' });
    expect(clear).toBeEnabled();
    await fireEvent.press(clear);
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(onChange).toHaveBeenCalledWith({});
});
