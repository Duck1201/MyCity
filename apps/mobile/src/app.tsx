import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { resolveApiBase } from './api-base';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { Linking, StyleSheet } from 'react-native';
import { AppFonts } from './components/app-fonts';
import { CitizenAccess } from './citizen-access';
import { CitizenWorkspace } from './citizen-workspace';
import { type CitizenDraft } from './citizen-report';

const apiBase = resolveApiBase({ development: __DEV__, configuredUrl: process.env.EXPO_PUBLIC_API_URL, developmentPort: process.env.EXPO_PUBLIC_API_PORT, metroHostUri: Constants.expoConfig?.hostUri });

export default function App() {
    return (
        <AppFonts>
            <Application />
        </AppFonts>
    );
}

function Application() {
    if (__DEV__ && process.env.EXPO_PUBLIC_MY_CITY_PROTOTYPE === '1') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro drops this dependency when folding the production branch.
        const { CitizenPrototype } = require('./prototype/citizen-prototype') as typeof import('./prototype/citizen-prototype');
        return (
            <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                <SafeAreaView style={styles.preview}>
                    <StatusBar style="dark" />
                    <CitizenPrototype />
                </SafeAreaView>
            </SafeAreaProvider>
        );
    }
    return <ConnectedApp />;
}
function ConnectedApp() {
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
                <CitizenAccess apiBase={apiBase} onSignedOut={() => selectOwner(null)} onAuthenticated={selectOwner}>
                    {(token, onSessionExpired) => <CitizenWorkspace linkedReport={linkedReport} clearLink={clearLink} draftRef={draft} apiBase={apiBase} token={token} onSessionExpired={onSessionExpired} />}
                </CitizenAccess>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, preview: { flex: 1, backgroundColor: '#fff' } });
