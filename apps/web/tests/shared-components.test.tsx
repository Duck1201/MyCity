import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { CategoryCatalogView, type Category, type CategoryChange } from '../src/category-catalog-view';
import { OverviewPanel } from '../src/components/overview-panel';
import { PhotoGallery } from '../src/components/photo-gallery';
import { SituationChart } from '../src/components/situation-chart';

it('moves between photos with buttons and arrow keys and keeps the attribution of the visible photo', async () => {
    const user = userEvent.setup();
    const credit = { source: 'https://example.test/photo', author: 'Autora Fictícia', licenseUrl: 'https://example.test/license', license: 'CC BY 4.0' };
    render(<PhotoGallery category="Buraco na via" photos={[{ image: '/first.jpg' }, { image: '/second.jpg', credit }]} />);

    expect(screen.getByRole('img', { name: 'Foto 1 de 2 da ocorrência de Buraco na via' })).toHaveAttribute('src', '/first.jpg');
    expect(screen.getByRole('button', { name: 'Foto anterior' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Próxima foto' }));
    expect(screen.getByRole('img', { name: 'Foto 2 de 2 da ocorrência de Buraco na via' })).toHaveAttribute('src', '/second.jpg');
    expect(screen.getByRole('status')).toHaveTextContent('Foto 2 de 2');
    const figure = within(screen.getByRole('figure', { name: 'Fotos da ocorrência' }));
    expect(figure.getByRole('link', { name: credit.author })).toHaveAttribute('href', credit.source);
    expect(figure.getByRole('link', { name: credit.license })).toHaveAttribute('href', credit.licenseUrl);

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('img', { name: 'Foto 1 de 2 da ocorrência de Buraco na via' })).toBeVisible();
});

it('links each non-empty situation slice to the queue filtered by that status', () => {
    render(<SituationChart counts={{ SENT: 2, UNDER_REVIEW: 1, IN_PROGRESS: 0, RESOLVED: 3, REJECTED: 0, CANCELED: 0 }} />);

    const ring = within(screen.getByRole('group', { name: 'Distribuição por situação' }));
    expect(ring.getAllByRole('link')).toHaveLength(3);
    expect(ring.getByRole('link', { name: 'Enviado (2)' })).toHaveAttribute('href', '/atendimento?status=SENT');
    expect(ring.getByRole('link', { name: 'Resolvido (3)' })).toHaveAttribute('href', '/atendimento?status=RESOLVED');
    expect(ring.getByText('6')).toBeInTheDocument();
});

function Catalog() {
    const [items, setItems] = useState<Category[]>([
        { id: 'POTHOLE', name: 'Buraco na via', icon: 'road', archived: false },
        { id: 'LIGHTING', name: 'Iluminação', icon: 'lighting', archived: false },
    ]);
    function save(id: string | undefined, change: CategoryChange) {
        setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
    }
    return <CategoryCatalogView items={items} count={() => 0} save={save} />;
}

it('moves focus to the archived section after archiving and back to the active entry after reactivating', async () => {
    const user = userEvent.setup();
    render(<Catalog />);

    await user.click(screen.getByRole('button', { name: 'Arquivar Buraco na via' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    const disclosure = screen.getByRole('button', { name: 'Ver categorias arquivadas (1)' });
    await waitFor(() => expect(disclosure).toHaveFocus());
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Reativar Buraco na via' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Arquivar Buraco na via' })).toHaveFocus());
    expect(screen.getByText('Nenhuma categoria arquivada.')).toBeVisible();
});

it('encontra a categoria ignorando acentos e maiúsculas', async () => {
    const user = userEvent.setup();
    render(<Catalog />);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar categoria' }), 'ILUMINACAO');
    expect(screen.getByText('Iluminação')).toBeVisible();
    expect(screen.queryByText('Buraco na via')).toBeNull();
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar categoria' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar categoria' }), 'semáforo');
    expect(screen.getByText('Nenhuma categoria ativa corresponde à busca.')).toBeVisible();
});

it('orienta o primeiro uso quando ainda não há denúncias', () => {
    const empty = { SENT: 0, UNDER_REVIEW: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, CANCELED: 0 };
    const { rerender } = render(<OverviewPanel counts={empty} ranked={[]} priorities={[]} recent={null} />);
    expect(screen.getByRole('heading', { name: 'Nenhuma denúncia registrada' })).toBeVisible();
    expect(screen.getByRole('link', { name: /categorias/i })).toHaveAttribute('href', '/categorias');

    rerender(<OverviewPanel counts={{ ...empty, SENT: 1 }} ranked={[]} priorities={[]} recent={null} />);
    expect(screen.queryByRole('heading', { name: 'Nenhuma denúncia registrada' })).toBeNull();
});
