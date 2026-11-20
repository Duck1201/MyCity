import { useState } from 'react';
import type { ReportStatus, ReportStatusCounts } from '@mycity/contracts';
import { statusKeys, statusNames } from '../report-status-labels';
import { Link, queueUrl } from '../navigation';
import './situation-chart.css';

const radius = 68;
function arc(start: number, end: number) {
    function point(turn: number) {
        const angle = 2 * Math.PI * turn;
        return [84 + radius * Math.sin(angle), 84 - radius * Math.cos(angle)].join(' ');
    }
    return 'M ' + point(start) + ' A 68 68 0 ' + (end - start > 0.5 ? '1' : '0') + ' 1 ' + point(end);
}

export function SituationChart({ counts }: { counts: ReportStatusCounts }) {
    const [hovered, setHovered] = useState<ReportStatus>();
    const [focused, setFocused] = useState<ReportStatus>();
    const active = hovered ?? focused;
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    let preceding = 0;
    const groups = statusKeys.map((status) => {
        const count = counts[status];
        const start = preceding;
        preceding += count;
        return { status, count, label: statusNames[status], start: total ? start / total : 0, end: total ? preceding / total : 0, percent: total ? Math.round((100 * count) / total) : 0 };
    });
    function inspect(status: ReportStatus) {
        return {
            onMouseEnter: () => setHovered(status),
            onMouseLeave: () => setHovered(undefined),
            onFocus: () => {
                setHovered(undefined);
                setFocused(status);
            },
            onBlur: () => setFocused(undefined),
        };
    }
    return (
        <section className="situation-chart" aria-labelledby="situation-title">
            <h2 id="situation-title">Denúncias por situação</h2>
            <div className="situation-layout">
                <svg className="situation-ring" viewBox="0 0 168 168" role="group" aria-label="Distribuição por situação">
                    <circle className="ring-base" cx="84" cy="84" r={radius} />
                    {groups
                        .filter((group) => group.count > 0)
                        .map((group) => {
                            const seam = Math.min(0.0028, (group.end - group.start) / 8);
                            return (
                                <Link key={group.status} className={'ring-slice situation-tone ' + group.status} href={queueUrl({ status: group.status })} tabIndex={0} role="link" aria-label={group.label + ' (' + group.count + ')'} data-muted={(!!active && active !== group.status) || undefined} {...inspect(group.status)}>
                                    {group.count === total ? <circle cx="84" cy="84" r={radius} /> : <path d={arc(group.start + seam, group.end - seam)} />}
                                </Link>
                            );
                        })}
                    <text className="ring-total" x="84" y="83" textAnchor="middle">
                        {total}
                    </text>
                    <text className="ring-caption" x="84" y="103" textAnchor="middle">
                        no total
                    </text>
                </svg>
                <ul className="situation-key">
                    {groups.map((group) => (
                        <li key={group.status}>
                            <Link href={queueUrl({ status: group.status })} aria-label={'Filtrar por ' + group.label} aria-describedby={'situation-' + group.status} className={'situation-tone ' + group.status} data-active={active === group.status || undefined} {...inspect(group.status)}>
                                <i aria-hidden="true" />
                                <span>{group.label}</span>
                                <strong>{group.count}</strong>
                                <span className="key-percent">{group.percent}%</span>
                            </Link>
                            <span className="sr-only" id={'situation-' + group.status}>
                                {group.count} de {total} denúncias, {group.percent}%
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
            {!total && <p>Nenhuma denúncia registrada.</p>}
        </section>
    );
}
