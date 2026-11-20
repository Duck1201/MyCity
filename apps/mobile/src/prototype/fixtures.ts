import { reportCategoryLabels, type ReportStatus } from '@mycity/contracts';
import { records } from '../../../web/src/prototype/demo';
import { reportPhotos, type Photo, type ReportPhotos } from '../../../web/src/prototype/images/report-photos';

export { photosForCategory, type Photo, type ReportPhotos } from '../../../web/src/prototype/images/report-photos';
export const photos = reportPhotos;
export type Category = keyof typeof photos;
export const categories = Object.keys(photos) as Category[];
export const categoryName = (category: Category) => reportCategoryLabels[category]!;
export const examplePoint = { latitude: -20.7526, longitude: -42.8818 };
export type Case = {
    id: number;
    category: Category;
    photo: Photo;
    photos: ReportPhotos;
    description: string;
    place: string;
    point: typeof examplePoint;
    status: ReportStatus;
    when: string;
    update: string;
    mine: boolean;
    confirmationCount: number;
    confirmedByMe: boolean;
};

// Illustrative points distributed inside the preview's initial map bounds.
export const cases: Case[] = records.map((row, index) => ({
    id: row.protocol,
    category: row.category,
    photo: row.photo,
    photos: row.photos,
    description: row.description,
    place: row.address,
    point:
        row.protocol === 1042
            ? examplePoint
            : {
                  latitude: examplePoint.latitude + (Math.floor(index / 4) - 1.5) * 0.0017,
                  longitude: examplePoint.longitude + ((index % 4) - 1.5) * 0.0019,
              },
    status: row.status,
    when: row.date,
    update: row.events.at(-1)!.text,
    mine: row.mine,
    confirmationCount: row.count,
    confirmedByMe: false,
}));
