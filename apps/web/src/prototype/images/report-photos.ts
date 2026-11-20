import credits from './report-credits.json';
import pothole from './pothole.jpg';
import waste from './waste.jpg';
import lighting from './lighting.jpg';
import debris from './debris.jpg';
import leak from './leak.jpg';
import tree from './tree.jpg';

import pothole2 from './pothole-2.jpg';
import pothole3 from './pothole-3.jpg';
import pothole4 from './pothole-4.jpg';
import lighting2 from './lighting-2.jpg';
import lighting3 from './lighting-3.jpg';
import waste2 from './waste-2.jpg';
import leak2 from './leak-2.jpg';
import tree2 from './tree-2.jpg';

export const reportPhotos = { POTHOLE: pothole, LIGHTING: lighting, WASTE: waste, LEAK: leak, DEBRIS: debris, TREE: tree };

export type PhotoCategory = keyof typeof reportPhotos;

const images = { ...reportPhotos, POTHOLE_2: pothole2, POTHOLE_3: pothole3, POTHOLE_4: pothole4, LIGHTING_2: lighting2, LIGHTING_3: lighting3, WASTE_2: waste2, LEAK_2: leak2, TREE_2: tree2 };
const assignments: Record<PhotoCategory, Partial<Record<number, keyof typeof images>>> = {
    POTHOLE: { 1044: 'POTHOLE_2', 1042: 'POTHOLE_3', 1040: 'POTHOLE_4' },
    LIGHTING: { 1043: 'LIGHTING_2', 1038: 'LIGHTING_3' },
    WASTE: { 1039: 'WASTE_2', 1049: 'WASTE_2' },
    LEAK: { 1037: 'LEAK_2' },
    TREE: { 1035: 'TREE_2' },
    DEBRIS: {},
};

function photoEntry(key: keyof typeof images) {
    return { image: images[key], credit: credits[key] };
}

export type Photo = ReturnType<typeof photoEntry>;
export type ReportPhotos = [Photo, ...Photo[]];

export function photosForCategory(category: PhotoCategory): ReportPhotos {
    const keys = Object.keys(images) as (keyof typeof images)[];
    const variants = keys.filter((key) => key.startsWith(category + '_'));
    return [photoEntry(category), ...variants.map(photoEntry)];
}

export function photoForReport(category: PhotoCategory, protocol?: number) {
    const key = protocol === undefined ? category : (assignments[category][protocol] ?? category);
    return photoEntry(key);
}

export function photosForReport(category: PhotoCategory, protocol: number): ReportPhotos {
    const cover = photoForReport(category, protocol);
    if (category === 'WASTE' && (protocol === 1046 || protocol === 1049)) return [cover, photoEntry(protocol === 1046 ? 'WASTE_2' : 'WASTE')];
    return [cover];
}
