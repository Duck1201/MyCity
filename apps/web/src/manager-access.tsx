import { LoadingMark } from './panel-loading';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { cpfDigits, formatCpfInput } from '@mycity/contracts';
import './access-page.css';
import { ManagerShell, type QueueNavigation } from './manager-shell';
import { ActionButton } from './components/action-button';

type Access = 'loading' | 'login' | 'manager' | 'denied' | 'unavailable' | 'signingOut' | 'logoutFailed';
const headers = { 'X-MyCity-Client': 'web' };

function applyCpfMask(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const raw = input.value;
    const offset = input.selectionStart ?? raw.length;
    const digitsBeforeCaret = cpfDigits(raw.slice(0, offset)).length;
    const formatted = formatCpfInput(raw);
    if (formatted === raw) return;
    input.value = formatted;
    const digits = Array.from(formatted.matchAll(/\d/g));
    const position = digitsBeforeCaret === 0 ? 0 : (digits[digitsBeforeCaret - 1]?.index ?? formatted.length - 1) + 1;
    input.setSelectionRange(position, position);
}

function deleteAcrossSeparator(event: KeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const start = input.selectionStart;
    if (start === null || start !== input.selectionEnd || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Backspace' && start >= 2 && /[.-]/.test(input.value.charAt(start - 1))) input.setSelectionRange(start - 2, start);
    if (event.key === 'Delete' && /[.-]/.test(input.value.charAt(start))) input.setSelectionRange(start, start + 2);
}

export function ManagerAccess({ children }: { children: (onSessionExpired: () => void, navigation: QueueNavigation) => ReactNode }) {
    const [access, setAccess] = useState<Access>('loading');
    const [attempt, setAttempt] = useState(0);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const cpfInput = useRef<HTMLInputElement>(null);
    const [cpfError, setCpfError] = useState(false);
    const [expiresAt, setExpiresAt] = useState(0);
    const expire = useCallback(() => {
        setMessage('Sua sessão expirou. Entre novamente.');
        setAccess('login');
    }, []);
    const openSession = useCallback(
        (role: string, expires: string | null) => {
            if (role !== 'MANAGER') {
                setAccess('denied');
                return;
            }
            const deadline = Date.parse(expires ?? '');
            if (!Number.isFinite(deadline) || deadline <= Date.now()) {
                expire();
                return;
            }
            setExpiresAt(deadline);
            setAccess('manager');
        },
        [expire],
    );
    useEffect(() => {
        const controller = new AbortController();
        async function restore() {
            try {
                const response = await fetch('/api/v1/me', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
                if (controller.signal.aborted) return;
                if (response.status === 401) return setAccess('login');
                if (!response.ok) throw new Error();
                const { data } = await response.json();
                if (!controller.signal.aborted) openSession(data.role, response.headers.get('X-Session-Expires-At'));
            } catch {
                if (!controller.signal.aborted) setAccess('unavailable');
            }
        }
        void restore();
        return () => controller.abort();
    }, [attempt, openSession]);
    useEffect(() => {
        if (access !== 'manager' || !expiresAt) return;
        const timer = window.setTimeout(expire, Math.max(0, expiresAt - Date.now()));
        return () => window.clearTimeout(timer);
    }, [access, expiresAt, expire]);
    async function enter(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const fields = new FormData(event.currentTarget);
        const cpf = cpfDigits(String(fields.get('cpf') ?? ''));
        if (cpf.length !== 11) {
            setCpfError(true);
            setMessage('Informe os 11 dígitos do CPF.');
            cpfInput.current?.focus();
            return;
        }
        setBusy(true);
        setMessage('');
        try {
            const response = await fetch('/api/v1/sessions', {
                credentials: 'same-origin',
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf, password: fields.get('password'), transport: 'cookie' }),
            });
            if (response.status === 401) return setMessage('CPF ou senha inválidos.');
            if (response.status === 429) return setMessage('Muitas tentativas. Aguarde antes de tentar novamente.');
            if (!response.ok) return setMessage('Não foi possível entrar. Tente novamente.');
            const { data } = await response.json();
            openSession(data.user.role, data.expiresAt);
        } catch {
            setMessage('Não foi possível conectar ao MyCity. Verifique sua conexão e tente novamente.');
        } finally {
            setBusy(false);
        }
    }
    async function leave() {
        setAccess('signingOut');
        try {
            const response = await fetch('/api/v1/sessions/current', { method: 'DELETE', credentials: 'same-origin', headers });
            if (!response.ok && response.status !== 401) throw new Error();
            setExpiresAt(0);
            setMessage('');
            setAccess('login');
        } catch {
            setAccess('logoutFailed');
        }
    }
    if (access === 'loading' || access === 'signingOut') {
        return (
            <main className="session-loading">
                <LoadingMark message={access === 'loading' ? 'Verificando sua sessão…' : 'Encerrando sua sessão…'} />
            </main>
        );
    }
    if (access === 'manager') return <ManagerShell leave={leave}>{(navigation) => children(expire, navigation)}</ManagerShell>;
    return (
        <main className="entry-page">
            <div className="entry-content">
                <header className="entry-masthead">
                    <span className="entry-brand-icon" aria-hidden="true">
                        <MapPin />
                    </span>
                    <strong>MyCity</strong>
                </header>
                {access === 'login' ? (
                    <form className="entry-form" onSubmit={enter}>
                        <h1>Acesso do gestor</h1>
                        <label htmlFor="entry-cpf">CPF</label>
                        <input
                            ref={cpfInput}
                            id="entry-cpf"
                            required
                            name="cpf"
                            type="text"
                            inputMode="numeric"
                            autoComplete="username"
                            placeholder="000.000.000-00"
                            aria-invalid={cpfError || undefined}
                            aria-describedby={cpfError ? 'entry-error' : undefined}
                            onKeyDown={deleteAcrossSeparator}
                            onChange={(event) => {
                                applyCpfMask(event);
                                if (cpfError) {
                                    setCpfError(false);
                                    setMessage('');
                                }
                            }}
                        />
                        <label htmlFor="entry-password">Senha</label>
                        <input id="entry-password" required name="password" type="password" autoComplete="current-password" />
                        {message && (
                            <p role="alert" id="entry-error" className="entry-error">
                                {message}
                            </p>
                        )}
                        <ActionButton type="submit" pending={busy} className="entry-submit">
                            {busy ? 'Entrando…' : 'Entrar'}
                            {busy && <i className="entry-spinner" aria-hidden="true" />}
                        </ActionButton>
                    </form>
                ) : (
                    <section className="entry-feedback" aria-live="polite">
                        <h1>Acesso ao painel</h1>
                        {access === 'denied' && (
                            <>
                                <p>O painel exige uma conta de gestor. Saia para entrar com outra conta.</p>
                                <ActionButton className="entry-submit" onClick={leave}>
                                    Sair
                                </ActionButton>
                            </>
                        )}
                        {access === 'unavailable' && (
                            <>
                                <p>Não foi possível verificar sua sessão. Confira sua conexão.</p>
                                <ActionButton
                                    className="entry-submit"
                                    onClick={() => {
                                        setAccess('loading');
                                        setAttempt((value) => value + 1);
                                    }}
                                >
                                    Tentar novamente
                                </ActionButton>
                            </>
                        )}
                        {access === 'logoutFailed' && (
                            <>
                                <p>Não foi possível encerrar a sessão no servidor. Verifique sua conexão.</p>
                                <ActionButton className="entry-submit" onClick={leave}>
                                    Tentar sair novamente
                                </ActionButton>
                            </>
                        )}
                    </section>
                )}
            </div>
            <div className="entry-illustration">
                <img src="/images/urban-neighborhood.svg" alt="" />
            </div>
        </main>
    );
}
