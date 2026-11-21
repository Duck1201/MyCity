import { Platform } from 'react-native';
import { preparedPhotoUri } from './report-photo-file';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export async function pickReportPhoto(source: 'camera' | 'gallery') {
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        throw new Error('Permita o acesso à câmera ou escolha uma foto da galeria.');
    }
    const pick = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await pick({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) throw new Error('Escolha uma imagem com dimensões válidas.');
    try {
        return await prepareAsset(asset);
    } finally {
        if (Platform.OS === 'web' && asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri);
    }
}

async function prepareAsset(asset: ImagePicker.ImagePickerAsset) {
    if (asset.width <= 0 || asset.height <= 0) throw new Error('Escolha uma imagem com dimensões válidas.');
    const context = ImageManipulator.manipulate(asset.uri);
    try {
        if (Math.max(asset.width, asset.height) > 1600) context.resize(asset.width > asset.height ? { width: 1600 } : { height: 1600 });
        const rendered = await context.renderAsync();
        try {
            const output = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
            return await preparedPhotoUri(output.uri);
        } finally {
            rendered.release();
        }
    } finally {
        context.release();
    }
}
