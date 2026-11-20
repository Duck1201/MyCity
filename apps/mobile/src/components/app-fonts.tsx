import { type ReactNode } from 'react';
import { AppLoadingScreen } from './app-loading-screen';
import { useFonts } from 'expo-font';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { FontAvailability, nunitoFaces } from './typography';

const assets = { [nunitoFaces.regular]: Nunito_400Regular, [nunitoFaces.semibold]: Nunito_600SemiBold, [nunitoFaces.bold]: Nunito_700Bold, [nunitoFaces.extrabold]: Nunito_800ExtraBold };
export function AppFonts({ children }: { children: ReactNode | ((loaded: boolean) => ReactNode) }) {
    const [ready, error] = useFonts(assets);
    const loaded = ready || !!error;
    return <FontAvailability.Provider value={ready}>{typeof children === 'function' ? children(loaded) : loaded ? children : <AppLoadingScreen />}</FontAvailability.Provider>;
}
