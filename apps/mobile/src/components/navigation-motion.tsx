import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { useMotionEnabled } from './use-motion-enabled';

const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
const timing = { easing: easeOut, useNativeDriver: Platform.OS !== 'web', isInteraction: false };

export function ScreenTransition({ route, depth, children }: { route: string; depth: number; children: ReactNode }) {
    const enabled = useMotionEnabled();
    const prior = useRef({ route, depth });
    const [offset] = useState(() => new Animated.Value(0));
    useLayoutEffect(() => {
        const previous = prior.current;
        prior.current = { route, depth };
        if (!enabled || depth === 0 || previous.route === route || depth === previous.depth) {
            offset.setValue(0);
            return;
        }
        offset.setValue(Math.sign(depth - previous.depth) * 8);
        const slide = Animated.timing(offset, { ...timing, toValue: 0, duration: 120 });
        slide.start();
        return () => slide.stop();
    }, [route, depth, enabled, offset]);
    return <Animated.View style={[styles.surface, enabled && depth > 0 && { transform: [{ translateX: offset }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ surface: { flex: 1, minHeight: 0 } });
