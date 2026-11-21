import { useCallback, useLayoutEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export function useListPresentation(dataPending: boolean, resources: { row: string; key: string }[], offset: number) {
    const [presented, setPresented] = useState(false);
    const [height, setHeight] = useState(0);
    const [frames, setFrames] = useState<ReadonlyMap<string, { top: number; bottom: number }>>(() => new Map());
    const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set());
    const onItemLayout = useCallback((key: string, { nativeEvent: { layout } }: LayoutChangeEvent) => {
        if (!layout.height) return;
        setFrames((previous) => {
            const prior = previous.get(key);
            const bottom = layout.y + layout.height;
            return prior?.top === layout.y && prior.bottom === bottom ? previous : new Map(previous).set(key, { top: layout.y, bottom });
        });
    }, []);
    const onSettled = useCallback((key: string) => {
        setSettled((previous) => (previous.has(key) ? previous : new Set(previous).add(key)));
    }, []);
    const waiting =
        !presented &&
        (dataPending ||
            resources.some(({ row, key }) => {
                if (settled.has(key)) return false;
                const frame = frames.get(row);
                return !height || !frame || (frame.bottom > offset && frame.top < offset + height);
            }));
    useLayoutEffect(() => {
        if (!waiting && !presented) setPresented(true);
    }, [waiting, presented]);
    return { waiting, onItemLayout, onSettled, setHeight };
}
