import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { ScreenTransition } from './components/navigation-motion';
import { CitizenLoginScreen } from './components/citizen-login-screen';
import { AppFonts } from './components/app-fonts';
import { CitizenPrototype } from './prototype/citizen-prototype';
import './mobile-preview.css';

const isLoginRoute = () => ['/login', '/login/'].includes(window.location.pathname);
export default function App() {
    const [width, setWidth] = useState(390);
    const [login, setLogin] = useState(isLoginRoute);
    useEffect(() => {
        const restore = () => setLogin(isLoginRoute());
        window.addEventListener('popstate', restore);
        return () => window.removeEventListener('popstate', restore);
    }, []);
    const screen = useRef<HTMLDivElement>(null);
    const lastScreen = useRef(login);
    useLayoutEffect(() => {
        if (lastScreen.current !== login && document.activeElement === document.body) {
            const heading = screen.current?.querySelector<HTMLElement>('[role="heading"],h1,h2,h3');
            heading?.setAttribute('tabindex', '-1');
            heading?.focus({ preventScroll: true });
        }
        lastScreen.current = login;
    }, [login]);
    function navigate(toLogin: boolean) {
        window.history.pushState(null, '', toLogin ? '/login' : '/');
        setLogin(toLogin);
    }
    function previewLogin(event: MouseEvent<HTMLAnchorElement>) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(true);
    }
    useEffect(() => {
        document.title = login ? 'Entrar no MyCity · Prévia' : 'MyCity · App do cidadão';
    }, [login]);
    if (!__DEV__ || process.env.EXPO_PUBLIC_MY_CITY_PROTOTYPE !== '1') return <p>A prévia do app está disponível no modo de desenvolvimento.</p>;
    return (
        <AppFonts>
            <main className="mobile-preview">
                <div className="mobile-viewport" style={{ '--device-width': width + 'px' } as CSSProperties}>
                    <div className="preview-toolbar">
                        {login ? (
                            <span>Prévia sem autenticação</span>
                        ) : (
                            <a href="/login" onClick={previewLogin}>
                                Ver tela de login
                            </a>
                        )}
                        <label className="viewport-size">
                            Largura da tela
                            <select value={width} onChange={(event) => setWidth(Number(event.target.value))}>
                                {[320, 360, 390, 430].map((size) => (
                                    <option key={size} value={size}>
                                        {size} px
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div ref={screen} className="mobile-screen">
                        <ScreenTransition route={login ? 'login' : 'home'} depth={login ? 0 : 1}>
                            {login ? <CitizenLoginScreen onEnter={() => navigate(false)} /> : <CitizenPrototype />}
                        </ScreenTransition>
                    </div>
                </div>
            </main>
        </AppFonts>
    );
}
