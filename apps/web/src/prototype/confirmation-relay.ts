import { confirmationChannel, previewPeer, readDemoConfirmations, readDemoStatuses, watchDemoConfirmations, writeDemoConfirmation } from './confirmation-store';

const mobileOrigin = previewPeer('8093');
if (mobileOrigin && window.parent !== window) {
    const publish = (receipt?: { id: number; accepted: boolean; sequence: number }) => {
        window.parent.postMessage({ channel: confirmationChannel, type: 'snapshot', confirmed: readDemoConfirmations(), statuses: readDemoStatuses(), receipt }, mobileOrigin);
    };
    window.addEventListener('message', (event) => {
        if (event.source !== window.parent || event.origin !== mobileOrigin || event.data?.channel !== confirmationChannel) return;
        const message = event.data;
        try {
            if (message.type === 'read') publish();
            if (message.type === 'set' && Number.isInteger(message.id) && Number.isInteger(message.sequence) && typeof message.desired === 'boolean') {
                publish({ id: message.id, accepted: writeDemoConfirmation(message.id, message.desired), sequence: message.sequence });
            }
        } catch {
            // Browsers with storage disabled can still operate the citizen preview in memory.
        }
    });
    watchDemoConfirmations(() => publish());
}
