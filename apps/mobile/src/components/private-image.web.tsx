import { useEffect, useRef, useState } from 'react';
import { Image, type ImageProps } from 'expo-image';
import type { PhotoSource } from './report-photo';

export function PrivateImage({ source, onError, ...props }: Omit<ImageProps, 'source'> & { source: PhotoSource }) {
    const { uri, headers } = source;
    const authorization = headers?.Authorization;
    const [loaded, setLoaded] = useState<{ uri: string; authorization: string; url: string }>();
    const errorHandler = useRef(onError);
    errorHandler.current = onError;
    useEffect(() => {
        if (!authorization) return;
        const controller = new AbortController();
        let url: string | undefined;
        async function download() {
            const response = await fetch(uri, { headers: { Authorization: authorization! }, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal });
            if (!response.ok) throw new Error();
            const image = await response.blob();
            if (image.type !== 'image/jpeg' || !image.size || image.size > 5 * 1024 * 1024) throw new Error();
            if (controller.signal.aborted) return;
            url = URL.createObjectURL(image);
            setLoaded({ uri, authorization: authorization!, url });
        }
        void download().catch(() => {
            if (!controller.signal.aborted) errorHandler.current?.({ error: 'Foto indisponível' });
        });
        return () => {
            controller.abort();
            if (url) URL.revokeObjectURL(url);
        };
    }, [uri, authorization]);
    const displayed = authorization ? (loaded?.uri === uri && loaded.authorization === authorization ? loaded.url : undefined) : uri;
    return <Image {...props} {...(onError && { onError })} source={displayed ? { uri: displayed } : null} />;
}
