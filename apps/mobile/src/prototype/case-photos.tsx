import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/typography';
import { colors } from '../theme';
import { categories, categoryName, photosForCategory, type Category, type Photo, type ReportPhotos } from './fixtures';
import { Button, s } from './presentation';

const examples = categories.flatMap((category) => photosForCategory(category).map((photo, index) => ({ photo, category, title: categoryName(category) + ', exemplo ' + (index + 1) })));

export function PhotoAttachments({ category, photos, onChange, disabled }: { category: Category | null; photos: Photo[]; onChange: (photos: Photo[]) => void; disabled: boolean }) {
    const [choosing, choose] = useState(false);
    const preferred = category ?? 'POTHOLE';
    const available = examples.filter((option) => !photos.some((p) => p.credit.source === option.photo.credit.source));
    const options = [...available.filter((o) => o.category === preferred), ...available.filter((o) => o.category !== preferred)];
    function append(photo: Photo) {
        if (disabled || photos.length >= 3 || photos.some((p) => p.credit.source === photo.credit.source)) return;
        onChange([...photos, photo]);
        choose(false);
    }
    return (
        <View style={styles.group}>
            <View style={s.topline}>
                <Text style={styles.heading}>Fotos</Text>
                <Text accessibilityLiveRegion="polite" style={s.meta}>
                    {photos.length} de 3 fotos
                </Text>
            </View>
            {!photos.length && <Text style={s.meta}>Inclua de uma a três imagens da ocorrência.</Text>}
            <View style={styles.thumbnails}>
                {photos.map((photo, index) => (
                    <View style={styles.thumb} key={photo.credit.source}>
                        <Image source={photo.image} accessibilityLabel={photos.length === 1 ? 'Foto de exemplo da ocorrência' : 'Prévia da foto ' + (index + 1)} style={styles.preview} resizeMode="contain" />
                        <Text style={styles.caption}>{'Foto ' + (index + 1) + (index === 0 ? ' · Capa' : '')}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={'Remover foto ' + (index + 1)} disabled={disabled} onPress={() => onChange(photos.filter((_, i) => i !== index))} style={({ pressed }) => [styles.remove, pressed && s.pressed]}>
                            <Text style={styles.removeLabel}>Remover</Text>
                        </Pressable>
                    </View>
                ))}
            </View>
            {photos.length < 3 && !choosing && <Button disabled={disabled} link icon="add" label={photos.length ? 'Adicionar outra foto' : 'Adicionar foto de exemplo'} onPress={() => (photos.length ? choose(true) : append(photosForCategory(preferred)[0]))} />}
            {choosing && (
                <View style={styles.group}>
                    <Text style={styles.caption}>Escolha uma foto de exemplo</Text>
                    <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.options}>
                        {options.map(({ photo, title }) => (
                            <Pressable key={photo.credit.source} accessibilityRole="button" accessibilityLabel={'Anexar ' + title} onPress={() => append(photo)} disabled={disabled} style={({ pressed }) => [styles.option, pressed && s.pressed]}>
                                <Image source={photo.image} accessible={false} style={styles.example} />
                                <Text style={styles.caption}>{title}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                    <Button disabled={disabled} link label="Cancelar escolha" onPress={() => choose(false)} />
                </View>
            )}
        </View>
    );
}

export function CasePhotoGallery({ photos }: { photos: ReportPhotos }) {
    const [index, select] = useState(0);
    const current = photos[index] ?? photos[0];
    const many = photos.length > 1;
    return (
        <View style={styles.group}>
            {many && (
                <Text accessibilityLiveRegion="polite" style={styles.heading}>
                    Foto {index + 1} de {photos.length}
                </Text>
            )}
            <Image accessibilityLabel={many ? 'Foto ' + (index + 1) + ' da ocorrência' : 'Foto demonstrativa da ocorrência'} source={current.image} style={styles.picture} resizeMode="contain" />
            {many && (
                <View style={s.topline}>
                    <Button link label="Foto anterior" disabled={index === 0} onPress={() => select((i) => Math.max(0, i - 1))} />
                    <Button link label="Próxima foto" disabled={index === photos.length - 1} onPress={() => select((i) => Math.min(photos.length - 1, i + 1))} />
                </View>
            )}
            <Text style={s.meta}>
                Foto ilustrativa ·{' '}
                <Text accessibilityRole="link" style={s.photoLink} onPress={() => void Linking.openURL(current.credit.source)}>
                    {current.credit.author}
                </Text>{' '}
                ·{' '}
                <Text accessibilityRole="link" style={s.photoLink} onPress={() => void Linking.openURL(current.credit.licenseUrl)}>
                    {current.credit.license}
                </Text>
            </Text>
        </View>
    );
}
const styles = StyleSheet.create({
    group: { gap: 8 },
    heading: { color: colors.ink, fontWeight: '700', fontSize: 17 },
    thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    thumb: { minWidth: 68, flex: 1, maxWidth: 160, gap: 4 },
    preview: { width: '100%', height: 85, borderRadius: 6, backgroundColor: colors.canvas },
    caption: { color: colors.ink, fontSize: 14, fontWeight: '600' },
    remove: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
    removeLabel: { color: colors.danger, fontWeight: '700' },
    options: { gap: 10, paddingBottom: 8 },
    option: { width: 126, borderWidth: 1, borderRadius: 8, borderColor: colors.line, padding: 6, gap: 5 },
    example: { width: '100%', height: 76, borderRadius: 4 },
    picture: { width: '100%', height: 215, backgroundColor: colors.canvas, borderRadius: 8 },
});
