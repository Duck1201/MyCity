import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { resolveApiBase } from './api-base';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { Linking, Platform, StyleSheet } from 'react-native';
import { AppFonts } from './components/app-fonts';
import { CitizenAccess } from './citizen-access';
import { CitizenWorkspace } from './citizen-workspace';
import { type CitizenDraft } from './citizen-report';
import { QueryCacheProvider } from './use-active-query';
import { colors } from './theme';

const apiBase = resolveApiBase({ development: __DEV__, webOrigin: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined, configuredUrl: process.env.EXPO_PUBLIC_API_URL, developmentPort: process.env.EXPO_PUBLIC_API_PORT, metroHostUri: Constants.expoConfig?.hostUri });

export default function App() {
    const [linkedReport, setLinkedReport] = useState<{ id: string } | null>(null);
    const clearLink = useCallback(() => setLinkedReport(null), []);
    useEffect(() => {
        let mounted = true;
        let received = false;
        function receive(url: string | null | undefined) {
            const id = url?.match(/^mycity:\/\/reports\/([A-Za-z0-9_-]{1,128})$/)?.[1];
            if (mounted && id) setLinkedReport({ id });
        }
        const handler = Linking.addEventListener('url', (event) => {
            received = true;
            receive(event.url);
        });
        void Linking.getInitialURL().then(
            (url) => {
                if (!received) receive(url);
            },
            () => {},
        );
        return () => {
            mounted = false;
            handler.remove();
        };
    }, []);
    const owner = useRef<string | null>(null);
    const draft = useRef<CitizenDraft | null>(null);
    const selectOwner = useCallback((id: string | null) => {
        if (owner.current !== id) draft.current = null;
        owner.current = id;
    }, []);
    return (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <AppFonts>
                    {(fontsLoaded) => (
                        <CitizenAccess apiBase={apiBase} ready={fontsLoaded} onSignedOut={() => selectOwner(null)} onAuthenticated={selectOwner}>
                            {(token, onSessionExpired, onLeave) => (
                                <QueryCacheProvider key={token} owner={owner.current}>
                                    <CitizenWorkspace linkedReport={linkedReport} clearLink={clearLink} draftRef={draft} apiBase={apiBase} token={token} onSessionExpired={onSessionExpired} onLeave={onLeave} />
                                </QueryCacheProvider>
                            )}
                        </CitizenAccess>
                    )}
                </AppFonts>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.surface } });
