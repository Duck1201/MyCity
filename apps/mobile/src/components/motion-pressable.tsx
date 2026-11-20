import { useEffect, useState, type ComponentProps } from 'react';
import { Animated, Easing, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useMotionEnabled } from './use-motion-enabled';

function PressSurface({ style, pressStyle, ...props }: Omit<ComponentProps<typeof Pressable>, 'style'> & { style?: StyleProp<ViewStyle>; pressStyle?: PressableProps['style'] }) {
    return <Pressable {...props} style={(state) => [typeof pressStyle === 'function' ? pressStyle(state) : pressStyle, style]} />;
}
const AnimatedPressable = Animated.createAnimatedComponent(PressSurface);
const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

export function MotionPressable({ style, onPressIn, onPressOut, disabled, ...props }: PressableProps) {
    const motion = useMotionEnabled();
    const [scale] = useState(() => new Animated.Value(1));
    useEffect(() => {
        if (!motion || disabled) scale.setValue(1);
        return () => scale.stopAnimation();
    }, [motion, disabled, scale]);

    function feedback(down: boolean) {
        if (motion && !disabled) {
            Animated.timing(scale, { toValue: down ? 0.97 : 1, duration: down ? 100 : 140, easing: easeOut, useNativeDriver: Platform.OS !== 'web', isInteraction: false }).start();
        }
    }

    return (
        <AnimatedPressable
            {...props}
            disabled={disabled}
            pressStyle={style}
            style={motion && { transform: [{ scale }] }}
            onPressIn={(event) => {
                feedback(true);
                onPressIn?.(event);
            }}
            onPressOut={(event) => {
                feedback(false);
                onPressOut?.(event);
            }}
        />
    );
}
