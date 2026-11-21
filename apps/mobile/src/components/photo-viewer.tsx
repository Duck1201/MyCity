import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, useCompetingGestures, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { MotionPressable } from './motion-pressable';
import { Text } from './typography';
import type { PhotoSource } from './report-photo';

const maxScale = 6;
const tapScale = 2.5;
const zoomedAt = 1.01;
// Springs settle the photo after a gesture; while fingers are down it follows them 1:1. They run on
// the JS side so every frame updates the position the next gesture starts from.
const spring = { useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9 } as const;

export type ViewerPhoto = { id: string; source: PhotoSource };
type Zoom = { scale: Animated.Value; x: Animated.Value; y: Animated.Value };

// A report has at most three photos, so they sit side by side on one strip that the same
// gestures drive: one finger swipes between photos, or moves a zoomed photo; two fingers pinch
// around the point between them; a double tap zooms in on the tapped point or restores.
export function PhotoViewer({ photos, start, onClose }: { photos: ViewerPhoto[]; start: number; onClose: () => void }) {
    const window = useWindowDimensions();
    const width = window.width;
    const height = window.height - 120;
    const [index, setIndex] = useState(start);
    const [zoomed, setZoomed] = useState(false);
    const strip = useRef(new Animated.Value(-start * width)).current;
    const zooms = useRef<Zoom[]>(photos.map(() => ({ scale: new Animated.Value(1), x: new Animated.Value(0), y: new Animated.Value(0) }))).current;
    // Plain numbers mirror the animated values, because the gesture maths runs on the JS thread.
    const state = useRef({ index: start, scale: 1, target: 1, x: 0, y: 0, stripX: -start * width, pinchStart: 1, anchor: { x: 0, y: 0 }, panStart: { x: 0, y: 0, strip: 0 }, pinching: false }).current;
    // Mirror what is on screen, including the frames of a spring, into the numbers the gestures read.
    useEffect(() => {
        const ids = zooms.flatMap(
            (zoom, i) =>
                [
                    [zoom.scale, zoom.scale.addListener(({ value }) => i === state.index && (state.scale = value))],
                    [zoom.x, zoom.x.addListener(({ value }) => i === state.index && (state.x = value))],
                    [zoom.y, zoom.y.addListener(({ value }) => i === state.index && (state.y = value))],
                ] as const,
        );
        const stripId = strip.addListener(({ value }) => (state.stripX = value));
        return () => {
            ids.forEach(([value, id]) => value.removeListener(id));
            strip.removeListener(stripId);
        };
    }, [zooms, strip, state]);
    // A new gesture takes over from wherever a spring has got to.
    function halt() {
        const zoom = zooms[state.index]!;
        [zoom.scale, zoom.x, zoom.y, strip].forEach((value) => value.stopAnimation());
    }

    const bounds = (scale: number) => ({ x: ((scale - 1) * width) / 2, y: ((scale - 1) * height) / 2 });
    const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));
    // target is where the photo is heading: it decides between zoomed and not zoomed; scale, x and y are what is on screen.
    function show(scale: number, x: number, y: number, settle: boolean) {
        const zoom = zooms[state.index]!;
        state.target = scale;
        if (!settle) {
            Object.assign(state, { scale, x, y });
            zoom.scale.setValue(scale);
            zoom.x.setValue(x);
            zoom.y.setValue(y);
            return;
        }
        Animated.parallel([Animated.spring(zoom.scale, { ...spring, toValue: scale }), Animated.spring(zoom.x, { ...spring, toValue: x }), Animated.spring(zoom.y, { ...spring, toValue: y })]).start();
    }
    // Bring a released photo back inside its bounds (or back to 1x) with a spring.
    function settle() {
        const scale = state.scale <= zoomedAt ? 1 : Math.min(maxScale, state.scale);
        const limit = bounds(scale);
        show(scale, clamp(state.x, limit.x), clamp(state.y, limit.y), true);
        setZoomed(scale > zoomedAt);
    }
    function toggleZoom(focusX = width / 2, focusY = height / 2) {
        if (state.target > zoomedAt) {
            show(1, 0, 0, true);
            setZoomed(false);
            return;
        }
        // Keep the tapped point where it is while zooming in.
        const fx = focusX - width / 2;
        const fy = focusY - height / 2;
        const limit = bounds(tapScale);
        show(tapScale, clamp(fx - tapScale * fx, limit.x), clamp(fy - tapScale * fy, limit.y), true);
        setZoomed(true);
    }
    function goTo(next: number) {
        const target = Math.min(photos.length - 1, Math.max(0, next));
        if (target !== state.index) {
            show(1, 0, 0, false);
            state.index = target;
            Object.assign(state, { scale: 1, target: 1, x: 0, y: 0 });
            setIndex(target);
            setZoomed(false);
        }
        Animated.spring(strip, { ...spring, toValue: -target * width }).start();
    }

    const pinch = usePinchGesture({
        testID: 'photo-viewer-pinch',
        runOnJS: true,
        onActivate: (event) => {
            halt();
            state.pinching = true;
            state.pinchStart = state.scale;
            const fx = event.focalX - width / 2;
            const fy = event.focalY - height / 2;
            state.anchor = { x: (fx - state.x) / state.scale, y: (fy - state.y) / state.scale };
        },
        onUpdate: (event) => {
            // Any level the fingers choose; past the limits it resists instead of stopping dead.
            const wanted = state.pinchStart * event.scale;
            const scale = wanted > maxScale ? maxScale + (wanted - maxScale) * 0.2 : wanted < 1 ? 1 - (1 - wanted) * 0.4 : wanted;
            show(scale, event.focalX - width / 2 - scale * state.anchor.x, event.focalY - height / 2 - scale * state.anchor.y, false);
        },
        onDeactivate: () => {
            state.pinching = false;
            settle();
        },
    });
    const pan = usePanGesture({
        testID: 'photo-viewer-pan',
        runOnJS: true,
        maxPointers: 1,
        onActivate: () => {
            halt();
            state.panStart = { x: state.x, y: state.y, strip: state.stripX };
        },
        onUpdate: (event) => {
            if (state.pinching) return;
            if (state.target > zoomedAt) {
                show(state.scale, state.panStart.x + event.translationX, state.panStart.y + event.translationY, false);
                return;
            }
            // Not zoomed: the strip follows the finger, with resistance past the first and last photo.
            const edge = (state.index === 0 && event.translationX > 0) || (state.index === photos.length - 1 && event.translationX < 0);
            strip.setValue(state.panStart.strip + event.translationX * (edge ? 0.3 : 1));
        },
        onDeactivate: (event) => {
            if (state.pinching) return;
            if (state.target > zoomedAt) return settle();
            const swipe = Math.abs(event.translationX) > width * 0.2 || Math.abs(event.velocityX) > 600;
            goTo(swipe ? state.index + (event.translationX < 0 ? 1 : -1) : state.index);
        },
    });
    const doubleTap = useTapGesture({
        testID: 'photo-viewer-double-tap',
        runOnJS: true,
        numberOfTaps: 2,
        onActivate: (event) => {
            halt();
            toggleZoom(event.x, event.y);
        },
    });
    // The double tap competes with the drag gestures instead of making the pinch wait for it.
    const gestures = useCompetingGestures(doubleTap, useSimultaneousGestures(pinch, pan));

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
                <GestureDetector gesture={gestures}>
                    <View testID="photo-viewer-stage" style={[styles.stage, { width, height }]}>
                        <Animated.View testID="photo-viewer-strip" style={[styles.strip, { width: width * photos.length, transform: [{ translateX: strip }] }]}>
                            {photos.map((photo, i) => (
                                <View key={photo.id} style={[styles.page, { width, height }]}>
                                    <Animated.View testID={'photo-viewer-zoom-' + i} style={[StyleSheet.absoluteFill, { transform: [{ translateX: zooms[i]!.x }, { translateY: zooms[i]!.y }, { scale: zooms[i]!.scale }] }]}>
                                        <Image
                                            source={photo.source}
                                            cachePolicy="disk"
                                            contentFit="contain"
                                            style={StyleSheet.absoluteFill}
                                            accessibilityLabel={'Foto ' + (i + 1) + ' de ' + photos.length + ' da denúncia, ampliada'}
                                            // Zoom is a pinch; screen readers get the same toggle as an action instead of a visible button.
                                            accessibilityActions={[{ name: 'activate', label: zoomed && i === index ? 'Restaurar zoom' : 'Aproximar' }]}
                                            onAccessibilityAction={() => toggleZoom()}
                                        />
                                    </Animated.View>
                                </View>
                            ))}
                        </Animated.View>
                    </View>
                </GestureDetector>
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
    stage: { overflow: 'hidden' },
    strip: { flexDirection: 'row', height: '100%' },
    page: { overflow: 'hidden' },
});
