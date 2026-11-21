import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FlatList, GestureDetector, GestureHandlerRootView, useExclusiveGestures, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { MotionPressable } from './motion-pressable';
import { Text } from './typography';
import type { PhotoSource } from './report-photo';

const maxScale = 6;
const tapScale = 2.5;

export type ViewerPhoto = { id: string; source: PhotoSource };

// One photo at a time, so the gestures run on the JS thread and drive React Native's Animated values.
// The stage does not move, so gesture coordinates stay in its frame; only the inner layer is transformed.
function ZoomablePhoto({ photo, index, total, zoomed, onZoomedChange, width, height }: { photo: ViewerPhoto; index: number; total: number; zoomed: boolean; onZoomedChange: (zoomed: boolean) => void; width: number; height: number }) {
    const animated = useRef({ scale: new Animated.Value(1), x: new Animated.Value(0), y: new Animated.Value(0) }).current;
    // anchor: the photo point (relative to its centre, unscaled) that sits under the fingers.
    const current = useRef({ scale: 1, x: 0, y: 0, pinchStart: 1, anchor: { x: 0, y: 0 }, panStart: { x: 0, y: 0 } }).current;
    const bounded = (scale: number, x: number, y: number) => {
        const limitX = ((scale - 1) * width) / 2;
        const limitY = ((scale - 1) * height) / 2;
        return [Math.min(limitX, Math.max(-limitX, x)), Math.min(limitY, Math.max(-limitY, y))] as const;
    };
    function apply(scale: number, x: number, y: number, smooth: boolean) {
        const [boundX, boundY] = bounded(scale, x, y);
        Object.assign(current, { scale, x: boundX, y: boundY });
        if (!smooth) {
            animated.scale.setValue(scale);
            animated.x.setValue(boundX);
            animated.y.setValue(boundY);
            return;
        }
        Animated.parallel([Animated.timing(animated.scale, { toValue: scale, duration: 200, useNativeDriver: true }), Animated.timing(animated.x, { toValue: boundX, duration: 200, useNativeDriver: true }), Animated.timing(animated.y, { toValue: boundY, duration: 200, useNativeDriver: true })]).start();
    }
    // Keep the photo point under (focusX, focusY) in place while the scale becomes `scale`.
    const zoomAround = (focusX: number, focusY: number, scale: number, smooth: boolean) => {
        const fx = focusX - width / 2;
        const fy = focusY - height / 2;
        const anchorX = (fx - current.x) / current.scale;
        const anchorY = (fy - current.y) / current.scale;
        apply(scale, fx - scale * anchorX, fy - scale * anchorY, smooth);
    };

    // The screen reader action toggles the zoom from outside the gestures.
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
        onActivate: (event) => {
            current.pinchStart = current.scale;
            const fx = event.focalX - width / 2;
            const fy = event.focalY - height / 2;
            current.anchor = { x: (fx - current.x) / current.scale, y: (fy - current.y) / current.scale };
        },
        onUpdate: (event) => {
            const scale = Math.min(maxScale, Math.max(1, current.pinchStart * event.scale));
            // Moving both fingers also moves the photo, because the anchor follows the current focal point.
            apply(scale, event.focalX - width / 2 - scale * current.anchor.x, event.focalY - height / 2 - scale * current.anchor.y, false);
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
        onUpdate: (event) => apply(current.scale, current.panStart.x + event.translationX, current.panStart.y + event.translationY, false),
    });
    const doubleTap = useTapGesture({
        testID: 'photo-viewer-double-tap-' + index,
        runOnJS: true,
        numberOfTaps: 2,
        onActivate: (event) => {
            if (current.scale > 1.01) {
                apply(1, 0, 0, true);
                onZoomedChange(false);
                return;
            }
            zoomAround(event.x ?? width / 2, event.y ?? height / 2, tapScale, true);
            onZoomedChange(true);
        },
    });
    const gestures = useExclusiveGestures(doubleTap, useSimultaneousGestures(pinch, pan));
    return (
        <GestureDetector gesture={gestures}>
            <View testID={'photo-viewer-stage-' + index} style={[{ width, height }, styles.page]}>
                <Animated.View testID={'photo-viewer-zoom-' + index} style={[StyleSheet.absoluteFill, { transform: [{ translateX: animated.x }, { translateY: animated.y }, { scale: animated.scale }] }]}>
                    <Image
                        source={photo.source}
                        cachePolicy="disk"
                        contentFit="contain"
                        style={StyleSheet.absoluteFill}
                        accessibilityLabel={'Foto ' + (index + 1) + ' de ' + total + ' da denúncia, ampliada'}
                        // Zoom is a pinch; screen readers get the same toggle as an action instead of a visible button.
                        accessibilityActions={[{ name: 'activate', label: zoomed ? 'Restaurar zoom' : 'Aproximar' }]}
                        onAccessibilityAction={() => onZoomedChange(!zoomed)}
                    />
                </Animated.View>
            </View>
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
