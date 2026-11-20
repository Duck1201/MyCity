import { categoryLabel, CategoryCatalog } from './category-catalog';
import type { CitizenRequest } from './citizen-api';
import { colors, mobileStyles } from './theme';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './components/typography';
import { type ReportCategory, type ReportStatus } from '@mycity/contracts';
import { statusLabels } from './report-overview';

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
        <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.selected]}>
            <Text style={selected ? styles.chosen : styles.optionText}>{label}</Text>
        </Pressable>
    );
}
export function Filters({ request, filters, statuses, onChange }: { request: CitizenRequest; filters: ReportFilters; statuses: readonly ReportStatus[]; onChange: (filters: ReportFilters) => void }) {
    const [expanded, setExpanded] = useState(false);
    const labels = [filters.category && categoryLabel({ category: filters.category, categoryName: filters.categoryName }), filters.status && statusLabels[filters.status]].filter(Boolean);
    return (
        <View style={styles.section}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }} style={styles.toggle} onPress={() => setExpanded(!expanded)}>
                <Text style={styles.chosen}>Filtros</Text>
                {!!labels.length && <Text style={mobileStyles.meta}>{labels.join(' · ')}</Text>}
            </Pressable>
            {expanded && (
                <>
                    <Text style={styles.label}>Categoria</Text>
                    <View style={styles.choices}>
                        <Choice label="Todas as categorias" selected={!filters.category} onPress={() => onChange({ ...filters, category: undefined, categoryName: undefined })} />
                        <CategoryCatalog request={request}>{(categories) => categories.map(({ id: category, name }) => <Choice key={category} label={name} selected={filters.category === category} onPress={() => onChange({ ...filters, category, categoryName: name })} />)}</CategoryCatalog>
                    </View>
                    {!!statuses.length && (
                        <>
                            <Text style={styles.label}>Situação</Text>
                            <View style={styles.choices}>
                                <Choice label="Todas as situações" selected={!filters.status} onPress={() => onChange({ ...filters, status: undefined })} />
                                {statuses.map((status) => (
                                    <Choice key={status} label={statusLabels[status]} selected={filters.status === status} onPress={() => onChange({ ...filters, status })} />
                                ))}
                            </View>
                        </>
                    )}
                </>
            )}
        </View>
    );
}
const styles = StyleSheet.create({
    section: { gap: 8 },
    toggle: { alignSelf: 'flex-start', alignContent: 'center', paddingHorizontal: 14, minHeight: 48, borderColor: colors.line, borderWidth: 1, borderRadius: 8, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    label: mobileStyles.label,
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    choice: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface },
    selected: { backgroundColor: colors.pale, borderColor: colors.teal },
    chosen: { color: colors.teal, fontWeight: '700' },
    optionText: { color: colors.ink, fontSize: 15 },
});
