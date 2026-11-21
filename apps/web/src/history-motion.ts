const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const ease = 'cubic-bezier(0.23, 1, 0.32, 1)';

// Grow or shrink a list from its previous height instead of jumping when entries come or go.
export function animateHeight(element: HTMLElement | null, from: number) {
    if (!element?.animate || reducedMotion()) return;
    const to = element.getBoundingClientRect().height;
    element.animate(
        [
            { height: from + 'px', overflow: 'hidden' },
            { height: to + 'px', overflow: 'hidden' },
        ],
        { duration: 240, easing: ease },
    );
}

// Fade entries out before they are removed; without the Web Animations API or with reduced motion, remove at once.
export function leave(elements: Element[], done: () => void) {
    if (!elements.length || !elements[0]?.animate || reducedMotion()) return done();
    const runs = elements.map(
        (element) =>
            element.animate(
                [
                    { opacity: 1, transform: 'none' },
                    { opacity: 0, transform: 'translateY(-4px)' },
                ],
                { duration: 150, easing: 'ease-in', fill: 'forwards' },
            ).finished,
    );
    void Promise.all(runs).then(done, done);
}
