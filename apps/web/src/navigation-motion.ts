// Return the cleanup so a newer destination or a preference change can interrupt the entrance.
export function animateNavigation(element: HTMLElement | null, transform: string) {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (preference?.matches || !element?.animate) return;
    const motion = element.animate(
        [
            { transform, opacity: 0.82 },
            { transform: 'none', opacity: 1 },
        ],
        { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
    const cancel = () => motion.cancel();
    preference?.addEventListener('change', cancel);
    return () => {
        preference?.removeEventListener('change', cancel);
        cancel();
    };
}
