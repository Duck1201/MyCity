import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { useMotionEnabled } from './use-motion-enabled';

const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
const timing = { easing: easeOut, useNativeDriver: Platform.OS !== 'web', isInteraction: false };

export function ScreenTransition({ route, depth, children, fadeContent = true }: { route: string; depth: number; fadeContent?: boolean; children: ReactNode }) {
    const enabled = useMotionEnabled();
    const prior = useRef({ route, depth });
    const [offset] = useState(() => new Animated.Value(0));
    const [opacity] = useState(() => new Animated.Value(1));
    useLayoutEffect(() => {
        const previous = prior.current;
        prior.current = { route, depth };
        if (!enabled || previous.route === route) {
            offset.setValue(0);
            opacity.setValue(1);
            return;
        }
        const distance = Math.sign(depth - previous.depth) * 20;
        offset.setValue(distance);
        opacity.setValue(fadeContent ? (distance ? 0.86 : 0.92) : 1);
        const fade = fadeContent ? Animated.timing(opacity, { ...timing, toValue: 1, duration: distance ? 170 : 120 }) : undefined;
        const slide = distance ? Animated.timing(offset, { ...timing, toValue: 0, duration: 190 }) : undefined;
        fade?.start();
        slide?.start();
        return () => {
            fade?.stop();
            slide?.stop();
        };
    }, [route, depth, enabled, fadeContent, offset, opacity]);
    return <Animated.View style={[styles.surface, enabled && { opacity, transform: [{ translateX: offset }] }]}>{children}</Animated.View>;
}

export function TabIndicator({ index, count, top = false, inset = 0 }: { index: number; count: number; top?: boolean; inset?: number }) {
    const enabled = useMotionEnabled();
    const [width, setWidth] = useState(0);
    const [position] = useState(() => new Animated.Value(0));
    const prior = useRef({ width, index });
    const tabWidth = width / count;
    useLayoutEffect(() => {
        const previous = prior.current;
        prior.current = { width, index };
        const target = tabWidth * Math.max(index, 0);
        if (!enabled || width !== previous.width || previous.index < 0 || index < 0 || previous.index === index) {
            position.setValue(target);
            return;
        }
        const movement = Animated.timing(position, { ...timing, toValue: target, duration: 170 });
        movement.start();
        return () => movement.stop();
    }, [width, index, tabWidth, position, enabled]);
    return (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.track, { left: inset, right: inset }, top ? styles.top : styles.bottom]}>
            {index >= 0 && width > 0 && <Animated.View style={[styles.indicator, { width: tabWidth, transform: [{ translateX: position }] }]} />}
        </View>
    );
}

const styles = StyleSheet.create({ surface: { flex: 1, minHeight: 0 }, track: { position: 'absolute', height: 3 }, top: { top: 0 }, bottom: { bottom: 0 }, indicator: { height: 3, backgroundColor: colors.teal, borderRadius: 2 } });
