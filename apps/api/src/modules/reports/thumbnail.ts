import sharp from 'sharp';

// List views show photos at about 60 px; 320 px stays sharp on high-density screens.
const thumbnailSide = 320;

export const thumbnailFile = (photoId: string) => photoId + '.thumb.jpg';

export function thumbnailOf(jpeg: Buffer) {
    return sharp(jpeg, { limitInputPixels: 1600 * 1600 })
        .resize(thumbnailSide, thumbnailSide, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
}
