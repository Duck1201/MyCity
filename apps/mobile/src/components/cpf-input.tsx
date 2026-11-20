import { useRef, useState } from 'react';
import { type TextInputProps } from 'react-native';
import { TextInput } from './typography';
import { cpfDigits, formatCpfInput } from '@mycity/contracts';

type Selection = { start: number; end: number };
type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'selection' | 'onSelectionChange'> & { value: string; onChangeText: (formatted: string) => void };

// Derive the caret from the unchanged suffix. This preserves the edit position
// even when several adjacent digits have the same value (common for demo CPFs).
function caretAfterEdit(previous: string, raw: string, formatted: string, selection: Selection) {
    let suffixLength = previous.length - Math.min(selection.end, previous.length);
    if (!raw.endsWith(previous.slice(previous.length - suffixLength))) {
        suffixLength = 0;
        while (suffixLength < raw.length && suffixLength < previous.length && raw[raw.length - 1 - suffixLength] === previous[previous.length - 1 - suffixLength]) suffixLength++;
    }
    const nativeCaret = raw.length - suffixLength;
    const digitsBefore = cpfDigits(raw.slice(0, nativeCaret)).length;
    let maskedCaret = 0;
    let seen = 0;
    while (maskedCaret < formatted.length && seen < digitsBefore) {
        if (/\d/.test(formatted[maskedCaret]!)) seen++;
        maskedCaret++;
    }
    // Forward-delete next to a separator should advance past it; backspace
    // should leave the caret before it so that the next digit is reachable.
    if (previous === formatted && raw.length === previous.length - 1 && nativeCaret === selection.start && selection.start === selection.end && /[.-]/.test(previous[nativeCaret] ?? '')) maskedCaret++;
    return { nativeCaret, maskedCaret };
}

export function CpfInput({ value, onChangeText, ...props }: Props) {
    const [selection, setSelection] = useState<Selection>({ start: value.length, end: value.length });
    const lastSelection = useRef(selection);
    const pendingNativeCaret = useRef<number | null>(null);
    function select(next: Selection) {
        lastSelection.current = next;
        setSelection(next);
    }
    return (
        <TextInput
            {...props}
            value={value}
            selection={selection}
            onChangeText={(raw) => {
                const formatted = formatCpfInput(raw);
                const { nativeCaret, maskedCaret } = caretAfterEdit(value, raw, formatted, lastSelection.current);
                pendingNativeCaret.current = nativeCaret !== maskedCaret ? nativeCaret : null;
                select({ start: maskedCaret, end: maskedCaret });
                onChangeText(formatted);
            }}
            onSelectionChange={({ nativeEvent }) => {
                const next = nativeEvent.selection;
                const pending = pendingNativeCaret.current;
                pendingNativeCaret.current = null;
                if (next.start === pending && next.end === pending) return;
                select(next);
            }}
        />
    );
}
