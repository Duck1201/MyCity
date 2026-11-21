import { colors, mobileStyles } from './theme';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './components/typography';
import type { ReportDetail } from '@mycity/contracts';
import { ActionButton } from './components/action-button';

import { ApiFailure, type CitizenRequest } from './citizen-api';
const actionPaths = {
    edit: 'm14 5 5 5 M4 20l5-1L21 7l-5-5L4 14z',
    share: 'M12 16V3m-5 5 5-5 5 5 M5 13v7h14v-7',
    cancel: 'M8 8l8 8m0-8-8 8 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    reopen: 'M3 12a9 9 0 1 1 2.6 6.4 M3 4v8h8',
    close: 'm6 6 12 12m0-12L6 18',
};
function Glyph({ name, color = colors.ink }: { name: keyof typeof actionPaths | 'more'; color?: string }) {
    return (
        <Svg aria-hidden focusable={false} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            {name === 'more' ? [5, 12, 19].map((cx) => <Circle key={cx} cx={cx} cy={12} r={1.5} fill={color} />) : <Path d={actionPaths[name]} />}
        </Svg>
    );
}
function ActionRow({ label, icon, onPress, danger = false, disabled = false }: { label: string; icon: keyof typeof actionPaths; onPress: () => void; danger?: boolean; disabled?: boolean }) {
    return (
        <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
            <Glyph name={icon} color={danger ? colors.danger : colors.ink} />
            <Text style={[styles.rowText, danger && styles.danger]}>{label}</Text>
        </Pressable>
    );
}

export function ReportActions({ detail, edit, request, update, refresh, notify }: { edit: () => void; detail: ReportDetail; request: CitizenRequest; update: (report: ReportDetail) => void; refresh: () => void; notify: (message: string) => void }) {
    const [menu, setMenu] = useState<'options' | number | null>(null);
    const [busy, setBusy] = useState(false);
    const pending = useRef<AbortController | null>(null);
    useEffect(() => () => pending.current?.abort(), []);
    const actions = detail.allowedActions ?? [];
    const canEdit = actions.includes('EDIT'),
        canReopen = actions.includes('REOPEN'),
        canCancel = actions.includes('CANCEL');
    const canShare = detail.status !== 'CANCELED';
    const hasOptions = canEdit || canCancel || canReopen || canShare;
    useEffect(() => {
        if (!hasOptions) setMenu(null);
    }, [hasOptions]);
    function share() {
        setMenu(null);
        notify('');
        void Share.share({ message: 'mycity://reports/' + encodeURIComponent(detail.id) }).catch(() => notify('Não foi possível compartilhar o link.'));
    }
    async function change(action: 'cancellation' | 'reopening', expectedVersion: number) {
        if (pending.current) return;
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        notify('');
        try {
            const root = '/reports/' + encodeURIComponent(detail.id);
            const { data } = await request<{ data: ReportDetail }>(root + '/' + action, controller.signal, 'POST', { expectedVersion });
            if (controller.signal.aborted) return;
            update(data);
            notify(action === 'reopening' ? 'Denúncia reaberta.' : 'Denúncia cancelada.');
        } catch (error) {
            if (!controller.signal.aborted) notify(error instanceof ApiFailure && [403, 404, 409].includes(error.status) ? 'A situação da denúncia mudou. Consulte a atualização.' : 'Não foi possível confirmar a operação. Confira a denúncia antes de tentar novamente.');
        } finally {
            if (!controller.signal.aborted) {
                pending.current = null;
                setBusy(false);
                setMenu(null);
                refresh();
            }
        }
    }
    if (!hasOptions) return null;
    return (
        <>
            <Pressable accessibilityRole="button" accessibilityLabel="Ações da denúncia" accessibilityState={{ expanded: menu !== null }} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={() => setMenu('options')}>
                <Glyph name="more" />
            </Pressable>
            {menu !== null && (
                <Modal visible transparent onRequestClose={() => setMenu(null)}>
                    <View style={styles.backdrop}>
                        <Pressable accessible={false} focusable={false} importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} />
                        <SafeAreaView edges={['bottom']} accessibilityViewIsModal style={styles.sheet}>
                            <ScrollView bounces={false} contentContainerStyle={styles.sheetContent}>
                                <View style={styles.sheetHeader}>
                                    <Text accessibilityRole="header" style={[mobileStyles.heading, styles.heading]}>
                                        {typeof menu === 'number' && canCancel ? 'Cancelar esta denúncia?' : 'Ações da denúncia'}
                                    </Text>
                                    <Pressable accessibilityRole="button" accessibilityLabel="Fechar" style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={() => setMenu(null)}>
                                        <Glyph name="close" />
                                    </Pressable>
                                </View>
                                {typeof menu === 'number' && canCancel ? (
                                    <>
                                        <Text style={mobileStyles.body}>Ela sairá do feed e do mapa e continuará na sua lista de registros.</Text>
                                        <ActionButton variant="secondary" label="Manter denúncia" pending={busy} onPress={() => setMenu(null)} />
                                        <ActionButton variant="danger" label="Confirmar cancelamento" pending={busy} onPress={() => void change('cancellation', menu)} />
                                    </>
                                ) : (
                                    <>
                                        {canEdit && (
                                            <ActionRow
                                                label="Editar denúncia"
                                                icon="edit"
                                                onPress={() => {
                                                    setMenu(null);
                                                    edit();
                                                }}
                                            />
                                        )}
                                        {detail.isMine && !canEdit && <Text style={mobileStyles.meta}>A edição termina quando o gestor responde ou altera a situação da denúncia.</Text>}
                                        {canShare && <ActionRow label="Compartilhar link" icon="share" onPress={share} />}
                                        {canReopen && <ActionRow label={canEdit ? 'Reabrir sem editar' : 'Reabrir denúncia'} icon="reopen" disabled={busy} onPress={() => void change('reopening', detail.version)} />}
                                        {canCancel && (
                                            <ActionRow
                                                label="Cancelar denúncia"
                                                icon="cancel"
                                                danger
                                                disabled={busy}
                                                onPress={() => {
                                                    notify('');
                                                    setMenu(detail.version);
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                            </ScrollView>
                        </SafeAreaView>
                    </View>
                </Modal>
            )}
        </>
    );
}
const styles = StyleSheet.create({
    iconButton: { alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 24 },
    pressed: { backgroundColor: colors.pale },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 46, 74, 0.42)' },
    sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, paddingBottom: 4 },
    heading: { flex: 1 },
    sheetContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16, gap: 4 },
    row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 10, gap: 14 },
    rowText: { flexShrink: 1, color: colors.ink, fontSize: 16, fontWeight: '600' },
    danger: { color: colors.danger },
});
