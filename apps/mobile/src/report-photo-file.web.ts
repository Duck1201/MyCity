import { fromByteArray } from 'base64-js';

export async function preparedPhotoUri(uri: string) {
    try {
        const response = await fetch(uri);
        const file = await response.blob();
        if (!response.ok || file.type !== 'image/jpeg' || !file.size || file.size > 5 * 1024 * 1024) throw new Error('Escolha outra foto. O JPEG preparado precisa ter até 5 MiB.');
        // The draft owns the bytes. Removing a photo or dropping the draft
        // releases them without keeping a blob URL alive for the tab's lifetime.
        return 'data:image/jpeg;base64,' + fromByteArray(new Uint8Array(await file.arrayBuffer()));
    } finally {
        URL.revokeObjectURL(uri);
    }
}

export async function appendReportPhotos(form: FormData, uris: string[]) {
    for (const uri of uris) {
        if (!uri.startsWith('data:image/jpeg;base64,')) throw new Error('Escolha novamente a foto.');
        const photo = await (await fetch(uri)).blob();
        form.append('photos', photo, 'foto.jpg');
    }
}
