import { allowedManagerTargets, type ReportStatus } from '@mycity/contracts';
import { pending, records, statusKeys } from './demo';

const votePrefix = 'mycity.preview.confirmation.v1:';
const statusPrefix = 'mycity.preview.status.v1:';
export const confirmationChannel = 'mycity.preview.confirmations.v1';
export type PreviewStatuses = Partial<Record<number, ReportStatus>>;

export function previewPeer(port: '8091' | '8093') {
    const here = window.location;
    if (here.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(here.hostname) || here.port !== (port === '8091' ? '8093' : '8091')) return undefined;
    return 'http://' + here.hostname + ':' + port;
}

type DemoStep = { status: ReportStatus; reason?: string };
function isStatus(value: unknown): value is ReportStatus {
    return statusKeys.includes(value as ReportStatus);
}

export function readDemoTrail(id: number): DemoStep[] | undefined {
    const raw = localStorage.getItem(statusPrefix + id);
    if (!raw) return;
    // Earlier previews stored a single status or an array of status strings.
    if (isStatus(raw)) return [{ status: raw }];
    try {
        const stored: unknown = JSON.parse(raw);
        if (!Array.isArray(stored) || !stored.length) return;
        const trail: DemoStep[] = [];
        for (const step of stored) {
            if (isStatus(step)) trail.push({ status: step });
            else if (step && isStatus(step.status)) {
                const reason = step.status === 'REJECTED' && typeof step.reason === 'string' ? step.reason.trim().slice(0, 2000) : '';
                trail.push(reason ? { status: step.status, reason } : { status: step.status });
            } else return;
        }
        return trail;
    } catch {
        /* Ignore invalid optional browser state. */
    }
}
export function readDemoStatuses(): PreviewStatuses {
    const statuses: PreviewStatuses = {};
    for (const row of records) {
        const current = readDemoTrail(row.protocol)?.at(-1)?.status;
        if (current) statuses[row.protocol] = current;
    }
    return statuses;
}
export function writeDemoStatus(id: number, status: ReportStatus, reason?: string) {
    const base = records.find((row) => row.protocol === id);
    if (!base) return false;
    const trail = readDemoTrail(id) ?? base.statusTrail.map((status) => ({ status }));
    if (!allowedManagerTargets(trail.at(-1)!.status, trail.at(-2)?.status).includes(status)) return false;
    const step = status === 'REJECTED' && reason ? { status, reason: reason.trim().slice(0, 2000) } : { status };
    localStorage.setItem(statusPrefix + id, JSON.stringify([...trail, step]));
    return true;
}
export function readDemoConfirmations() {
    return records.filter((row) => !row.mine && localStorage.getItem(votePrefix + row.protocol) === '1').map((row) => row.protocol);
}

export function writeDemoConfirmation(id: number, desired: boolean) {
    const row = records.find((item) => item.protocol === id);
    if (!row || row.mine || !pending(readDemoStatuses()[id] ?? row.status)) return false;
    if (desired) localStorage.setItem(votePrefix + id, '1');
    else localStorage.removeItem(votePrefix + id);
    return true;
}

export function watchDemoConfirmations(change: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.storageArea === localStorage && (event.key === null || event.key.startsWith(votePrefix) || event.key.startsWith(statusPrefix))) change();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
}
