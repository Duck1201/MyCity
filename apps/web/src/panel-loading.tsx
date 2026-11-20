import { createContext, Suspense, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { animateNavigation } from './navigation-motion';

const LoadingContext = createContext<((pending: boolean) => void) | null>(null);

const VisibleContext = createContext(true);
export function usePanelVisible() {
    return useContext(VisibleContext);
}

export function usePanelLoading(pending: boolean) {
    const signal = useContext(LoadingContext);
    const settled = useRef(false);
    useLayoutEffect(() => {
        if (settled.current) return;
        signal?.(pending);
        if (!pending) settled.current = true;
    }, [pending, signal]);
}

export function LoadingMark({ message }: { message: string }) {
    return (
        <div role="status" aria-label="Carregando painel">
            <MapPin aria-hidden="true" />
            <strong>MyCity</strong>
            <span className="session-load-track" aria-hidden="true">
                <i />
            </span>
            <small>{message}</small>
        </div>
    );
}

function WaitingForModule() {
    usePanelLoading(true);
    return null;
}

export function PanelStage({ children, message, offset }: { children: ReactNode; message: string; offset: string }) {
    const [pending, setPending] = useState(false);
    const [holding, setHolding] = useState(false);
    const shownAt = useRef(0);
    const scene = useRef<HTMLDivElement>(null);
    const enterFrom = useRef(offset);
    useLayoutEffect(() => {
        if (pending) {
            if (!holding) {
                shownAt.current = performance.now();
                setHolding(true);
            }
            return;
        }
        if (!holding) return;
        // Keep an already visible loader readable when a fast request finishes.
        const remaining = 220 - (performance.now() - shownAt.current);
        if (remaining <= 0) {
            setHolding(false);
            return;
        }
        const timer = window.setTimeout(() => setHolding(false), remaining);
        return () => window.clearTimeout(timer);
    }, [pending, holding]);
    const waiting = pending || holding;
    useLayoutEffect(() => {
        if (waiting) return;
        return animateNavigation(scene.current, enterFrom.current);
    }, [waiting]);
    return (
        <LoadingContext.Provider value={setPending}>
            {waiting && (
                <div className="session-loading panel-loading">
                    <LoadingMark message={message} />
                </div>
            )}
            <div ref={scene} hidden={waiting}>
                <VisibleContext.Provider value={!waiting}>
                    <Suspense fallback={<WaitingForModule />}>{children}</Suspense>
                </VisibleContext.Provider>
            </div>
        </LoadingContext.Provider>
    );
}
