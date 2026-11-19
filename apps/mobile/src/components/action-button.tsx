import { Pressable, StyleSheet, Text } from 'react-native';

export function ActionButton({ label, onPress, pending = false }: { label: string; onPress: () => void; pending?: boolean }) {
    return (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending, busy: pending }} disabled={pending} onPress={onPress} style={[styles.button, pending && styles.pending]}>
            <Text style={styles.label}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        minHeight: 48,
        backgroundColor: '#155e75',
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pending: { opacity: 0.6 },
    label: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
