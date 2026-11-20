import { StyleSheet } from 'react-native';
import type { ReportStatus } from '@mycity/contracts';

export const colors = {
    ink: '#182e4a',
    teal: '#23568e',
    deepTeal: '#182e4a',
    rail: '#103d4a',
    surface: '#ffffff',
    canvas: '#f8fafd',
    muted: '#526571',
    line: '#d4dfe3',
    pale: '#eaf2f5',
    danger: '#991b1b',
    dangerWash: '#fef2f2',
};

const statusTints: Record<ReportStatus, { color: string; backgroundColor: string }> = {
    SENT: { color: '#334155', backgroundColor: '#e9eef4' },
    UNDER_REVIEW: { color: '#075985', backgroundColor: '#e0f2fe' },
    IN_PROGRESS: { color: '#854d0e', backgroundColor: '#fef3c7' },
    RESOLVED: { color: '#166534', backgroundColor: '#dcfce7' },
    REJECTED: { color: colors.danger, backgroundColor: '#fee2e2' },
    CANCELED: { color: '#424752', backgroundColor: '#edeef1' },
};

export function statusTint(status: ReportStatus) {
    return statusTints[status];
}

export const mobileStyles = StyleSheet.create({
    page: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 30, gap: 12, backgroundColor: colors.canvas },
    title: { color: colors.ink, fontSize: 27, letterSpacing: -0.7, fontWeight: '700', marginBottom: 4 },
    heading: { color: colors.deepTeal, fontSize: 20, fontWeight: '700' },
    label: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    body: { color: colors.ink, fontSize: 16, lineHeight: 23 },
    meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    card: { padding: 16, gap: 8, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 12 },
    status: { alignSelf: 'flex-start', borderRadius: 6, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, fontSize: 14, fontWeight: '700' },
    message: { gap: 10, borderLeftWidth: 3, borderLeftColor: colors.teal, padding: 14, backgroundColor: colors.surface },
    error: { color: colors.danger, backgroundColor: colors.dangerWash, padding: 12, borderLeftWidth: 3, borderLeftColor: colors.danger, fontSize: 15 },
});
