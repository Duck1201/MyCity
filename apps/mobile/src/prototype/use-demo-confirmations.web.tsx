import { useEffect, useRef, useState } from 'react';
import { confirmationChannel, previewPeer, type PreviewStatuses } from '../../../web/src/prototype/confirmation-store';
import { statusKeys } from '../../../web/src/prototype/demo';

export function useDemoConfirmations() {
    const [confirmed, update] = useState<number[]>([]);
    const [statusById, setStatuses] = useState<PreviewStatuses>({});
    const frame = useRef<HTMLIFrameElement>(null);
    const ready = useRef(false);
    const sequence = useRef(0);
    const offline = useRef(new Map<number, boolean>());
    const requests = useRef(new Map<number, (accepted: boolean) => void>());
    const origin = previewPeer('8091');
    function send(message: { type: 'read' } | { type: 'set'; id: number; desired: boolean; sequence: number }) {
        if (origin) frame.current?.contentWindow?.postMessage({ channel: confirmationChannel, ...message }, origin);
    }
    useEffect(() => {
        if (!origin) return;
        const receive = (event: MessageEvent) => {
            if (event.source !== frame.current?.contentWindow || event.origin !== origin || event.data?.channel !== confirmationChannel || event.data.type !== 'snapshot') return;
            const { confirmed: ids, statuses, receipt } = event.data;
            if (!Array.isArray(ids) || !ids.every(Number.isInteger) || !statuses || typeof statuses !== 'object' || !Object.values(statuses).every((s) => statusKeys.some((status) => status === s))) return;
            ready.current = true;
            update(ids);
            setStatuses(statuses);
            if (receipt) requests.current.get(receipt.sequence)?.(receipt.accepted === true);
            for (const [id, desired] of offline.current) {
                frame.current?.contentWindow?.postMessage({ channel: confirmationChannel, type: 'set', id, desired, sequence: ++sequence.current }, origin);
            }
            offline.current.clear();
        };
        const waiting = requests.current;
        window.addEventListener('message', receive);
        return () => {
            window.removeEventListener('message', receive);
            for (const finish of waiting.values()) finish(false);
        };
    }, [origin]);
    async function setConfirmed(id: number, desired: boolean) {
        if (!ready.current) {
            offline.current.set(id, desired);
            update((previous) => (desired ? Array.from(new Set([...previous, id])) : previous.filter((value) => value !== id)));
            return;
        }
        const key = ++sequence.current;
        const accepted = await new Promise<boolean>((resolve) => {
            const finish = (ok: boolean) => {
                window.clearTimeout(timer);
                requests.current.delete(key);
                resolve(ok);
            };
            const timer = window.setTimeout(() => finish(false), 2000);
            requests.current.set(key, finish);
            send({ type: 'set', id, desired, sequence: key });
        });
        if (!accepted) throw new Error('Não foi possível alterar a confirmação.');
    }
    const bridge = origin && (
        <iframe
            hidden
            tabIndex={-1}
            aria-hidden="true"
            title="Confirmações da demonstração"
            ref={frame}
            src={origin + '/__preview/confirmations'}
            referrerPolicy="no-referrer"
            onLoad={() => {
                ready.current = false;
                send({ type: 'read' });
            }}
        />
    );
    return { confirmed, setConfirmed, statusById, bridge };
}
