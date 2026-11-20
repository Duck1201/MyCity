import { useContext, useLayoutEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../components/typography';
import { colors } from '../theme';

type ChoiceProps<T extends string> = {
    label: string;
    placeholder: string;
    value: T | null;
    options: readonly { value: T; label: string }[];
    onChange: (value: T) => void;
    disabled?: boolean;
    triggerRef?: RefObject<ComponentRef<typeof View> | null>;
};

export function ChoiceField<T extends string>({ label, placeholder, value, options, onChange, disabled = false, triggerRef }: ChoiceProps<T>) {
    const [open, setOpen] = useState(false);
    const [bounds, setBounds] = useState<ViewStyle>();
    const localTrigger = useRef<ComponentRef<typeof View>>(null);
    const trigger = triggerRef ?? localTrigger;
    const insets = useContext(SafeAreaInsetsContext);
    const display = options.find((option) => option.value === value)?.label ?? placeholder;
    useLayoutEffect(() => {
        if (!open || Platform.OS !== 'web') return;
        const frame = document.querySelector('.mobile-screen');
        if (!frame) return;
        const align = () => {
            const { left, top, width, height } = frame.getBoundingClientRect();
            setBounds({ position: 'absolute', left, top, width, height });
        };
        align();
        window.addEventListener('resize', align);
        return () => window.removeEventListener('resize', align);
    }, [open]);
    function openSheet() {
        Keyboard.dismiss();
        setOpen(true);
    }
    function closeSheet() {
        setOpen(false);
    }
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: display }} accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={openSheet} style={({ pressed }) => [styles.trigger, pressed && styles.pressed, disabled && styles.disabled]}>
                <Text numberOfLines={1} style={[styles.value, !value && styles.placeholder]}>
                    {display}
                </Text>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...(Platform.OS !== 'web' && { accessible: false })}>
                    <Path d="m6 9 6 6 6-6" />
                </Svg>
            </Pressable>
            {open && (
                <Modal transparent animationType="none" onRequestClose={closeSheet} onDismiss={() => trigger.current?.focus()}>
                    <View testID="choice-sheet" style={[styles.stage, bounds]}>
                        <Pressable accessible={false} tabIndex={-1} onPress={closeSheet} style={StyleSheet.absoluteFill} />
                        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(16, insets?.bottom ?? 0) }]}>
                            <View style={styles.bar}>
                                <Text accessibilityRole="header" style={styles.title}>
                                    {label}
                                </Text>
                                <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={closeSheet} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
                                    <Text style={styles.closeText}>Fechar</Text>
                                </Pressable>
                            </View>
                            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.choices}>
                                {options.map((option) => (
                                    <Pressable
                                        key={option.value}
                                        accessibilityRole="button"
                                        accessibilityLabel={option.label}
                                        accessibilityState={{ selected: option.value === value }}
                                        onPress={() => {
                                            onChange(option.value);
                                            closeSheet();
                                        }}
                                        style={({ pressed }) => [styles.option, option.value === value && styles.selected, pressed && styles.pressed]}
                                    >
                                        <Text style={styles.optionName}>{option.label}</Text>
                                        <View style={[styles.radio, option.value === value && styles.radioOn]}>{option.value === value && <View style={styles.dot} />}</View>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}
const styles = StyleSheet.create({
    field: { gap: 7, minWidth: 0 },
    label: { fontSize: 15, fontWeight: '700', color: colors.ink },
    trigger: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 10, borderColor: '#98adc2', borderWidth: 1, borderRadius: 8, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8 },
    value: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink },
    placeholder: { color: colors.muted, fontWeight: '400' },
    disabled: { opacity: 0.58 },
    pressed: { backgroundColor: colors.pale },
    stage: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,36,60,.45)', overflow: 'hidden' },
    sheet: { maxHeight: '84%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 18, paddingTop: 8 },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderColor: colors.line, paddingBottom: 4 },
    title: { fontSize: 21, fontWeight: '800', color: colors.ink, flexShrink: 1 },
    close: { minHeight: 48, minWidth: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    closeText: { fontWeight: '700', color: colors.teal, fontSize: 14 },
    choices: { paddingVertical: 6, gap: 2 },
    option: { minHeight: 50, paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 8 },
    optionName: { color: colors.ink, fontSize: 16, flex: 1 },
    selected: { backgroundColor: colors.pale },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#8094ab', alignItems: 'center', justifyContent: 'center' },
    radioOn: { borderColor: colors.teal, borderWidth: 2 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal },
});
