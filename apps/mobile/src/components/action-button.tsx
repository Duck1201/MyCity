import { StyleSheet } from 'react-native';
import { MotionPressable } from './motion-pressable';
import { Text } from './typography';
import { colors } from '../theme';

export function ActionButton({ label, onPress, pending = false, disabled = false, variant = 'primary' }: { label: string; onPress: () => void; pending?: boolean; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger' }) {
    const inactive = pending || disabled;
    return (
        <MotionPressable accessibilityRole="button" accessibilityState={{ disabled: inactive, busy: pending }} disabled={inactive} onPress={onPress} style={({ pressed }) => [styles.button, styles[variant], inactive && styles.pending, pressed && styles.pressed]}>
            <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
        </MotionPressable>
    );
}
const styles = StyleSheet.create({
    button: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    primary: { backgroundColor: colors.teal, borderColor: colors.teal },
    secondary: { backgroundColor: colors.surface, borderColor: colors.muted },
    danger: { backgroundColor: colors.danger, borderColor: colors.danger },
    pending: { opacity: 0.65 },
    pressed: { opacity: 0.8 },
    label: { color: colors.surface, fontWeight: '700', fontSize: 16, textAlign: 'center' },
    secondaryLabel: { color: colors.teal },
});
