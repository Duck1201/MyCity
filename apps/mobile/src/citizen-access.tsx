import { cpfDigits } from '@mycity/contracts';
import { useMotionEnabled } from './components/use-motion-enabled';
import { ScreenTransition } from './components/navigation-motion';
import { useLoginFade } from './components/login-motion';
import { CitizenAccessLayout, CitizenLoginScreen, accessStyles } from './components/citizen-login-screen';
import { mobileStyles } from './theme';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './components/typography';
import * as SecureStore from 'expo-secure-store';
import { ActionButton } from './components/action-button';

const sessionKey = 'mycity.session';
type Access = 'checking' | 'login' | 'citizen' | 'denied' | 'offline' | 'signingOut' | 'logoutFailed';

export function CitizenAccess({ apiBase, children, onSignedOut, onAuthenticated }: { apiBase: string; children: (token: string, expire: () => void) => ReactNode; onSignedOut?: () => void; onAuthenticated?: (id: string) => void }) {
    const [access, setAccess] = useState<Access>('checking');
    const [token, setToken] = useState('');
    const [cpf, setCpf] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [busy, setBusy] = useState(false);
    const [expiresAt, setExpiresAt] = useState(0);
    const motion = useMotionEnabled();
    const formOpacity = useLoginFade(access === 'login', motion, 180, 0.85);

    const expire = useCallback(() => {
        setAccess('checking');
        setToken('');
        setPassword('');
        setMessage('Sua sessão expirou. Entre novamente.');
        void SecureStore.deleteItemAsync(sessionKey).then(
            () => setAccess('login'),
            () => setAccess('offline'),
        );
    }, []);
    useEffect(() => {
        let active = true;
        async function restore() {
            try {
                const saved = await SecureStore.getItemAsync(sessionKey);
                if (!active) return;
                if (!saved) return setAccess('login');
                const session = JSON.parse(saved);
                if (session.apiBase !== apiBase || !session.token || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return expire();
                const response = await fetch(apiBase + '/me', { headers: { Authorization: 'Bearer ' + session.token } });
                if (!active) return;
                if (response.status === 401) return expire();
                if (!response.ok) throw new Error();
                const { data } = await response.json();
                if (active) {
                    setToken(session.token);
                    setExpiresAt(session.expiresAt);
                    onAuthenticated?.(data.id);
                    setAccess(data.role === 'CITIZEN' ? 'citizen' : 'denied');
                }
            } catch {
                if (active) setAccess('offline');
            }
        }
        void restore();
        return () => {
            active = false;
        };
    }, [apiBase, attempt, expire, onAuthenticated]);
    useEffect(() => {
        if (access !== 'citizen' || !expiresAt) return;
        const timer = setTimeout(expire, Math.max(0, expiresAt - Date.now()));
        return () => clearTimeout(timer);
    }, [expire, expiresAt, access]);
    async function enter() {
        if (busy) return;
        if (!cpf.trim() || !password) return setMessage('Informe seu CPF e sua senha.');
        const digits = cpfDigits(cpf);
        if (digits.length !== 11) return setMessage('Informe os 11 dígitos do CPF.');
        setBusy(true);
        setMessage('');
        try {
            const response = await fetch(apiBase + '/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf: digits, password, transport: 'bearer' }) });
            if (response.status === 401) return setMessage('CPF ou senha inválidos.');
            if (response.status === 429) return setMessage('Muitas tentativas. Aguarde antes de tentar novamente.');
            if (!response.ok) return setMessage('Não foi possível entrar. Tente novamente.');
            const { data } = await response.json();
            setToken(data.token);
            setPassword('');
            try {
                await SecureStore.setItemAsync(sessionKey, JSON.stringify({ apiBase, token: data.token, expiresAt: Date.parse(data.expiresAt) }));
            } catch {
                setAccess('logoutFailed');
                return;
            }
            onAuthenticated?.(data.user.id);
            setExpiresAt(Date.parse(data.expiresAt));
            setAccess(data.user.role === 'CITIZEN' ? 'citizen' : 'denied');
        } catch {
            setMessage('Não foi possível conectar ao MyCity. Verifique sua conexão e tente novamente.');
        } finally {
            setBusy(false);
        }
    }
    async function leave() {
        setAccess('signingOut');
        onSignedOut?.();
        try {
            const response = await fetch(apiBase + '/sessions/current', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
            if (!response.ok && response.status !== 401) throw new Error();
            await SecureStore.deleteItemAsync(sessionKey);
            setToken('');
            setExpiresAt(0);
            setMessage('');
            setCpf('');
            setAccess('login');
        } catch {
            setAccess('logoutFailed');
        }
    }
    return (
        <ScreenTransition route={access === 'citizen' ? 'workspace' : 'access'} depth={access === 'citizen' ? 1 : 0}>
            {access === 'login' ? (
                <CitizenLoginScreen onEnter={enter} credentials={{ cpf, password, setCpf, setPassword, message, busy, motion, formOpacity }} />
            ) : (
                <CitizenAccessLayout onLeave={access === 'citizen' || access === 'denied' ? leave : undefined}>
                    {access === 'citizen' ? (
                        children(token, expire)
                    ) : (
                        <View style={accessStyles.form}>
                            {access === 'checking' && (
                                <Text accessibilityLiveRegion="polite" style={mobileStyles.meta}>
                                    Verificando sua sessão…
                                </Text>
                            )}
                            {access === 'signingOut' && (
                                <Text accessibilityLiveRegion="polite" style={mobileStyles.meta}>
                                    Encerrando sua sessão…
                                </Text>
                            )}
                            {access === 'denied' && (
                                <Text accessibilityLiveRegion="polite" style={mobileStyles.error}>
                                    O aplicativo exige uma conta de cidadão. Saia para entrar com outra conta.
                                </Text>
                            )}
                            {access === 'offline' && (
                                <>
                                    <Text accessibilityLiveRegion="polite" style={mobileStyles.error}>
                                        Não foi possível verificar sua sessão. Confira sua conexão e tente novamente.
                                    </Text>
                                    <ActionButton
                                        label="Tentar novamente"
                                        onPress={() => {
                                            setAccess('checking');
                                            setAttempt((value) => value + 1);
                                        }}
                                    />
                                </>
                            )}
                            {access === 'logoutFailed' && (
                                <>
                                    <Text accessibilityLiveRegion="polite" style={mobileStyles.error}>
                                        Não foi possível concluir a operação. Confira sua conexão e encerre a sessão.
                                    </Text>
                                    <ActionButton label="Encerrar sessão" onPress={leave} />
                                </>
                            )}
                        </View>
                    )}
                </CitizenAccessLayout>
            )}
        </ScreenTransition>
    );
}
