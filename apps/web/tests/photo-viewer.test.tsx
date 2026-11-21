import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { PhotoGallery } from '../src/components/photo-gallery';

const photos = [
    { image: '/api/v1/reports/r/photos/1', width: 1600, height: 1200 },
    { image: '/api/v1/reports/r/photos/2', width: 1200, height: 1600 },
];

it('amplia a foto em tela cheia, navega pelo teclado e devolve o foco ao fechar', async () => {
    const user = userEvent.setup();
    render(<PhotoGallery category="Buraco na via" photos={photos} />);
    const trigger = screen.getByRole('button', { name: 'Ampliar foto 1 de 2' });
    await user.click(trigger);
    const viewer = within(screen.getByRole('dialog', { name: 'Foto 1 de 2 da ocorrência de Buraco na via' }));
    expect(viewer.getByRole('img', { name: 'Foto 1 de 2 da ocorrência de Buraco na via' })).toHaveAttribute('src', photos[0]!.image);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog', { name: 'Foto 2 de 2 da ocorrência de Buraco na via' })).toBeVisible();
    expect(viewer.getByRole('button', { name: 'Próxima foto' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(viewer.getByRole('button', { name: 'Foto anterior' }));
    expect(screen.getByRole('dialog', { name: 'Foto 1 de 2 da ocorrência de Buraco na via' })).toBeVisible();
    await user.keyboard('{ArrowRight}{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    // The gallery follows the photo seen last, and focus returns to what opened the viewer.
    expect(screen.getByRole('img', { name: 'Foto 2 de 2 da ocorrência de Buraco na via' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ampliar foto 2 de 2' })).toHaveFocus();
});

it('alterna entre ajustar à tela e o tamanho real ao clicar na foto ampliada', async () => {
    const user = userEvent.setup();
    render(<PhotoGallery category="Buraco na via" photos={[photos[0]!]} />);
    await user.click(screen.getByRole('img', { name: 'Foto da ocorrência de Buraco na via' }));
    const viewer = within(screen.getByRole('dialog', { name: 'Foto da ocorrência de Buraco na via' }));
    const zoom = viewer.getByRole('button', { name: 'Ver em tamanho real' });
    expect(zoom).toHaveAttribute('aria-pressed', 'false');
    await user.click(zoom);
    expect(viewer.getByRole('button', { name: 'Ver em tamanho real' })).toHaveAttribute('aria-pressed', 'true');
    expect(viewer.queryByRole('button', { name: 'Próxima foto' })).toBeNull();
    await user.click(viewer.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
});
