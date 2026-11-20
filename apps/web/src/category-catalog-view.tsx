import { CategoryIconPicker } from './category-icon-picker';
import { useRef, useState, type ReactNode } from 'react';
import { createCategorySchema, type CategoryIconKey } from '@mycity/contracts';
import { Dialog } from 'radix-ui';
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, Pencil, Plus, Search } from 'lucide-react';
import './category-catalog-view.css';
import './category-manager.css';
import { CategorySymbol, iconChoices, type CategoryIcon } from './components/category-symbol';
import { Link, queueUrl } from './navigation';

function searchableName(value: string) {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

export type Category = { id: string; name: string; icon: CategoryIcon; archived: boolean };
export type CategoryChange = { name: string; icon: CategoryIconKey } | { archived: boolean };
type ViewProps = { items: Category[]; count: (id: string) => number | undefined; save: (id: string | undefined, payload: CategoryChange) => void | Promise<void>; feedback?: ReactNode; loading?: boolean };
export function CategoryCatalogView({ items, count, save, feedback, loading }: ViewProps) {
    const [saving, setSaving] = useState(false);
    const pending = useRef(false);
    const opener = useRef<HTMLButtonElement>(null);
    const archiveToggle = useRef<HTMLButtonElement>(null);
    const cancel = useRef<HTMLButtonElement>(null);
    const restored = useRef<string | null>(null);
    const [editing, setEditing] = useState<Category>();
    const editTrigger = useRef<HTMLButtonElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [add, setAdd] = useState(false);
    const [icon, setIcon] = useState<CategoryIcon>('road');
    const [name, setName] = useState('');
    const [selected, setSelected] = useState<Category>();
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [query, setQuery] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const term = searchableName(query);
    const matches = items.filter((item) => searchableName(item.name).includes(term));
    const active = matches.filter((item) => !item.archived);
    const archived = matches.filter((item) => item.archived);
    const parsed = createCategorySchema.safeParse({ name, icon });
    const validation = name.trim() && !parsed.success ? 'Use até 80 caracteres com pelo menos uma letra ou número.' : '';
    async function submit(id: string | undefined, payload: CategoryChange, success: () => void) {
        if (pending.current) return;
        pending.current = true;
        setSaving(true);
        setError('');
        try {
            await save(id, payload);
            success();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar a gravação. Confira a lista antes de tentar novamente.');
        } finally {
            pending.current = false;
            setSaving(false);
        }
    }
    function categoryList(categories: Category[]) {
        return (
            <ul className="catalog-group-list">
                {categories.map((item) => {
                    const verb = item.archived ? 'Reativar' : 'Arquivar';
                    const Icon = item.archived ? ArchiveRestore : Archive;
                    const volumeCount = count(item.id);
                    const volume = volumeCount === undefined ? 'Ver denúncias' : volumeCount === 1 ? '1 denúncia' : volumeCount + ' denúncias';
                    return (
                        <li key={item.id}>
                            <div className="catalog-identity">
                                <span className="catalog-mark" data-icon={item.icon}>
                                    <CategorySymbol icon={item.icon} size={21} />
                                </span>
                                <strong>{item.name}</strong>
                            </div>
                            <Link className="catalog-volume" href={queueUrl({ category: item.id })} aria-label={volume + ' de ' + item.name}>
                                <span>
                                    {volume}
                                    <ChevronRight size={14} aria-hidden="true" />
                                </span>
                            </Link>
                            <div className="catalog-actions">
                                <button
                                    type="button"
                                    aria-label={'Editar ' + item.name}
                                    onClick={(e) => {
                                        editTrigger.current = e.currentTarget;
                                        setEditing(item);
                                        setIcon(item.icon);
                                        setName(item.name);
                                        setError('');
                                        setNotice('');
                                        setAdd(true);
                                    }}
                                >
                                    <Pencil size={15} aria-hidden="true" />
                                    Editar
                                </button>
                                <button
                                    id={'category-action-' + item.id}
                                    aria-label={verb + ' ' + item.name}
                                    onClick={(event) => {
                                        opener.current = event.currentTarget;
                                        restored.current = null;
                                        setNotice('');
                                        setError('');
                                        setSelected(item);
                                    }}
                                >
                                    <Icon size={15} aria-hidden="true" />
                                    {verb}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    }
    return (
        <div className="catalog-workspace">
            <header className="page-title catalog-heading">
                <h1>Categorias</h1>
                <Dialog.Root
                    open={add}
                    onOpenChange={(value) => {
                        if (pending.current) return;
                        setAdd(value);
                        setName('');
                        setError('');
                        if (value) {
                            setSelected(undefined);
                            setEditing(undefined);
                            const counts = new Map<CategoryIcon, number>();
                            for (const category of items) counts.set(category.icon, (counts.get(category.icon) ?? 0) + 1);
                            setIcon(iconChoices.reduce((least, choice) => ((counts.get(choice) ?? 0) < (counts.get(least) ?? 0) ? choice : least)));
                            editTrigger.current = null;
                        }
                    }}
                >
                    <Dialog.Trigger disabled={loading} className="primary">
                        <Plus size={17} aria-hidden="true" />
                        Adicionar categoria
                    </Dialog.Trigger>
                    <Dialog.Portal>
                        <Dialog.Overlay className="catalog-scrim" />
                        <Dialog.Content
                            onEscapeKeyDown={(e) => {
                                if (pending.current) e.preventDefault();
                            }}
                            onPointerDownOutside={(e) => {
                                if (pending.current) e.preventDefault();
                            }}
                            className="catalog-dialog"
                            onCloseAutoFocus={(e) => {
                                if (editTrigger.current) {
                                    e.preventDefault();
                                    (editTrigger.current.isConnected ? editTrigger.current : searchRef.current)?.focus();
                                }
                            }}
                        >
                            <Dialog.Title>{editing ? 'Editar categoria' : 'Adicionar categoria'}</Dialog.Title>
                            <Dialog.Description>{editing ? 'O novo nome aparecerá também nas denúncias vinculadas.' : 'A categoria ficará disponível para novos registros.'}</Dialog.Description>
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    if (!parsed.success) return;
                                    void submit(editing?.id, { name: parsed.data.name, icon }, () => {
                                        setName('');
                                        setAdd(false);
                                        setNotice(editing ? 'Categoria atualizada.' : 'Categoria adicionada.');
                                    });
                                }}
                            >
                                <label htmlFor="preview-category-name">Nome da categoria</label>
                                <input
                                    id="preview-category-name"
                                    readOnly={saving}
                                    maxLength={80}
                                    required
                                    value={name}
                                    aria-invalid={!!(error || validation)}
                                    aria-describedby={error || validation ? 'preview-category-error' : undefined}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        setError('');
                                    }}
                                />
                                {(error || validation) && (
                                    <p role="alert" id="preview-category-error">
                                        {error || validation}
                                    </p>
                                )}
                                <CategoryIconPicker value={icon} change={setIcon} disabled={saving} />
                                <footer>
                                    <Dialog.Close disabled={saving} type="button" className="catalog-button catalog-secondary">
                                        Cancelar
                                    </Dialog.Close>
                                    <button type="submit" className="catalog-button catalog-primary" aria-busy={saving} disabled={saving || !parsed.success}>
                                        {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Salvar categoria'}
                                    </button>
                                </footer>
                            </form>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            </header>
            <Dialog.Root
                open={!!selected}
                onOpenChange={(open) => {
                    if (!open && !pending.current) setSelected(undefined);
                }}
            >
                {selected && (
                    <Dialog.Portal>
                        <Dialog.Overlay className="catalog-scrim" />
                        <Dialog.Content
                            onEscapeKeyDown={(e) => {
                                if (pending.current) e.preventDefault();
                            }}
                            onPointerDownOutside={(e) => {
                                if (pending.current) e.preventDefault();
                            }}
                            className="catalog-dialog catalog-confirmation"
                            onOpenAutoFocus={(event) => {
                                event.preventDefault();
                                cancel.current?.focus();
                            }}
                            onCloseAutoFocus={(event) => {
                                event.preventDefault();
                                const target = restored.current === null ? opener.current : restored.current === 'archive-toggle' ? archiveToggle.current : document.getElementById('category-action-' + restored.current);
                                (target?.isConnected ? target : searchRef.current)?.focus();
                            }}
                        >
                            <Dialog.Title>
                                {selected.archived ? 'Reativar' : 'Arquivar'} {selected.name}?
                            </Dialog.Title>
                            <Dialog.Description>{selected.archived ? 'A categoria estará disponível para novos registros.' : 'A categoria sairá das opções para novos registros. As denúncias anteriores continuarão disponíveis.'}</Dialog.Description>
                            {error && <p role="alert">{error}</p>}
                            <footer>
                                <Dialog.Close disabled={saving} type="button" ref={cancel} className="catalog-button catalog-secondary">
                                    Cancelar
                                </Dialog.Close>
                                <button
                                    type="button"
                                    className="catalog-button catalog-primary"
                                    disabled={saving}
                                    aria-busy={saving}
                                    onClick={() => {
                                        void submit(selected.id, { archived: !selected.archived }, () => {
                                            restored.current = selected.archived ? selected.id : 'archive-toggle';
                                            setNotice(selected.archived ? 'Categoria reativada.' : 'Categoria arquivada.');
                                            setSelected(undefined);
                                        });
                                    }}
                                >
                                    Confirmar
                                </button>
                            </footer>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </Dialog.Root>
            <div role="status" className="notice">
                {notice}
            </div>
            {feedback}
            <section className="catalog-group" aria-labelledby="active-categories">
                <header className="catalog-toolbar">
                    <h2 id="active-categories">Categorias ativas</h2>
                    <label className="catalog-search">
                        <Search size={17} aria-hidden="true" />
                        <input type="search" aria-label="Buscar categoria" placeholder="Buscar categoria" ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} />
                    </label>
                </header>
                {active.length ? categoryList(active) : !loading && <p>{term ? 'Nenhuma categoria ativa corresponde à busca.' : 'Nenhuma categoria ativa.'}</p>}
            </section>
            <div className="catalog-archive">
                <button type="button" ref={archiveToggle} aria-expanded={expanded} aria-controls="archived-categories" onClick={() => setExpanded(!expanded)}>
                    <Archive size={17} aria-hidden="true" />
                    <span>
                        {expanded ? 'Ocultar categorias arquivadas' : 'Ver categorias arquivadas'} ({archived.length})
                    </span>
                    <ChevronDown size={17} aria-hidden="true" />
                </button>
                <div id="archived-categories" hidden={!expanded}>
                    {archived.length ? categoryList(archived) : <p>{term ? 'Nenhuma categoria arquivada corresponde à busca.' : 'Nenhuma categoria arquivada.'}</p>}
                </div>
            </div>
        </div>
    );
}
