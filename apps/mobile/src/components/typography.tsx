import { createContext, useContext, type ComponentProps } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type StyleProp, type TextStyle } from 'react-native';

export const nunitoFaces = { regular: 'Nunito-Regular', semibold: 'Nunito-SemiBold', bold: 'Nunito-Bold', extrabold: 'Nunito-ExtraBold' };
export const FontAvailability = createContext(true);

function useTextStyle(style: StyleProp<TextStyle>) {
    const available = useContext(FontAvailability);
    if (!available) return style;
    const weight = StyleSheet.flatten(style)?.fontWeight;
    const value = weight === 'bold' ? 700 : Number(weight);
    const fontFamily = value >= 800 ? nunitoFaces.extrabold : value >= 700 ? nunitoFaces.bold : value >= 600 ? nunitoFaces.semibold : nunitoFaces.regular;
    // Each asset already contains its weight. Avoid Android synthesizing a second bold.
    return [style, { fontFamily, fontWeight: 'normal' as const }];
}

export function Text({ style, ...props }: ComponentProps<typeof NativeText>) {
    return <NativeText {...props} style={useTextStyle(style)} />;
}

export function TextInput({ style, ...props }: ComponentProps<typeof NativeTextInput>) {
    return <NativeTextInput {...props} style={useTextStyle(style)} />;
}
