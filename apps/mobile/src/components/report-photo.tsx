import { Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

export function reportPhotoSource(path: string, apiBase: string, token: string) {
    const url = new URL(path, apiBase);
    if (url.origin !== new URL(apiBase).origin) return undefined;
    return { uri: url.href, headers: { Authorization: 'Bearer ' + token } };
}

export function ReportPhoto({ path, label, apiBase, token }: { path: string; label: string; apiBase: string; token: string }) {
    const source = reportPhotoSource(path, apiBase, token);
    return source ? <Image accessibilityLabel={label} source={source} resizeMode="contain" style={styles.image} /> : null;
}

const styles = StyleSheet.create({
    image: { width: '100%', height: 196, borderRadius: 8, backgroundColor: colors.canvas },
});
