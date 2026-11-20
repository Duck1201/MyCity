import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useMotionEnabled() {
    const [enabled, setEnabled] = useState(false);
    useEffect(() => {
        let current = true;
        let updated = false;
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
            updated = true;
            setEnabled(!reduced);
        });
        void AccessibilityInfo.isReduceMotionEnabled().then(
            (reduced) => {
                if (current && !updated) setEnabled(!reduced);
            },
            () => {
                /* Keep the instant transition when the OS preference is unavailable. */
            },
        );
        return () => {
            current = false;
            subscription?.remove();
        };
    }, []);
    return enabled;
}
