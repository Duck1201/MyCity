import { useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import { Camera, ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
type GalleryPhoto = { image: string; width?: number; height?: number; credit?: { source: string; author: string; licenseUrl: string; license: string } };

export function PhotoGallery({ photos, category }: { photos: readonly GalleryPhoto[]; category: string }) {
    const [index, setIndex] = useState(0);
    const start = useRef<{ x: number; y: number; id: number } | null>(null);
    const swiped = useRef(false);
    const [viewing, setViewing] = useState(false);
    const [actualSize, setActualSize] = useState(false);
    const multiple = photos.length > 1;
    const position = Math.min(index, photos.length - 1);
    const photo = photos[position];
    if (!photo) return null;
    function step(amount: number) {
        setIndex((value) => Math.min(photos.length - 1, Math.max(0, Math.min(value, photos.length - 1) + amount)));
        setActualSize(false);
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
                <img
                    src={photo.image}
                    width={photo.width}
                    height={photo.height}
                    alt={label}
                    onClick={() => {
                        // A swipe between photos ends with a click; only a tap opens the viewer.
                        if (swiped.current) swiped.current = false;
                        else setViewing(true);
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
                />
                {multiple && navigation}
                <Dialog.Root
                    open={viewing}
                    onOpenChange={(open) => {
                        setViewing(open);
                        setActualSize(false);
                    }}
                >
                    <Dialog.Trigger className="case-gallery-expand" aria-label={multiple ? 'Ampliar foto ' + (position + 1) + ' de ' + photos.length : 'Ampliar foto'}>
                        <Maximize2 size={18} aria-hidden="true" />
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
                                <button type="button" aria-pressed={actualSize} onClick={() => setActualSize(!actualSize)}>
                                    Ver em tamanho real
                                </button>
                                <Dialog.Close aria-label="Fechar">
                                    <X size={22} aria-hidden="true" />
                                </Dialog.Close>
                            </div>
                            <div className="photo-viewer-stage" data-actual-size={actualSize || undefined}>
                                <img src={photo.image} width={photo.width} height={photo.height} alt={label} onClick={() => setActualSize(!actualSize)} />
                            </div>
                            {multiple && <div className="photo-viewer-nav">{navigation}</div>}
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
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
