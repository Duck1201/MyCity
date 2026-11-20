import { useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react';
type GalleryPhoto = { image: string; width?: number; height?: number; credit?: { source: string; author: string; licenseUrl: string; license: string } };

export function PhotoGallery({ photos, category }: { photos: readonly GalleryPhoto[]; category: string }) {
    const [index, setIndex] = useState(0);
    const start = useRef<{ x: number; y: number; id: number } | null>(null);
    const multiple = photos.length > 1;
    const position = Math.min(index, photos.length - 1);
    const photo = photos[position];
    if (!photo) return null;
    function step(amount: number) {
        setIndex((value) => Math.min(photos.length - 1, Math.max(0, Math.min(value, photos.length - 1) + amount)));
    }
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
                    alt={multiple ? 'Foto ' + (position + 1) + ' de ' + photos.length + ' da ocorrência de ' + category : (photo.credit ? 'Foto demonstrativa da ocorrência de ' : 'Foto da ocorrência de ') + category}
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
                        if (Math.abs(horizontal) >= 40 && Math.abs(horizontal) > Math.abs(event.clientY - initial.y) * 1.5) step(horizontal < 0 ? 1 : -1);
                    }}
                />
                {multiple && (
                    <>
                        <button type="button" className="case-gallery-previous" aria-label="Foto anterior" aria-disabled={position === 0} onClick={() => step(-1)}>
                            <ChevronLeft size={21} aria-hidden="true" />
                        </button>
                        <button type="button" className="case-gallery-next" aria-label="Próxima foto" aria-disabled={position === photos.length - 1} onClick={() => step(1)}>
                            <ChevronRight size={21} aria-hidden="true" />
                        </button>
                    </>
                )}
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
