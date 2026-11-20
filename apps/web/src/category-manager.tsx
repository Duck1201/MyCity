import { usePanelLoading } from './panel-loading';
import { useEffect, useRef } from 'react';
import { categoryIconFor, type ReportCategoryOption } from '@mycity/contracts';
import { useCategoryCatalog } from './category-catalog';
import { CategoryCatalogView, type CategoryChange } from './prototype/catalog';

type Props = { onSessionExpired: () => void; onCreated?: (category: ReportCategoryOption) => void };

export function CategoryManager({ onSessionExpired, onCreated }: Props) {
    const catalog = useCategoryCatalog(onSessionExpired);
    usePanelLoading(!catalog.data && !catalog.failed);
    const request = useRef<AbortController | null>(null);
    useEffect(() => () => request.current?.abort(), []);
    const items = catalog.data?.data ?? [];
    const totals = new Map(items.map((item) => [item.id, item.reportCount]));
    async function save(id: string | undefined, payload: CategoryChange) {
        const controller = new AbortController();
        request.current = controller;
        let response: Response;
        try {
            response = await fetch(id ? '/api/v1/categories/' + encodeURIComponent(id) : '/api/v1/categories', {
                method: id ? 'PATCH' : 'POST',
                credentials: 'same-origin',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json', 'X-MyCity-Client': 'web' },
                body: JSON.stringify(payload),
            });
        } catch {
            throw new Error('Não foi possível confirmar a gravação. Confira a lista antes de tentar novamente.');
        }
        if (response.status === 401) {
            onSessionExpired();
            throw new Error('A sessão expirou.');
        }
        if (response.status === 409 || response.status === 404) {
            catalog.refresh();
            throw new Error(response.status === 409 ? 'Já existe uma categoria com esse nome.' : 'A categoria não está mais disponível.');
        }
        if (response.status === 422) throw new Error('Confira o nome e o ícone da categoria.');
        if (!response.ok) throw new Error('Não foi possível confirmar a gravação. Confira a lista antes de tentar novamente.');
        const { data } = (await response.json()) as { data: ReportCategoryOption };
        if (controller.signal.aborted) return;
        catalog.replace({ data: id ? items.map((item) => (item.id === id ? { ...item, ...data } : item)) : [...items, { ...data, reportCount: 0 }] });
        catalog.refresh();
        if (!id) onCreated?.(data);
    }
    return (
        <main aria-label="Catálogo de categorias">
            <CategoryCatalogView
                items={items.map((item) => ({ ...item, archived: !!item.archived, icon: categoryIconFor(item.id, item.icon) }))}
                count={(id) => totals.get(id)}
                save={save}
                loading={!catalog.data}
                feedback={
                    catalog.failed ? (
                        <p className="catalog-error" role="alert">
                            Não foi possível atualizar as categorias.{' '}
                            <button type="button" onClick={catalog.refresh}>
                                Tentar novamente
                            </button>
                        </p>
                    ) : (
                        !catalog.data && <p role="status">Carregando categorias…</p>
                    )
                }
            />
        </main>
    );
}
