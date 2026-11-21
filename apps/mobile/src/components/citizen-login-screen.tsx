import { type ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View, Pressable } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import square from '../assets/praca-silviano-brandao.webp';
import { colors, mobileStyles } from '../theme';
import { Text, TextInput } from './typography';
import { CpfInput } from './cpf-input';
import { ActionButton } from './action-button';
import { LoginInputFrame } from './login-motion';

function Wordmark({ location }: { location?: string }) {
    return (
        <View style={accessStyles.wordmark} accessible accessibilityLabel={location ? 'MyCity, ' + location : 'MyCity'}>
            <View importantForAccessibility="no" style={accessStyles.pin}>
                <View style={accessStyles.pinCenter} />
            </View>
            <View>
                <Text style={[accessStyles.brand, location && accessStyles.photoBrand]}>MyCity</Text>
                {location && <Text style={accessStyles.place}>{location}</Text>}
            </View>
        </View>
    );
}

export function CitizenAccessLayout({ children, headerAction, onLeave }: { children: ReactNode; headerAction?: ReactNode; onLeave?: (() => void) | undefined }) {
    return (
        <View style={accessStyles.container}>
            <View style={accessStyles.header}>
                <Wordmark />
                <View style={accessStyles.headerActions}>
                    {headerAction}
                    {onLeave && (
                        <Pressable accessibilityRole="button" onPress={onLeave} style={({ pressed }) => [mobileStyles.textButton, pressed && mobileStyles.headerButtonPressed]}>
                            <Text style={accessStyles.exitText}>Sair</Text>
                        </Pressable>
                    )}
                </View>
            </View>
            {children}
        </View>
    );
}

type LoginFields = { cpf: string; password: string; setCpf: (value: string) => void; setPassword: (value: string) => void; message: string; busy: boolean; motion: boolean };
export function CitizenLoginScreen({ credentials, onEnter }: { credentials: LoginFields; onEnter: () => void }) {
    return (
        <KeyboardAvoidingView style={accessStyles.loginRoot} behavior="padding">
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={accessStyles.loginPage}>
                <View style={accessStyles.scene}>
                    <Image source={square} style={accessStyles.sceneImage} resizeMode="cover" accessible accessibilityRole={Platform.OS === 'web' ? undefined : 'image'} accessibilityLabel="Praça Silviano Brandão com o Santuário Santa Rita de Cássia, em Viçosa" />
                    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
                        <Svg width="100%" height="100%" aria-hidden>
                            <Defs>
                                <LinearGradient id="loginShade" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <Stop offset="0%" stopColor="#102639" stopOpacity={0} />
                                    <Stop offset="35%" stopColor="#102639" stopOpacity={0.04} />
                                    <Stop offset="86%" stopColor="#102639" stopOpacity={0.89} />
                                </LinearGradient>
                            </Defs>
                            <Rect width="100%" height="100%" fill="url(#loginShade)" />
                        </Svg>
                    </View>
                    <View style={accessStyles.caption}>
                        <Wordmark location="Viçosa, MG" />
                        <Text style={accessStyles.credit} accessibilityRole="link" accessibilityLabel="Créditos da foto: HVL, CC BY 4.0" onPress={() => void Linking.openURL('https://commons.wikimedia.org/wiki/File:Pra%C3%A7a_Silviano_Brand%C3%A3o_com_o_Santu%C3%A1rio_Santa_Rita_de_C%C3%A1ssia_ao_fundo,_Vi%C3%A7osa_MG.JPG')}>
                            HVL · CC BY 4.0
                        </Text>
                    </View>
                </View>
                <View style={accessStyles.loginFields}>
                    <Text accessibilityRole="header" style={accessStyles.title}>
                        Entrar no MyCity
                    </Text>
                    <Text style={accessStyles.label}>CPF</Text>
                    <LoginInputFrame animate={credentials.motion}>{(focusEvents) => <CpfInput {...focusEvents} accessibilityLabel="CPF" style={accessStyles.input} value={credentials.cpf} keyboardType="numeric" autoComplete="username" placeholder="000.000.000-00" placeholderTextColor={colors.muted} selectionColor={colors.teal} onChangeText={credentials.setCpf} />}</LoginInputFrame>
                    <Text style={accessStyles.label}>Senha</Text>
                    <LoginInputFrame animate={credentials.motion}>{(focusEvents) => <TextInput {...focusEvents} accessibilityLabel="Senha" style={accessStyles.input} value={credentials.password} selectionColor={colors.teal} secureTextEntry autoComplete="current-password" onChangeText={credentials.setPassword} onSubmitEditing={onEnter} />}</LoginInputFrame>
                    {!!credentials.message && (
                        <Text accessibilityLiveRegion="polite" style={accessStyles.error}>
                            {credentials.message}
                        </Text>
                    )}
                    <ActionButton pending={!!credentials.busy} label={credentials.busy ? 'Entrando…' : 'Entrar'} onPress={onEnter} />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

export const accessStyles = StyleSheet.create({
    loginRoot: { flex: 1, backgroundColor: colors.surface },
    container: { flex: 1, backgroundColor: colors.canvas },
    header: { minHeight: 55, paddingHorizontal: 18, backgroundColor: colors.rail, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
    wordmark: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8 },
    pin: { width: 18, height: 18, backgroundColor: colors.surface, borderRadius: 10, borderBottomLeftRadius: 2, transform: [{ rotate: '-45deg' }], justifyContent: 'center', alignItems: 'center' },
    pinCenter: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.rail },
    brand: { fontSize: 24, letterSpacing: -0.8, fontWeight: '700', color: colors.surface },
    exitText: { fontWeight: '600', color: colors.surface, fontSize: 15 },
    form: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 36, gap: 10, justifyContent: 'center' },
    loginPage: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
    scene: { width: '100%', minHeight: 166, flexBasis: 166, flexGrow: 3, maxHeight: 420, justifyContent: 'flex-end', backgroundColor: colors.pale },
    sceneImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
    caption: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 8, paddingHorizontal: 24, paddingBottom: 39 },
    photoBrand: { fontSize: 32, lineHeight: 36, letterSpacing: -1.4 },
    place: { fontSize: 14, fontWeight: '600', color: '#edf4fa' },
    credit: { fontSize: 12, color: colors.surface, textDecorationLine: 'underline', paddingVertical: 8 },
    loginFields: { flexGrow: 1, marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface, paddingHorizontal: 24, paddingTop: 26, paddingBottom: 24, gap: 8 },
    title: { ...mobileStyles.title, fontSize: 28, marginBottom: 8 },
    label: mobileStyles.label,
    input: { minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, borderWidth: 1, borderColor: colors.muted, backgroundColor: colors.surface, borderRadius: 8, color: colors.ink },
    error: mobileStyles.error,
});
