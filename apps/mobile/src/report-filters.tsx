import { categoryLabel, CategoryCatalog } from './category-catalog';
import type { CitizenRequest } from './citizen-api';
import { colors, mobileStyles } from './theme';
import { type ReactNode, createContext, useContext, useLayoutEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './components/typography';
import { MotionPressable } from './components/motion-pressable';
import { useMotionEnabled } from './components/use-motion-enabled';
import { ActionButton } from './components/action-button';
import { Icon } from './prototype/civic-header';
import { type ReportCategory, type ReportStatus } from '@mycity/contracts';
import { statusLabels } from './report-overview';

export const FilterVisibilityContext = createContext<(open: boolean) => void>(() => {});

export type ReportFilters = { category?: ReportCategory | undefined; categoryName?: string | undefined; status?: ReportStatus | undefined };
export const activeStatuses: ReportStatus[] = ['SENT', 'UNDER_REVIEW', 'IN_PROGRESS'];
export function filteredPath(path: string, filters: ReportFilters) {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.status) params.set('status', filters.status);
    return params.toString() ? path + (path.includes('?') ? '&' : '?') + params.toString() : path;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
    return (
        <MotionPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.selected]}>
            <Text style={[styles.optionText, selected && styles.chosen]}>{label}</Text>
            <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.dot} />}</View>
        </MotionPressable>
    );
}
function Field({ label, value, expanded, toggle, children }: { label: string; value: string; expanded: boolean; toggle: () => void; children: ReactNode }) {
    return (
        <View style={styles.field}>
            <MotionPressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: value }} accessibilityState={{ expanded }} onPress={toggle} style={styles.fieldRow}>
                <View style={styles.fieldText}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <Text style={styles.fieldValue}>{value}</Text>
                </View>
                <Text accessible={false} style={styles.chevron}>
                    {expanded ? '−' : '⌄'}
                </Text>
            </MotionPressable>
            {expanded && <View style={styles.choices}>{children}</View>}
        </View>
    );
}

export function Filters({ request, filters, statuses, onChange }: { request: CitizenRequest; filters: ReportFilters; statuses: readonly ReportStatus[]; onChange: (filters: ReportFilters) => void }) {
    const [draft, setDraft] = useState<ReportFilters | null>(null);
    const [field, setField] = useState<'category' | 'status' | null>(null);
    function choose(next: ReportFilters) {
        setDraft(next);
        setField(null);
    }
    const motion = useMotionEnabled();
    const notify = useContext(FilterVisibilityContext);
    const opened = !!draft;
    useLayoutEffect(() => {
        if (!opened) return;
        notify(true);
        return () => notify(false);
    }, [opened, notify]);
    const labels = [filters.category && categoryLabel({ category: filters.category, categoryName: filters.categoryName }), filters.status && statusLabels[filters.status]].filter(Boolean);
    return (
        <>
            <MotionPressable accessibilityRole="button" accessibilityLabel={labels.length ? 'Filtros: ' + labels.join(', ') : 'Filtros'} accessibilityState={{ expanded: !!draft }} style={[styles.toggle, labels.length > 0 && styles.selected]} onPress={() => choose(filters)}>
                <Icon name="settings" size={18} />
                <Text numberOfLines={1} style={[styles.chosen, styles.summary]}>
                    {labels.length ? labels.join(' · ') : 'Filtros'}
                </Text>
            </MotionPressable>
            {draft && (
                <Modal visible transparent animationType={motion ? 'slide' : 'none'} onRequestClose={() => (field ? setField(null) : setDraft(null))}>
                    <View style={styles.backdrop}>
                        <Pressable accessible={false} importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={() => setDraft(null)} />
                        <SafeAreaView edges={['bottom']} accessibilityViewIsModal style={styles.sheet}>
                            <View style={styles.header}>
                                <Text accessibilityRole="header" style={mobileStyles.heading}>
                                    Filtrar denúncias
                                </Text>
                                <MotionPressable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={() => setDraft(null)} style={styles.close}>
                                    <Text style={styles.closeText}>×</Text>
                                </MotionPressable>
                            </View>
                            <ScrollView style={styles.options} contentContainerStyle={styles.section}>
                                <Field label="Categoria" value={draft.category ? categoryLabel({ category: draft.category, categoryName: draft.categoryName }) : 'Todas as categorias'} expanded={field === 'category'} toggle={() => setField(field === 'category' ? null : 'category')}>
                                    <Choice label="Todas as categorias" selected={!draft.category} onPress={() => choose({ ...draft, category: undefined, categoryName: undefined })} />
                                    <CategoryCatalog request={request}>{(categories) => categories.map(({ id: category, name }) => <Choice key={category} label={name} selected={draft.category === category} onPress={() => choose({ ...draft, category, categoryName: name })} />)}</CategoryCatalog>
                                </Field>
                                {!!statuses.length && (
                                    <Field label="Situação" value={draft.status ? statusLabels[draft.status] : 'Todas as situações'} expanded={field === 'status'} toggle={() => setField(field === 'status' ? null : 'status')}>
                                        <Choice label="Todas as situações" selected={!draft.status} onPress={() => choose({ ...draft, status: undefined })} />
                                        {statuses.map((status) => (
                                            <Choice key={status} label={statusLabels[status]} selected={draft.status === status} onPress={() => choose({ ...draft, status })} />
                                        ))}
                                    </Field>
                                )}
                            </ScrollView>
                            <View style={styles.actions}>
                                <MotionPressable accessibilityRole="button" accessibilityLabel="Limpar" disabled={!draft.category && !draft.status} accessibilityState={{ disabled: !draft.category && !draft.status }} onPress={() => choose({})} style={[styles.clear, !draft.category && !draft.status && styles.disabledClear]}>
                                    <Text style={styles.clearText}>Limpar</Text>
                                </MotionPressable>
                                <View style={styles.apply}>
                                    <ActionButton
                                        label="Aplicar filtros"
                                        onPress={() => {
                                            onChange(draft);
                                            setDraft(null);
                                        }}
                                    />
                                </View>
                            </View>
                        </SafeAreaView>
                    </View>
                </Modal>
            )}
        </>
    );
}
const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 46, 74, 0.42)' },
    sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18, paddingVertical: 10 },
    options: { flexGrow: 0, flexShrink: 1 },
    section: { gap: 12, paddingHorizontal: 18, paddingVertical: 8 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: colors.line },
    toggle: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 8, minHeight: 48, borderColor: colors.line, borderWidth: 1, borderRadius: 8, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8 },
    summary: { flexShrink: 1 },
    field: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden' },
    fieldRow: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
    fieldText: { flex: 1 },
    fieldLabel: { fontSize: 13, color: colors.muted },
    fieldValue: { fontSize: 17, fontWeight: '700', color: colors.ink },
    chevron: { fontSize: 21, color: colors.muted },
    close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    closeText: { fontSize: 28, color: colors.muted },
    choices: { borderTopWidth: 1, borderColor: colors.line },
    choice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
    clear: { minHeight: 48, minWidth: 96, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.pale, borderWidth: 1, borderColor: colors.teal },
    clearText: { fontSize: 16, fontWeight: '700', color: colors.teal },
    disabledClear: { opacity: 0.5 },
    apply: { flexGrow: 1 },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    radioOn: { borderColor: colors.teal },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal },
    selected: { backgroundColor: colors.pale, borderColor: colors.teal },
    chosen: { color: colors.teal, fontWeight: '700' },
    optionText: { flexShrink: 1, color: colors.ink, fontSize: 15 },
});
