import { useSyncExternalStore, type ComponentProps } from 'react';

function subscribe(callback: () => void) {
    window.addEventListener('popstate', callback);
    return () => window.removeEventListener('popstate', callback);
}
export function useLocation() {
    return new URL(useSyncExternalStore(subscribe, () => window.location.href));
}
export function navigate(url: string, focus?: string, replace = false) {
    if (replace) {
        history.replaceState({ ...history.state, focus, scroll: window.scrollY }, '', url);
        window.dispatchEvent(new Event('popstate'));
        return;
    }
    history.replaceState({ ...history.state, scroll: window.scrollY, focus: document.activeElement?.id }, '');
    history.pushState({ from: window.location.pathname + window.location.search, focus, scroll: focus ? window.scrollY : 0 }, '', url);
    window.dispatchEvent(new Event('popstate'));
}
export function Link({ href = '/', onClick, ...props }: ComponentProps<'a'>) {
    return (
        <a
            {...props}
            href={href}
            onClick={(event) => {
                onClick?.(event);
                if (event.defaultPrevented || event.button || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                navigate(href);
            }}
        />
    );
}
export function queueUrl(params: Record<string, string>) {
    const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
    return '/atendimento' + (search.size ? '?' + search : '');
}
