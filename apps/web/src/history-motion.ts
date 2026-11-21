import { useLayoutEffect, useRef } from 'react';

// Keep the archived entries in place until their closing transition completes.
// A reversal invalidates the pending completion before it can clear a reopened page.
export function useHistoryExit(closing: boolean, finish: () => void) {
    const region = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (!closing) return;
        const transitions = region.current?.getAnimations?.() ?? [];
        if (!transitions.length) {
            finish();
            return;
        }
        let current = true;
        void Promise.allSettled(transitions.map((animation) => animation.finished)).then(() => {
            if (current) finish();
        });
        return () => {
            current = false;
        };
    }, [closing, finish]);
    return region;
}
