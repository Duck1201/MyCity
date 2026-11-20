import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { FontAvailability, nunitoFaces } from './typography';

const assets = { [nunitoFaces.regular]: Nunito_400Regular, [nunitoFaces.semibold]: Nunito_600SemiBold, [nunitoFaces.bold]: Nunito_700Bold, [nunitoFaces.extrabold]: Nunito_800ExtraBold };
export function AppFonts({ children }: { children: ReactNode }) {
    const [ready, error] = useFonts(assets);
    if (!ready && !error)
        return (
            <View style={styles.opening}>
                <ActivityIndicator accessibilityRole="progressbar" accessibilityLabel="Abrindo MyCity" color="#24578e" />
            </View>
        );
    return <FontAvailability.Provider value={ready}>{children}</FontAvailability.Provider>;
}
const styles = StyleSheet.create({ opening: { flex: 1, justifyContent: 'center', backgroundColor: '#f4f7fb' } });
