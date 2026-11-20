import { pickReportPhoto } from '../src/report-photos';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

jest.mock('expo-file-system', () => ({
    File: jest.fn().mockImplementation((uri: string) => ({
        exists: true,
        size: 1024,
        delete: jest.fn(),
        uri,
    })),
}));
jest.mock('expo-image-picker', () => ({
    requestCameraPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
    ImageManipulator: { manipulate: jest.fn() },
    SaveFormat: { JPEG: 'jpeg' },
}));

const mockResize = jest.fn();
const mockRenderRelease = jest.fn();
const mockContextRelease = jest.fn();
const mockSave = jest.fn();
const mockManipulate = jest.mocked(ImageManipulator.manipulate);
const mockCameraPermission = jest.mocked(ImagePicker.requestCameraPermissionsAsync);
const mockCamera = jest.mocked(ImagePicker.launchCameraAsync);
const mockGallery = jest.mocked(ImagePicker.launchImageLibraryAsync);
let fileState: { exists: boolean; size: number; delete: jest.Mock };

function configureImage(width: number, height: number, uri = 'file:///source.jpg') {
    const rendered = { saveAsync: mockSave, release: mockRenderRelease };
    const context = { resize: mockResize, renderAsync: jest.fn(async () => rendered), release: mockContextRelease };
    mockManipulate.mockReturnValue(context as never);
    mockSave.mockResolvedValue({ uri: 'file:///prepared.jpg' });
    fileState = { exists: true, size: 1024, delete: jest.fn() };
    jest.mocked(File).mockImplementation(() => fileState as never);
    mockGallery.mockResolvedValue({ canceled: false, assets: [{ uri, width, height }] } as never);
    mockCamera.mockResolvedValue({ canceled: false, assets: [{ uri, width, height }] } as never);
    return context;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockCameraPermission.mockResolvedValue({ granted: true } as never);
});

it.each([
    ['paisagem', 3200, 1800, { width: 1600 }],
    ['retrato', 1800, 3200, { height: 1600 }],
])('redimensiona foto em %s sem perder proporção, e salva em JPEG', async (_name, width, height, resize) => {
    configureImage(width as number, height as number);
    await expect(pickReportPhoto('gallery')).resolves.toBe('file:///prepared.jpg');
    expect(mockGallery).toHaveBeenCalledWith({ mediaTypes: ['images'], quality: 1 });
    expect(mockManipulate).toHaveBeenCalledWith('file:///source.jpg');
    expect(mockResize).toHaveBeenCalledWith(resize);
    expect(mockSave).toHaveBeenCalledWith({ format: SaveFormat.JPEG, compress: 0.8 });
    expect(mockRenderRelease).toHaveBeenCalledTimes(1);
    expect(mockContextRelease).toHaveBeenCalledTimes(1);
});

it.each([
    ['paisagem', 1200, 800],
    ['retrato', 800, 1200],
])('não amplia imagem menor em %s', async (_name, width, height) => {
    configureImage(width as number, height as number);
    await expect(pickReportPhoto('gallery')).resolves.toBe('file:///prepared.jpg');
    expect(mockResize).not.toHaveBeenCalled();
});

it('pede permissão de câmera antes de abrir e não abre quando negada', async () => {
    configureImage(800, 600);
    mockCameraPermission.mockResolvedValue({ granted: false } as never);
    await expect(pickReportPhoto('camera')).rejects.toThrow('Permita o acesso à câmera');
    expect(mockCamera).not.toHaveBeenCalled();
    expect(mockManipulate).not.toHaveBeenCalled();
});

it('apaga o arquivo JPEG que excede 5 MiB e libera os recursos nativos', async () => {
    configureImage(800, 600);
    fileState.size = 5 * 1024 * 1024 + 1;
    await expect(pickReportPhoto('gallery')).rejects.toThrow('até 5 MiB');
    expect(fileState.delete).toHaveBeenCalledTimes(1);
    expect(mockRenderRelease).toHaveBeenCalledTimes(1);
    expect(mockContextRelease).toHaveBeenCalledTimes(1);
});

it('apaga saída vazia e libera contexto e imagem renderizada', async () => {
    configureImage(800, 600);
    fileState.size = 0;
    await expect(pickReportPhoto('gallery')).rejects.toThrow('até 5 MiB');
    expect(fileState.delete).toHaveBeenCalledTimes(1);
    expect(mockRenderRelease).toHaveBeenCalledTimes(1);
    expect(mockContextRelease).toHaveBeenCalledTimes(1);
});
