import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, useExclusiveGestures, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { MotionPressable } from './motion-pressable';
import { Text } from './typography';
import type { PhotoSource } from './report-photo';

const maxScale = 4;
const tapScale = 2.5;

export type ViewerPhoto = { id: string; source: PhotoSource };

// One photo at a time, so the gestures run on the JS thread and drive React Native's Animated values.
function ZoomablePhoto({ photo, index, total, zoomed, onZoomedChange, width, height }: { photo: ViewerPhoto; index: number; total: number; zoomed: boolean; onZoomedChange: (zoomed: boolean) => void; width: number; height: number }) {
    const animated = useRef({ scale: new Animated.Value(1), x: new Animated.Value(0), y: new Animated.Value(0) }).current;
    const current = useRef({ scale: 1, x: 0, y: 0, pinchStart: 1, panStart: { x: 0, y: 0 } }).current;
    function apply(scale: number, x: number, y: number, smooth: boolean) {
        Object.assign(current, { scale, x, y });
        if (!smooth) {
            animated.scale.setValue(scale);
            animated.x.setValue(x);
            animated.y.setValue(y);
            return;
        }
        Animated.parallel([Animated.timing(animated.scale, { toValue: scale, duration: 180, useNativeDriver: true }), Animated.timing(animated.x, { toValue: x, duration: 180, useNativeDriver: true }), Animated.timing(animated.y, { toValue: y, duration: 180, useNativeDriver: true })]).start();
    }
    const bounded = (scale: number, x: number, y: number) => {
        const limitX = ((scale - 1) * width) / 2;
        const limitY = ((scale - 1) * height) / 2;
        return [Math.min(limitX, Math.max(-limitX, x)), Math.min(limitY, Math.max(-limitY, y))] as const;
    };

    // The zoom button and double tap set the target; gestures report where they ended.
    useEffect(() => {
        if (zoomed && current.scale <= 1.01) apply(tapScale, 0, 0, true);
        if (!zoomed && current.scale > 1) apply(1, 0, 0, true);
    }, [zoomed]);

    const pinch = usePinchGesture({
        testID: 'photo-viewer-pinch-' + index,
        runOnJS: true,
        onBegin: () => {
            current.pinchStart = current.scale;
        },
        onUpdate: (event) => {
            const scale = Math.min(maxScale, Math.max(1, current.pinchStart * event.scale));
            apply(scale, ...bounded(scale, current.x, current.y), false);
        },
        onDeactivate: () => {
            if (current.scale <= 1.01) apply(1, 0, 0, true);
            onZoomedChange(current.scale > 1.01);
        },
    });
    const pan = usePanGesture({
        testID: 'photo-viewer-pan-' + index,
        runOnJS: true,
        enabled: zoomed,
        onBegin: () => {
            current.panStart = { x: current.x, y: current.y };
        },
        onUpdate: (event) => apply(current.scale, ...bounded(current.scale, current.panStart.x + event.translationX, current.panStart.y + event.translationY), false),
    });
    const doubleTap = useTapGesture({
        testID: 'photo-viewer-double-tap-' + index,
        runOnJS: true,
        numberOfTaps: 2,
        onActivate: () => onZoomedChange(current.scale <= 1.01),
    });
    const gestures = useExclusiveGestures(doubleTap, useSimultaneousGestures(pinch, pan));
    return (
        <GestureDetector gesture={gestures}>
            <Animated.View style={[{ width, height }, styles.page, { transform: [{ translateX: animated.x }, { translateY: animated.y }, { scale: animated.scale }] }]}>
                <Image source={photo.source} cachePolicy="disk" contentFit="contain" style={StyleSheet.absoluteFill} accessibilityLabel={'Foto ' + (index + 1) + ' de ' + total + ' da denúncia, ampliada'} />
            </Animated.View>
        </GestureDetector>
    );
}

export function PhotoViewer({ photos, start, onClose }: { photos: ViewerPhoto[]; start: number; onClose: () => void }) {
    const { width, height } = useWindowDimensions();
    const [index, setIndex] = useState(start);
    const [zoomed, setZoomed] = useState(false);
    return (
        <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <GestureHandlerRootView style={styles.root}>
                <View style={styles.bar}>
                    <Text style={styles.counter} accessibilityLiveRegion="polite">
                        Foto {index + 1} de {photos.length}
                    </Text>
                    <MotionPressable accessibilityRole="button" accessibilityLabel={zoomed ? 'Restaurar zoom' : 'Aproximar'} onPress={() => setZoomed(!zoomed)} style={styles.action}>
                        <Text style={styles.actionText}>{zoomed ? 'Restaurar zoom' : 'Aproximar'}</Text>
                    </MotionPressable>
                    <MotionPressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={styles.action}>
                        <Text style={styles.actionText}>Fechar</Text>
                    </MotionPressable>
                </View>
                <FlatList
                    testID="photo-viewer-pages"
                    data={photos}
                    keyExtractor={(photo) => photo.id}
                    horizontal
                    pagingEnabled
                    scrollEnabled={!zoomed}
                    initialScrollIndex={start}
                    getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(event) => {
                        const next = Math.round(event.nativeEvent.contentOffset.x / width);
                        if (next !== index) {
                            setIndex(next);
                            setZoomed(false);
                        }
                    }}
                    renderItem={({ item, index: i }) => <ZoomablePhoto photo={item} index={i} total={photos.length} zoomed={zoomed && i === index} onZoomedChange={setZoomed} width={width} height={height - 120} />}
                />
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#05121c' },
    bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 },
    counter: { flex: 1, color: 'white', fontSize: 16 },
    action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#ffffff59' },
    actionText: { color: 'white', fontSize: 15, fontWeight: '700' },
    page: { overflow: 'hidden' },
});
