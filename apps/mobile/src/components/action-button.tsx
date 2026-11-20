import { Pressable, StyleSheet } from 'react-native';
import { Text } from './typography';
import { colors } from '../theme';

export function ActionButton({ label, onPress, pending = false, variant = 'primary' }: { label: string; onPress: () => void; pending?: boolean; variant?: 'primary' | 'secondary' | 'danger' }) {
    return (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending, busy: pending }} disabled={pending} onPress={onPress} style={({ pressed }) => [styles.button, styles[variant], pending && styles.pending, pressed && styles.pressed]}>
            <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
        </Pressable>
    );
}
const styles = StyleSheet.create({
    button: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    primary: { backgroundColor: colors.teal, borderColor: colors.teal },
    secondary: { backgroundColor: colors.surface, borderColor: '#819ba5' },
    danger: { backgroundColor: colors.danger, borderColor: colors.danger },
    pending: { opacity: 0.65 },
    pressed: { opacity: 0.8 },
    label: { color: colors.surface, fontWeight: '700', fontSize: 16, textAlign: 'center' },
    secondaryLabel: { color: colors.deepTeal },
});
