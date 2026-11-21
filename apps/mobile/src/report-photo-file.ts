import { File } from 'expo-file-system';

export function preparedPhotoUri(uri: string) {
    const file = new File(uri);
    if (!file.exists || file.size <= 0 || file.size > 5 * 1024 * 1024) {
        if (file.exists) file.delete();
        throw new Error('Escolha outra foto. O JPEG preparado precisa ter até 5 MiB.');
    }
    return uri;
}

export function appendReportPhotos(form: FormData, uris: string[]) {
    for (const uri of uris) form.append('photos', new File(uri));
}
