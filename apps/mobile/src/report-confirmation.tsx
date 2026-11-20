import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ReportSummary } from '@mycity/contracts';
import { ApiFailure, type CitizenRequest } from './citizen-api';
import { Text } from './components/typography';
import { activeStatuses } from './report-filters';
import { colors } from './theme';

export const confirmationLabel = (count: number) => (count === 1 ? '1 confirmação' : count + ' confirmações');
type ConfirmationReport = Pick<ReportSummary, 'confirmationCount' | 'confirmedByMe' | 'isMine' | 'status'>;
type Props = { report: ConfirmationReport; context?: string; allowedActions?: string[]; onChange: (confirmed: boolean, signal: AbortSignal) => Promise<void>; refresh?: () => void; onError?: (message: string) => void };
export function ReportConfirmation({ report, allowedActions, onChange, refresh, context, onError }: Props) {
    const pending = useRef<AbortController | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    useEffect(() => () => pending.current?.abort(), []);
    const canChange = report.isMine === false && activeStatuses.includes(report.status) && (!allowedActions || allowedActions.includes(report.confirmedByMe ? 'WITHDRAW' : 'CONFIRM'));
    const label = report.confirmedByMe ? 'Retirar confirmação' : 'Também vi isso';
    async function submit() {
        if (!canChange || pending.current) return;
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        setMessage('');
        try {
            const confirmed = !report.confirmedByMe;
            await onChange(confirmed, controller.signal);
            if (!controller.signal.aborted) setMessage(confirmed ? 'Confirmação registrada.' : 'Confirmação retirada.');
        } catch (error) {
            if (!controller.signal.aborted) {
                const reason = error instanceof ApiFailure && [403, 404, 409].includes(error.status) ? 'A situação da denúncia mudou. Consulte a atualização.' : 'Não foi possível confirmar a operação. Confira a denúncia antes de tentar novamente.';
                setMessage(reason);
                onError?.(reason);
            }
        } finally {
            if (!controller.signal.aborted) {
                pending.current = null;
                setBusy(false);
                refresh?.();
            }
        }
    }
    return (
        <View style={styles.section}>
            <View style={styles.row}>
                {canChange && (
                    <Pressable accessibilityRole="button" accessibilityLabel={context ? label + ', ' + context : label} accessibilityState={{ disabled: busy, busy, selected: report.confirmedByMe }} disabled={busy} onPress={submit} style={({ pressed }) => [styles.button, report.confirmedByMe && styles.selected, (pressed || busy) && styles.pressed]}>
                        <Svg width={17} height={17} viewBox="0 0 24 24" stroke={colors.teal} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" {...(Platform.OS !== 'web' && { accessible: false })} aria-hidden focusable={false}>
                            <Path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
                            <Path d="M7 10v12" />
                        </Svg>
                        <Text style={styles.action}>{label}</Text>
                    </Pressable>
                )}
                <Text style={styles.count}>{confirmationLabel(report.confirmationCount)}</Text>
                {report.isMine ? <Text style={styles.count}>Sua denúncia</Text> : !activeStatuses.includes(report.status) && <Text style={styles.count}>Confirmações encerradas</Text>}
            </View>
            {!!message && (
                <Text accessibilityLiveRegion="polite" style={styles.feedback}>
                    {message}
                </Text>
            )}
        </View>
    );
}
export type ConfirmedVote = Pick<ReportSummary, 'confirmationCount' | 'confirmedByMe'>;
export function ApiConfirmation({ report, request, update, refresh, allowedActions, onError }: { report: ReportSummary; request: CitizenRequest; update: (vote: ConfirmedVote) => void; refresh: () => void; allowedActions?: string[]; onError?: (message: string) => void }) {
    async function change(confirmed: boolean, signal: AbortSignal) {
        const { data } = await request<{ data: { confirmed: boolean; confirmationCount: number } }>('/reports/' + encodeURIComponent(report.id) + '/confirmation', signal, confirmed ? 'PUT' : 'DELETE');
        if (!signal.aborted) update({ confirmedByMe: data.confirmed, confirmationCount: data.confirmationCount });
    }
    return <ReportConfirmation report={report} onChange={change} refresh={refresh} {...(onError && { onError })} {...(allowedActions ? { allowedActions } : { context: report.description })} />;
}
const styles = StyleSheet.create({
    section: { gap: 4 },
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10 },
    selected: { backgroundColor: colors.pale, borderColor: colors.teal },
    pressed: { opacity: 0.7 },
    action: { color: colors.teal, fontSize: 14, fontWeight: '700' },
    count: { color: colors.muted, fontSize: 14, fontWeight: '600' },
    feedback: { color: colors.ink, fontSize: 14 },
});
