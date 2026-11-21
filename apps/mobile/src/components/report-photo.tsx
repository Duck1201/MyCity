import { fromByteArray } from 'base64-js';
import { useEffect, useRef, useState } from 'react';
import { Image, type ImageProps } from 'expo-image';
import { PrivateImage } from './private-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, mobileStyles } from '../theme';
import { MotionPressable } from './motion-pressable';
import { Text } from './typography';

export type PhotoSource = { uri: string; headers?: Record<string, string> };

// Lists use the 320 px thumbnail; a server without thumbnails still sends contentPath.
export const listPhotoPath = (photo: { contentPath: string; thumbnailPath?: string }) => photo.thumbnailPath ?? photo.contentPath;

// Photos never change content for the same URL, so expo-image keeps them on disk.
// They are private, so both caches are dropped when the session ends.
export function clearCachedPhotos() {
    void Image.clearDiskCache().catch(() => false);
    void Image.clearMemoryCache().catch(() => false);
}

export function reportPhotoSource(path: string, apiBase: string, token: string): PhotoSource | undefined {
    const origin = new URL(apiBase).origin;
    if (path.startsWith('//') || path.includes('\\')) return undefined;
    const url = path.startsWith('/') ? new URL(origin + path) : new URL(path, apiBase);
    if (url.origin !== origin) return undefined;
    return { uri: url.href, headers: { Authorization: 'Bearer ' + token } };
}

const maxPhotoBytes = 5 * 1024 * 1024;

function ReportImage({ source, onUnavailable, ...props }: Omit<ImageProps, 'source' | 'onError' | 'cachePolicy'> & { source: PhotoSource; onUnavailable: () => void }) {
    const [memoryUri, setMemoryUri] = useState('');
    const download = useRef<AbortController | null>(null);
    useEffect(() => () => download.current?.abort(), []);

    async function recover() {
        if (memoryUri || !source.uri || !source.headers?.Authorization) return onUnavailable();
        if (download.current) return;
        const controller = new AbortController();
        download.current = controller;
        try {
            const response = await fetch(source.uri, { headers: source.headers, redirect: 'error', signal: controller.signal });
            const length = Number(response.headers.get('content-length'));
            if (!response.ok || response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'image/jpeg' || length <= 0 || !Number.isSafeInteger(length) || length > maxPhotoBytes) throw new Error('Foto indisponível');
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length !== length) throw new Error('Foto incompleta');
            if (!controller.signal.aborted) setMemoryUri('data:image/jpeg;base64,' + fromByteArray(bytes));
        } catch {
            if (!controller.signal.aborted) onUnavailable();
        }
    }

    return <PrivateImage {...props} cachePolicy="disk" source={memoryUri ? { uri: memoryUri } : source} onError={() => void recover()} />;
}

export function ReportThumbnail({ source, label, fillFrame = false, onSettled }: { source: PhotoSource; label?: string; fillFrame?: boolean; onSettled?: (() => void) | undefined }) {
    const resource = source.uri;
    const [failedResource, setFailedResource] = useState<typeof resource | null>(null);
    if (resource === failedResource) return null;
    return (
        <ReportImage
            key={resource}
            source={source}
            accessible={!!label}
            {...(label && { accessibilityLabel: label })}
            contentFit="cover"
            {...(onSettled && { onLoad: onSettled })}
            onUnavailable={() => {
                setFailedResource(resource);
                onSettled?.();
            }}
            style={fillFrame ? StyleSheet.absoluteFill : styles.thumb}
        />
    );
}

export function ReportPhoto({ path, index, apiBase, token, width, height, onExpand }: { path: string; index: number; apiBase: string; token: string; width: number; height: number; onExpand?: () => void }) {
    const source = reportPhotoSource(path, apiBase, token);
    const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
    const label = 'Foto ' + (index + 1) + ' da denúncia';
    if (!source || state === 'failed') {
        return (
            <View style={styles.feedback}>
                <Text style={mobileStyles.meta} accessibilityLiveRegion="polite">
                    {label} indisponível.
                </Text>
                {source && (
                    <MotionPressable accessibilityRole="button" accessibilityLabel={'Tentar carregar a foto ' + (index + 1) + ' novamente'} style={styles.retry} onPress={() => setState('loading')}>
                        <Text style={styles.retryText}>Tentar novamente</Text>
                    </MotionPressable>
                )}
            </View>
        );
    }
    const aspectRatio = width > 0 && height > 0 ? Math.max(1, Math.min(2.5, width / height)) : 1.5;
    return (
        <MotionPressable accessibilityRole="button" accessibilityLabel={'Ampliar foto ' + (index + 1) + ' da denúncia'} disabled={!onExpand} onPress={onExpand} style={[styles.frame, { aspectRatio }]}>
            <ReportImage key={source.uri} accessibilityLabel={label} source={source} contentFit="contain" style={StyleSheet.absoluteFill} onUnavailable={() => setState('failed')} onLoad={() => setState('loaded')} />
            {state === 'loading' && <ActivityIndicator color={colors.teal} accessibilityLabel={'Carregando foto ' + (index + 1)} />}
        </MotionPressable>
    );
}

const styles = StyleSheet.create({
    thumb: { width: 68, height: 72, flexShrink: 0, borderRadius: 9, backgroundColor: colors.pale },
    frame: { width: '100%', minHeight: 64, maxHeight: 184, backgroundColor: colors.canvas, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    feedback: { paddingHorizontal: 12, gap: 4, borderRadius: 8, backgroundColor: colors.canvas, alignItems: 'flex-start', paddingTop: 8 },
    retry: { minHeight: 48, justifyContent: 'center' },
    retryText: { color: colors.teal, fontSize: 15, fontWeight: '700' },
});
