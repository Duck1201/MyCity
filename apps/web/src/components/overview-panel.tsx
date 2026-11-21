import { SituationChart } from './situation-chart';
import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, CircleCheck, Inbox, ThumbsUp } from 'lucide-react';
import type { ReportStatus, ReportStatusCounts } from '@mycity/contracts';
import { statusNames } from '../report-status-labels';
import type { CategoryIcon } from './category-symbol';
import { Link, queueUrl } from '../navigation';
import { CategorySymbol } from './category-symbol';
import { CategoryRanking, type RankedCategory } from './category-ranking';
import './dashboard.css';

export type PriorityItem = { id: string; photo?: string | undefined; categoryName: string; categoryIcon: CategoryIcon; age: string; status: ReportStatus; description: string; count: number };
export function OverviewPanel({ counts, oldest, ranked, priorities, recent }: { counts: ReportStatusCounts; oldest?: { id: string; days: number } | undefined; ranked: RankedCategory[]; priorities: PriorityItem[]; recent: ReactNode }) {
    const pendingCount = counts.SENT + counts.UNDER_REVIEW + counts.IN_PROGRESS;
    const closedCount = counts.RESOLVED + counts.REJECTED + counts.CANCELED;
    const hasReports = pendingCount + closedCount > 0;
    return (
        <div className="civic-overview">
            <section className="civic-cover" aria-labelledby="overview-title">
                <img className="civic-grid" src="/images/urban-grid.svg" alt="" />
                <h1 id="overview-title">Visão geral</h1>
                <div className="civic-metrics">
                    {pendingCount > 0 && (
                        <Link href={queueUrl({ status: 'pending' })}>
                            <strong>{pendingCount}</strong>{' '}
                            <span>
                                Denúncias pendentes <ArrowUpRight size={14} />
                            </span>
                        </Link>
                    )}
                    {oldest && (
                        <Link href={'/atendimento/' + oldest.id}>
                            <strong>
                                {oldest.days} <small>{oldest.days === 1 ? 'dia' : 'dias'}</small>
                            </strong>{' '}
                            <span>
                                Pendência mais antiga <ArrowUpRight size={14} />
                            </span>
                        </Link>
                    )}
                    {!pendingCount && closedCount > 0 && (
                        <>
                            <Link href={queueUrl({ ordem: 'recentes' })}>
                                <strong>{closedCount}</strong>{' '}
                                <span>
                                    {closedCount === 1 ? 'Ocorrência encerrada' : 'Ocorrências encerradas'} <ArrowUpRight size={14} />
                                </span>
                            </Link>
                            <span className="queue-clear">
                                <CircleCheck size={21} aria-hidden="true" /> Sem pendências
                            </span>
                        </>
                    )}
                </div>
            </section>
            {!hasReports && (
                <section className="overview-first-use">
                    <Inbox size={25} aria-hidden="true" />
                    <div>
                        <h2>Nenhuma denúncia registrada</h2>
                        <p>As denúncias enviadas pelos cidadãos aparecerão aqui para atendimento.</p>
                        <Link href="/categorias">
                            Consultar categorias <ArrowRight size={14} />
                        </Link>
                    </div>
                </section>
            )}
            {hasReports && (
                <div className="civic-charts">
                    <SituationChart counts={counts} />

                    {pendingCount ? <CategoryRanking ranked={ranked} /> : recent}
                </div>
            )}
            {pendingCount > 0 && (
                <section className="civic-priority">
                    <div className="civic-priority-heading">
                        <div>
                            <h2>Prioridade de atendimento</h2>
                            <p className="priority-order">Mais confirmações primeiro. Em caso de empate, a mais antiga.</p>
                        </div>
                        <Link href="/atendimento">
                            Ver fila completa <ArrowRight size={16} />
                        </Link>
                    </div>
                    <ol>
                        {priorities.map((row) => (
                            <li key={row.id}>
                                <Link href={'/atendimento/' + row.id} id={'open-' + row.id} aria-label={'Abrir denúncia: ' + row.description} aria-describedby={['case', 'status', 'votes'].map((prefix) => prefix + '-' + row.id).join(' ')}>
                                    {row.photo ? (
                                        <img src={row.photo} alt="" width={58} height={48} />
                                    ) : (
                                        <span className="priority-photo-fallback" aria-hidden="true">
                                            <CategorySymbol icon={row.categoryIcon} />
                                        </span>
                                    )}
                                    <div className="civic-case" id={'case-' + row.id}>
                                        <strong>{row.description}</strong>
                                        <span className="civic-case-meta">
                                            <CategorySymbol icon={row.categoryIcon} size={14} /> {row.categoryName} · {row.age}
                                        </span>
                                    </div>
                                    <span id={'status-' + row.id} className={'status ' + row.status}>
                                        {statusNames[row.status]}
                                    </span>
                                    <span className="civic-confirmations" id={'votes-' + row.id}>
                                        <ThumbsUp size={14} aria-hidden="true" /> {row.count} <span className="sr-only">{row.count === 1 ? 'confirmação' : 'confirmações'}</span>
                                    </span>
                                    <ArrowUpRight size={18} />
                                </Link>
                            </li>
                        ))}
                    </ol>
                </section>
            )}
        </div>
    );
}

type RecentItem = Pick<PriorityItem, 'id' | 'description' | 'categoryName' | 'categoryIcon' | 'status' | 'photo'>;
export function RecentReports({ rows, feedback }: { rows: RecentItem[]; feedback?: ReactNode }) {
    return (
        <section className="overview-recent" aria-labelledby="recent-heading">
            <header>
                <h2 id="recent-heading">Registros recentes</h2>
                <Link href={queueUrl({ ordem: 'recentes' })}>
                    Ver todos <ArrowRight aria-hidden="true" size={15} />
                </Link>
            </header>
            {feedback}
            <ul>
                {rows.map((row) => (
                    <li key={row.id}>
                        <Link href={'/atendimento/' + encodeURIComponent(row.id)}>
                            {row.photo ? (
                                <img src={row.photo} alt="" width={48} height={48} />
                            ) : (
                                <span className="recent-symbol">
                                    <CategorySymbol icon={row.categoryIcon} />
                                </span>
                            )}
                            <span className="recent-summary">
                                <strong>{row.description}</strong>
                                <span>{row.categoryName}</span>
                            </span>
                            <span className={'status ' + row.status}>{statusNames[row.status]}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
