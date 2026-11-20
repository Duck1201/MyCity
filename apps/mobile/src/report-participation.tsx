import { colors, mobileStyles } from './theme';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './components/typography';
import type { ReportDetail } from '@mycity/contracts';
import { ActionButton } from './components/action-button';

import { ApiFailure, type CitizenRequest } from './citizen-api';
import { ApiConfirmation, type ConfirmedVote } from './report-confirmation';

export function Participation({ detail, request, update, refresh, updateVote }: { detail: ReportDetail; request: CitizenRequest; update: (report: ReportDetail) => void; refresh: () => void; updateVote: (vote: ConfirmedVote) => void }) {
    const [question, setQuestion] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const pending = useRef<AbortController | null>(null);
    useEffect(() => () => pending.current?.abort(), []);
    const actions = detail.allowedActions ?? [];
    async function cancel() {
        if (pending.current) return;
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        setMessage('');
        try {
            const root = '/reports/' + encodeURIComponent(detail.id);
            const { data } = await request<{ data: ReportDetail }>(root + '/cancellation', controller.signal, 'POST', { expectedVersion: question });
            if (controller.signal.aborted) return;
            update(data);
            setMessage('Denúncia cancelada.');
        } catch (error) {
            if (!controller.signal.aborted) setMessage(error instanceof ApiFailure && [403, 404, 409].includes(error.status) ? 'A situação da denúncia mudou. Consulte a atualização.' : 'Não foi possível confirmar a operação. Confira a denúncia antes de tentar novamente.');
        } finally {
            if (!controller.signal.aborted) {
                pending.current = null;
                setBusy(false);
                setQuestion(null);
                refresh();
            }
        }
    }
    return (
        <View style={styles.section}>
            <ApiConfirmation report={detail} request={request} update={updateVote} refresh={refresh} allowedActions={actions} />
            {actions.includes('CANCEL') &&
                (question === null ? (
                    <ActionButton
                        variant="secondary"
                        label="Cancelar denúncia"
                        pending={busy}
                        onPress={() => {
                            setQuestion(detail.version);
                            setMessage('');
                        }}
                    />
                ) : (
                    <View style={styles.confirm}>
                        <Text style={mobileStyles.body}>Cancelar esta denúncia? Ela sairá do feed e do mapa e continuará na sua lista de registros.</Text>
                        <ActionButton variant="secondary" label="Manter denúncia" pending={busy} onPress={() => setQuestion(null)} />
                        <ActionButton variant="danger" label="Confirmar cancelamento" pending={busy} onPress={() => void cancel()} />
                    </View>
                ))}
            {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
        </View>
    );
}
const styles = StyleSheet.create({ section: { gap: 10 }, confirm: { padding: 14, gap: 8, backgroundColor: colors.dangerWash, borderLeftWidth: 3, borderColor: colors.danger } });
