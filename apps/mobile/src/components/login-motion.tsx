import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Platform, View } from 'react-native';
import { colors } from '../theme';

const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export function useLoginFade(visible: boolean, animate: boolean, duration: number, baseline = 0) {
    const target = visible ? 1 : baseline;
    const [opacity] = useState(() => new Animated.Value(target));
    useEffect(() => {
        if (!animate) {
            opacity.setValue(target);
            return;
        }
        const fade = Animated.timing(opacity, { toValue: target, duration, easing: easeOut, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
        fade.start();
        return () => fade.stop();
    }, [animate, duration, opacity, target]);
    return animate ? opacity : target;
}

type FocusEvents = { onFocus: () => void; onBlur: () => void };
export function LoginInputFrame({ children, animate }: { children: (events: FocusEvents) => ReactNode; animate: boolean }) {
    const [focused, setFocused] = useState(false);
    const opacity = useLoginFade(focused, animate, 120);
    return (
        <View style={styles.frame}>
            {children({ onFocus: () => setFocused(true), onBlur: () => setFocused(false) })}
            <Animated.View importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.focus, { opacity }]} />
        </View>
    );
}
const styles = StyleSheet.create({
    frame: { marginBottom: 8 },
    focus: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 8, borderWidth: 1, borderColor: colors.teal },
});
