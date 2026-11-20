import { ArrowLeft } from 'lucide-react';
import { Link } from './navigation';
import { ReportService } from './report-service';
import './occurrence-detail.css';
import './manager-detail.css';

export function ManagerDetail({ id, onSessionExpired }: { id: string; onSessionExpired: () => void }) {
    const origin: unknown = window.history.state?.from;
    const fromList = typeof origin === 'string' && /^\/atendimento(?:\?|$)/.test(origin);
    const fromOverview = origin === '/visao-geral' || origin === '/';
    const back = fromList || fromOverview ? origin : '/atendimento';
    return (
        <main className="manager-detail occurrence" aria-label="Detalhes da denúncia">
            <Link
                className="occurrence-back"
                href={back}
                onClick={(event) => {
                    if ((fromList || fromOverview) && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                        event.preventDefault();
                        window.history.back();
                    }
                }}
            >
                <ArrowLeft size={16} aria-hidden="true" />
                {fromOverview ? 'Voltar à visão geral' : 'Voltar ao atendimento'}
            </Link>
            <ReportService key={id} id={id} onSessionExpired={onSessionExpired} />
        </main>
    );
}
