import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { PhotoGallery } from '../src/components/photo-gallery';

// Read a CSS transform by its meaning: translate(x) is translate(x, 0).
const transformOf = (element: HTMLElement) => {
    const [, x, y = '0', scale] = /translate\((-?[\d.]+)px(?:, (-?[\d.]+)px)?\) scale\(([\d.]+)\)/.exec(element.style.transform)!;
    return { x: Number(x), y: Number(y), scale: Number(scale) };
};

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

it('abre o visualizador pela própria foto, sem botão de ampliar separado', async () => {
    const user = userEvent.setup();
    render(<PhotoGallery category="Buraco na via" photos={[photos[0]!]} />);
    const openers = screen.getAllByRole('button', { name: /^Ampliar foto/ });
    expect(openers).toHaveLength(1);
    expect(openers[0]).toContainElement(screen.getByRole('img', { name: 'Foto da ocorrência de Buraco na via' }));
    await user.click(screen.getByRole('img', { name: 'Foto da ocorrência de Buraco na via' }));
    expect(screen.getByRole('dialog', { name: 'Foto da ocorrência de Buraco na via' })).toBeVisible();
});

it('amplia no ponto clicado e volta no clique seguinte, também pelo teclado, sem botão de zoom', async () => {
    const user = userEvent.setup();
    render(<PhotoGallery category="Buraco na via" photos={[photos[0]!]} />);
    await user.click(screen.getByRole('img', { name: 'Foto da ocorrência de Buraco na via' }));
    const viewer = within(screen.getByRole('dialog', { name: 'Foto da ocorrência de Buraco na via' }));
    expect(viewer.queryByRole('button', { name: /Aproximar|Ajustar|tamanho real/ })).toBeNull();
    const stage = document.querySelector('.photo-viewer-stage') as HTMLElement;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
    const image = viewer.getByRole('img', { name: 'Foto da ocorrência de Buraco na via' });
    expect(transformOf(image)).toEqual({ x: 0, y: 0, scale: 1 });
    // A click a quarter of the way in zooms there: translate = (point - centre) * (1 - scale).
    fireEvent.click(image, { clientX: 200, clientY: 150 });
    expect(transformOf(image)).toEqual({ x: 300, y: 225, scale: 2.5 });
    // After a drag the pointer is captured by the stage, so the click that restores lands there.
    fireEvent.click(stage, { clientX: 200, clientY: 150 });
    expect(transformOf(image)).toEqual({ x: 0, y: 0, scale: 1 });
    // From the keyboard, Enter on the photo zooms at its centre and back.
    image.focus();
    await user.keyboard('{Enter}');
    expect(transformOf(image)).toEqual({ x: 0, y: 0, scale: 2.5 });
    await user.keyboard('{Enter}');
    expect(transformOf(image)).toEqual({ x: 0, y: 0, scale: 1 });
    await user.click(viewer.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
});

it('mantém a foto ampliada centrada no eixo em que ela ainda é menor que a tela, sem vazar para um lado', async () => {
    const user = userEvent.setup();
    render(<PhotoGallery category="Buraco na via" photos={[photos[0]!]} />);
    await user.click(screen.getByRole('img', { name: 'Foto da ocorrência de Buraco na via' }));
    const viewer = within(screen.getByRole('dialog', { name: 'Foto da ocorrência de Buraco na via' }));
    const stage = document.querySelector('.photo-viewer-stage') as HTMLElement;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
    const image = viewer.getByRole('img', { name: 'Foto da ocorrência de Buraco na via' }) as HTMLImageElement;
    // A tall photo (1:3) drawn with object-fit: contain in an 800x600 box is 200x600 on screen.
    for (const [key, value] of Object.entries({ naturalWidth: 100, naturalHeight: 300, clientWidth: 800, clientHeight: 600 })) Object.defineProperty(image, key, { value, configurable: true });
    // Zooming near the photo's left edge (it covers x 300..500): at 2.5x it is 500 px wide, still narrower than the 800 px stage, so it stays centred.
    fireEvent.click(stage, { clientX: 310, clientY: 150 });
    const zoomed = transformOf(image);
    expect(zoomed.scale).toBe(2.5);
    expect(zoomed.x).toBe(0);
    // Vertically it is 1500 px tall, so it may move, but only until its edge meets the stage edge: (1500 - 600) / 2.
    expect(zoomed.y).toBe(225);
    fireEvent.pointerDown(stage, { clientX: 400, clientY: 300, button: 0, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 900, clientY: 2000, pointerId: 1 });
    expect(transformOf(image)).toEqual({ x: 0, y: 450, scale: 2.5 });
});

it('fecha o visualizador ao clicar fora da foto e só amplia com clique sobre ela', async () => {
    const user = userEvent.setup();
    render(<PhotoGallery category="Buraco na via" photos={[photos[0]!]} />);
    const open = async () => {
        await user.click(screen.getByRole('img', { name: 'Foto da ocorrência de Buraco na via' }));
        const viewer = within(screen.getByRole('dialog', { name: 'Foto da ocorrência de Buraco na via' }));
        const stage = document.querySelector('.photo-viewer-stage') as HTMLElement;
        stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
        const image = viewer.getByRole('img', { name: 'Foto da ocorrência de Buraco na via' }) as HTMLImageElement;
        // A tall photo (1:3) drawn with object-fit: contain in an 800x600 box covers only x 300..500.
        for (const [key, value] of Object.entries({ naturalWidth: 100, naturalHeight: 300, clientWidth: 800, clientHeight: 600 })) Object.defineProperty(image, key, { value, configurable: true });
        return { stage, image };
    };
    const first = await open();
    // The dark band beside the photo closes the viewer instead of zooming.
    fireEvent.click(first.stage, { clientX: 100, clientY: 300 });
    expect(screen.queryByRole('dialog')).toBeNull();
    const { stage, image } = await open();
    fireEvent.click(stage, { clientX: 400, clientY: 300 });
    expect(transformOf(image).scale).toBe(2.5);
    // Zoomed, the photo is 500 px wide (x 150..650): the background still showing at x 100 closes it too.
    fireEvent.click(stage, { clientX: 100, clientY: 300 });
    expect(screen.queryByRole('dialog')).toBeNull();
});
