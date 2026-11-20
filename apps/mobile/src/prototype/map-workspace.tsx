import { useRef, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { ReportStatus } from '@mycity/contracts';
import { Text } from '../components/typography';
import { activeStatuses } from '../report-filters';
import { statusLabels } from '../report-overview';
import { categories, categoryName, type Category } from './fixtures';
import { Button, CaseCard, s } from './presentation';
import { ChoiceField } from './choice-field';
import { PrototypeMap, type PrototypeMapProps } from './prototype-map';

export type MapFilters = { category?: Category; status?: ReportStatus };

const categoryOptions = [{ value: 'all' as const, label: 'Todas' }, ...categories.map((value) => ({ value, label: categoryName(value) }))];
const statusOptions = [{ value: 'active' as const, label: 'Ativas' }, ...[...activeStatuses, 'RESOLVED' as const].map((value) => ({ value, label: statusLabels[value] }))];

export function MapWorkspace({
    records,
    region,
    selectedGroup,
    open,
    filters,
    change,
    loading,
    failed,
    retry,
}: PrototypeMapProps & {
    filters: MapFilters;
    change: (value: MapFilters) => void;
    loading: boolean;
    failed: boolean;
    retry: () => void;
}) {
    const categoryTrigger = useRef<ComponentRef<typeof View>>(null);
    const category = filters.category ?? 'all';
    const status = filters.status ?? 'active';
    const hasFilters = category !== 'all' || status !== 'active';
    const summary = [category === 'all' ? 'Todas as categorias' : categoryName(category), status === 'active' ? 'Ativas' : statusLabels[status]].join(' · ');
    function apply(nextCategory: Category | 'all', nextStatus: ReportStatus | 'active') {
        const next: MapFilters = {};
        if (nextCategory !== 'all') next.category = nextCategory;
        if (nextStatus !== 'active') next.status = nextStatus;
        change(next);
    }
    const visible = records.filter((item) => (!filters.category || item.category === filters.category) && (filters.status ? item.status === filters.status : activeStatuses.includes(item.status)));
    return (
        <>
            <View style={styles.filters}>
                <View style={[s.topline, styles.filterHeading]}>
                    <Text accessibilityRole="header" style={[hasFilters ? styles.summary : s.heading, styles.grow]}>
                        {hasFilters ? summary : 'Filtros do mapa'}
                    </Text>
                    {hasFilters && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Limpar filtros"
                            onPress={() => {
                                change({});
                                categoryTrigger.current?.focus();
                            }}
                            style={({ pressed }) => [styles.clear, pressed && s.pressed]}
                        >
                            <Text style={styles.clearText}>Limpar</Text>
                        </Pressable>
                    )}
                </View>
                <View style={styles.fields}>
                    <View style={styles.field}>
                        <ChoiceField triggerRef={categoryTrigger} label="Categoria" placeholder="Todas" value={category} options={categoryOptions} onChange={(value) => apply(value, status)} />
                    </View>
                    <View style={styles.field}>
                        <ChoiceField label="Situação" placeholder="Ativas" value={status} options={statusOptions} onChange={(value) => apply(category, value)} />
                    </View>
                </View>
            </View>
            {loading ? (
                <View style={s.notice}>
                    <ActivityIndicator />
                    <Text accessibilityLiveRegion="polite" style={s.meta}>
                        Carregando denúncias…
                    </Text>
                </View>
            ) : failed ? (
                <View style={s.card}>
                    <Text style={s.text}>Não foi possível carregar as ocorrências do mapa.</Text>
                    <Button label="Tentar novamente" onPress={retry} />
                </View>
            ) : (
                <>
                    <PrototypeMap records={visible} region={region} selectedGroup={selectedGroup} open={open} />
                    <View style={[s.listHeading, styles.results]}>
                        <Text accessibilityRole="header" style={s.heading}>
                            Ocorrências do filtro
                        </Text>
                        <Text accessibilityLiveRegion="polite" style={s.meta}>
                            {visible.length} {visible.length === 1 ? 'registro' : 'registros'}
                        </Text>
                    </View>
                    {visible.length ? (
                        visible.map((record) => <CaseCard key={record.id} item={record} onPress={() => open(record)} />)
                    ) : (
                        <View style={s.notice}>
                            <Text style={[s.text, s.grow]}>Nenhuma ocorrência encontrada.</Text>
                        </View>
                    )}
                </>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    filters: { gap: 2 },
    grow: { flex: 1, minWidth: 0 },
    summary: { fontWeight: '700', fontSize: 14, lineHeight: 19, color: '#1b3952' },
    fields: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    field: { flex: 1, minWidth: 0 },
    clear: { minHeight: 44, minWidth: 48, justifyContent: 'center', paddingLeft: 9 },
    clearText: { fontSize: 14, fontWeight: '700', color: '#24578e' },
    filterHeading: { minHeight: 44 },
    results: { marginTop: 5 },
});
