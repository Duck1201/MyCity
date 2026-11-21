import { render, waitFor } from '@testing-library/react-native';
import { PrivateImage } from '../src/components/private-image.web';
import { appendReportPhotos, preparedPhotoUri } from '../src/report-photo-file.web';

const temporaryUri = 'blob:http://localhost/prepared';
afterEach(() => jest.restoreAllMocks());

it('mantém a prévia JPEG na memória e envia bytes JPEG no multipart do navegador', async () => {
    const bytes = Uint8Array.from([255, 216, 255, 217]);
    const response = () => new Response(bytes, { headers: { 'Content-Type': 'image/jpeg' } });
    const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
    const revoke = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const uri = await preparedPhotoUri(temporaryUri);
    expect(uri).toBe('data:image/jpeg;base64,/9j/2Q==');
    expect(revoke).toHaveBeenCalledWith(temporaryUri);
    const form = new FormData();
    await appendReportPhotos(form, [uri, uri]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([temporaryUri, uri, uri]);
    const photos = form.getAll('photos') as File[];
    expect(photos.map((p) => [p.name, p.type, p.size])).toEqual([
        ['foto.jpg', 'image/jpeg', 4],
        ['foto.jpg', 'image/jpeg', 4],
    ]);
    expect(new Uint8Array(await photos[0]!.arrayBuffer())).toEqual(bytes);
});

it.each([0, 5 * 1024 * 1024 + 1])('rejeita JPEG preparado de %i bytes e libera a URL temporária', async (size) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array(size), { headers: { 'Content-Type': 'image/jpeg' } }));
    const revoke = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await expect(preparedPhotoUri(temporaryUri)).rejects.toThrow('5 MiB');
    expect(revoke).toHaveBeenCalledWith(temporaryUri);
});

it('libera a URL privada da foto autenticada ao fechar a tela', async () => {
    const download = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(Uint8Array.from([255, 216, 255, 217]), { headers: { 'Content-Type': 'image/jpeg' } }));
    const create = jest.spyOn(URL, 'createObjectURL').mockReturnValue(temporaryUri);
    const release = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const view = await render(<PrivateImage source={{ uri: 'http://localhost/api/v1/foto', headers: { Authorization: 'Bearer ficticio' } }} />);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(download).toHaveBeenCalledWith('http://localhost/api/v1/foto', expect.objectContaining({ cache: 'no-store', redirect: 'error', headers: { Authorization: 'Bearer ficticio' } }));
    await view.unmount();
    expect(release).toHaveBeenCalledWith(temporaryUri);
});
