import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CategorySymbol } from './category-symbol';
import type { CategoryIcon } from './category-symbol';
import { Link, queueUrl } from './navigation';
import './category-ranking.css';

export type RankedCategory = { id: string; name: string; icon: CategoryIcon; archived: boolean; count: number };
export function CategoryRanking({ ranked }: { ranked: RankedCategory[] }) {
    const [expanded, setExpanded] = useState(false);
    const [page, setPage] = useState(0);
    const pageSize = 8;
    const pageCount = Math.ceil(ranked.length / pageSize);
    const currentPage = Math.min(page, Math.max(0, pageCount - 1));
    const top = ranked.filter((category) => category.count > 0).slice(0, 5);
    const visible = expanded ? ranked.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : top;
    return (
        <section className="category-ranking" aria-labelledby="ranking-title">
            <h2 id="ranking-title">Pendências por categoria</h2>
            {visible.length ? (
                <ol data-expanded={expanded || undefined}>
                    {visible.map(({ id: category, count, name: label, icon: categoryIcon, archived }) => (
                        <li key={category}>
                            <Link href={queueUrl({ category, status: 'pending' })} aria-label={'Filtrar por ' + label} aria-describedby={'count-' + category}>
                                <CategorySymbol icon={categoryIcon} size={21} />
                                <span>
                                    {label}
                                    {archived && <small>Arquivada</small>}
                                </span>
                                <strong aria-hidden="true">{count}</strong>
                                <span id={'count-' + category} className="sr-only">
                                    {count === 1 ? '1 pendência' : count + ' pendências'}
                                </span>
                                <ChevronRight size={15} aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                </ol>
            ) : (
                <p>Nenhuma denúncia pendente.</p>
            )}
            <div className="rank-controls">
                {ranked.length > top.length && (
                    <button
                        type="button"
                        className="rank-expand"
                        aria-expanded={expanded}
                        onClick={() => {
                            setExpanded(!expanded);
                            setPage(0);
                        }}
                    >
                        {expanded ? 'Recolher categorias' : 'Ver todas as categorias'}
                        <ChevronDown size={16} aria-hidden="true" />
                    </button>
                )}
                {expanded && pageCount > 1 && (
                    <nav className="rank-pages" aria-label="Páginas de categorias">
                        <button type="button" disabled={!currentPage} aria-label="Categorias anteriores" onClick={() => setPage(currentPage - 1)}>
                            Anterior
                        </button>
                        <span>
                            {currentPage + 1} de {pageCount}
                        </span>
                        <button type="button" disabled={currentPage + 1 >= pageCount} aria-label="Próximas categorias" onClick={() => setPage(currentPage + 1)}>
                            Próxima
                        </button>
                    </nav>
                )}
            </div>
        </section>
    );
}
