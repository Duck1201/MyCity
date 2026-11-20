import { useCallback, type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './components/typography';
import { reportCategoryLabels, type ReportCategoryOption } from '@mycity/contracts';
import { useActiveQuery } from './use-active-query';
import type { CitizenRequest } from './citizen-api';
import { ActionButton } from './components/action-button';
import { mobileStyles } from './theme';

export function categoryLabel(item: { category: string; categoryName?: string | undefined }) {
    return item.categoryName ?? reportCategoryLabels[item.category] ?? 'Categoria indisponível';
}

export function CategoryCatalog({ request, children, activeOnly = false }: { activeOnly?: boolean; request: CitizenRequest; children: (categories: ReportCategoryOption[]) => ReactNode }) {
    const load = useCallback((signal: AbortSignal) => request<{ data: ReportCategoryOption[] }>('/categories', signal), [request]);
    const catalog = useActiveQuery(load, true, '/categories');
    const options = catalog.data?.data.filter((option) => !activeOnly || !option.archived);
    return (
        <>
            {catalog.failed && (
                <View style={mobileStyles.message}>
                    <Text accessibilityLiveRegion="polite">Não foi possível atualizar as categorias.</Text>
                    <ActionButton variant="secondary" label="Tentar carregar categorias" onPress={catalog.retry} />
                </View>
            )}
            {!catalog.failed && !catalog.data && (
                <Text style={mobileStyles.meta} accessibilityLiveRegion="polite">
                    Carregando categorias…
                </Text>
            )}
            {options?.length === 0 && <Text style={mobileStyles.meta}>{activeOnly ? 'Nenhuma categoria disponível para registro.' : 'Nenhuma categoria cadastrada.'}</Text>}
            {options && children(options)}
        </>
    );
}
