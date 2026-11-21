import { useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
type Zoom = { scale: number; x: number; y: number };
const unzoomed: Zoom = { scale: 1, x: 0, y: 0 };
const tapScale = 2.5;
const maxScale = 6;
// Keep a zoomed photo covering the stage instead of sliding off it.
function bounded(zoom: Zoom, box: { width: number; height: number }): Zoom {
    const limitX = ((zoom.scale - 1) * box.width) / 2;
    const limitY = ((zoom.scale - 1) * box.height) / 2;
    return { scale: zoom.scale, x: Math.min(limitX, Math.max(-limitX, zoom.x)), y: Math.min(limitY, Math.max(-limitY, zoom.y)) };
}
type GalleryPhoto = { image: string; width?: number; height?: number; credit?: { source: string; author: string; licenseUrl: string; license: string } };

export function PhotoGallery({ photos, category }: { photos: readonly GalleryPhoto[]; category: string }) {
    const [index, setIndex] = useState(0);
    const start = useRef<{ x: number; y: number; id: number } | null>(null);
    const swiped = useRef(false);
    const [viewing, setViewing] = useState(false);
    const [zoom, setZoom] = useState<Zoom>(unzoomed);
    const stage = useRef<HTMLDivElement>(null);
    const drag = useRef<{ x: number; y: number; from: Zoom; moved: boolean } | null>(null);
    const multiple = photos.length > 1;
    const position = Math.min(index, photos.length - 1);
    const photo = photos[position];
    if (!photo) return null;
    function step(amount: number) {
        setIndex((value) => Math.min(photos.length - 1, Math.max(0, Math.min(value, photos.length - 1) + amount)));
        setZoom(unzoomed);
    }
    // Scale around a point of the stage (in client coordinates) so that point stays under the cursor.
    function zoomAt(scale: number, clientX?: number, clientY?: number) {
        setZoom((current) => {
            const box = stage.current?.getBoundingClientRect();
            const next = Math.min(maxScale, Math.max(1, scale));
            if (!box || next === 1) return unzoomed;
            const fx = (clientX ?? box.left + box.width / 2) - (box.left + box.width / 2);
            const fy = (clientY ?? box.top + box.height / 2) - (box.top + box.height / 2);
            const ratio = next / current.scale;
            return bounded({ scale: next, x: fx - ratio * (fx - current.x), y: fy - ratio * (fy - current.y) }, box);
        });
    }
    const label = multiple ? 'Foto ' + (position + 1) + ' de ' + photos.length + ' da ocorrência de ' + category : (photo.credit ? 'Foto demonstrativa da ocorrência de ' : 'Foto da ocorrência de ') + category;
    const navigation = (
        <>
            <button type="button" className="case-gallery-previous" aria-label="Foto anterior" aria-disabled={position === 0} onClick={() => step(-1)}>
                <ChevronLeft size={21} aria-hidden="true" />
            </button>
            <button type="button" className="case-gallery-next" aria-label="Próxima foto" aria-disabled={position === photos.length - 1} onClick={() => step(1)}>
                <ChevronRight size={21} aria-hidden="true" />
            </button>
        </>
    );
    return (
        <figure
            aria-label="Fotos da ocorrência"
            className="case-gallery"
            onKeyDown={(event) => {
                if (!multiple || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
                event.preventDefault();
                step(event.key === 'ArrowLeft' ? -1 : 1);
            }}
        >
            <div className="case-gallery-frame" role={multiple ? 'group' : undefined} aria-label={multiple ? 'Visualização das fotos' : undefined} data-multiple={multiple || undefined}>
                <Dialog.Root
                    open={viewing}
                    onOpenChange={(open) => {
                        setViewing(open);
                        setZoom(unzoomed);
                    }}
                >
                    {/* The photo itself opens the viewer; no separate button. As the dialog trigger it also gets focus back on close. */}
                    <Dialog.Trigger asChild>
                        <button
                            type="button"
                            className="case-gallery-open"
                            aria-label={multiple ? 'Ampliar foto ' + (position + 1) + ' de ' + photos.length : 'Ampliar foto'}
                            onClick={(event) => {
                                // A swipe between photos ends with a click; only a tap opens the viewer.
                                if (!swiped.current) return;
                                swiped.current = false;
                                event.preventDefault();
                            }}
                            onPointerDown={(event) => {
                                if (multiple && event.pointerType === 'touch' && event.isPrimary) start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
                            }}
                            onPointerCancel={() => {
                                start.current = null;
                            }}
                            onPointerUp={(event) => {
                                const initial = start.current;
                                start.current = null;
                                if (!initial || event.pointerId !== initial.id) return;
                                const horizontal = event.clientX - initial.x;
                                if (Math.abs(horizontal) >= 40 && Math.abs(horizontal) > Math.abs(event.clientY - initial.y) * 1.5) {
                                    swiped.current = true;
                                    step(horizontal < 0 ? 1 : -1);
                                }
                            }}
                        >
                            <img src={photo.image} width={photo.width} height={photo.height} alt={label} />
                        </button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                        <Dialog.Overlay className="photo-viewer-scrim" />
                        <Dialog.Content
                            className="photo-viewer"
                            aria-describedby={undefined}
                            onKeyDown={(event) => {
                                if (!multiple || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
                                event.preventDefault();
                                step(event.key === 'ArrowLeft' ? -1 : 1);
                            }}
                        >
                            <Dialog.Title className="sr-only">{label}</Dialog.Title>
                            <div className="photo-viewer-bar">
                                {multiple && (
                                    <span role="status" aria-atomic="true">
                                        Foto {position + 1} de {photos.length}
                                    </span>
                                )}
                                <Dialog.Close aria-label="Fechar">
                                    <X size={22} aria-hidden="true" />
                                </Dialog.Close>
                            </div>
                            <div
                                className="photo-viewer-stage"
                                ref={stage}
                                data-zoomed={zoom.scale > 1 || undefined}
                                data-dragging={drag.current?.moved || undefined}
                                onPointerDown={(event) => {
                                    if (zoom.scale <= 1 || event.button !== 0) return;
                                    drag.current = { x: event.clientX, y: event.clientY, from: zoom, moved: false };
                                    event.currentTarget.setPointerCapture?.(event.pointerId);
                                }}
                                onPointerMove={(event) => {
                                    const start = drag.current;
                                    if (!start) return;
                                    const dx = event.clientX - start.x;
                                    const dy = event.clientY - start.y;
                                    if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true;
                                    const box = stage.current?.getBoundingClientRect();
                                    if (box) setZoom(bounded({ scale: start.from.scale, x: start.from.x + dx, y: start.from.y + dy }, box));
                                }}
                                // The click is read on the stage: after a drag the pointer is captured there, not on the photo.
                                onClick={(event) => {
                                    if (drag.current?.moved) return;
                                    if (zoom.scale > 1) setZoom(unzoomed);
                                    else zoomAt(tapScale, event.clientX, event.clientY);
                                }}
                                onPointerUp={() => {
                                    // Let the click that ends a drag know it was a drag.
                                    setTimeout(() => (drag.current = null));
                                }}
                            >
                                <img
                                    src={photo.image}
                                    width={photo.width}
                                    height={photo.height}
                                    alt={label}
                                    style={{ transform: 'translate(' + zoom.x + 'px, ' + zoom.y + 'px) scale(' + zoom.scale + ')' }}
                                    tabIndex={0}
                                    // Zoom is a click: in at the clicked point, out on the next click. Enter does the same from the keyboard.
                                    onKeyDown={(event) => {
                                        if (event.key !== 'Enter' && event.key !== ' ') return;
                                        event.preventDefault();
                                        if (zoom.scale > 1) setZoom(unzoomed);
                                        else zoomAt(tapScale);
                                    }}
                                />
                            </div>
                            {multiple && <div className="photo-viewer-nav">{navigation}</div>}
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
                {multiple && navigation}
            </div>
            <figcaption>
                {multiple && (
                    <span className="case-gallery-counter" role="status" aria-atomic="true">
                        Foto {position + 1} de {photos.length}
                    </span>
                )}
                {photo.credit && (
                    <>
                        <Camera size={16} aria-hidden="true" />
                        <span>
                            Foto ilustrativa ·{' '}
                            <a href={photo.credit.source} target="_blank" rel="noreferrer">
                                {photo.credit.author}
                            </a>{' '}
                            ·{' '}
                            <a href={photo.credit.licenseUrl} target="_blank" rel="noreferrer">
                                {photo.credit.license}
                            </a>
                        </span>
                    </>
                )}
            </figcaption>
        </figure>
    );
}
