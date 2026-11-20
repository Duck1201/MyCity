import type { PreviewStatuses } from '../../../web/src/prototype/confirmation-store';
import { useState } from 'react';

export function useDemoConfirmations() {
    const [confirmed, update] = useState<number[]>([]);
    function setConfirmed(id: number, desired: boolean) {
        update((previous) => (desired ? Array.from(new Set([...previous, id])) : previous.filter((value) => value !== id)));
    }
    return { confirmed, setConfirmed, statusById: {} as PreviewStatuses, bridge: null };
}
