import { CategorySymbol } from './category-symbol';
import { ManagerStatusActions } from '../components/manager-status-actions';
import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { allowedManagerTargets, type ReportStatus } from '@mycity/contracts';
import { statusNames, statusEvent, type DemoRecord } from './demo';
import { Status } from './overview';
import { OccurrenceContent, OccurrenceReply } from '../components/occurrence-content';
import { Link } from './navigation';
import './detail.css';

export function Detail({ row, update }: { row: DemoRecord; update: (record: DemoRecord, reason?: string) => boolean | void }) {
    const [showOlder, setShowOlder] = useState(false);
    const firstEvent = showOlder ? 0 : Math.max(0, row.events.length - 4);
    const [reply, setReply] = useState('');
    const [reason, setReason] = useState('');
    const [reject, setReject] = useState(false);
    const [notice, setNotice] = useState('');
    const [published, setPublished] = useState(false);
    const replyNotice = useRef<HTMLParagraphElement>(null);
    const actionsTrigger = useRef<HTMLButtonElement>(null);
    const returnToActions = useRef(false);
    const feedback = useRef<HTMLDivElement>(null);
    const reasonField = useRef<HTMLTextAreaElement>(null);
    const allowed = allowedManagerTargets(row.status, row.statusTrail.at(-2));
    const canReject = allowed.includes('REJECTED');
    const origin: unknown = history.state?.from;
    const back = typeof origin === 'string' && /^\/atendimento(?:\?|$)/.test(origin) ? origin : '/atendimento';

    useLayoutEffect(() => {
        if (reject && !canReject) {
            setReject(false);
            setReason('');
            setNotice('A situação mudou. Confira a etapa atual antes de continuar.');
        } else if (reject) reasonField.current?.focus();
        else if (returnToActions.current) {
            returnToActions.current = false;
            actionsTrigger.current?.focus();
        }
    }, [reject, canReject]);

    useLayoutEffect(() => {
        if (notice) feedback.current?.focus({ preventScroll: true });
    }, [notice]);
    function transition(status: ReportStatus, justification = '') {
        const event = statusEvent(status, row.status, justification);
        if (update({ ...row, status, events: [...row.events, { kind: 'status', text: event }] }, justification) === false) {
            setNotice('A situação mudou. Confira a etapa atual antes de continuar.');
            return;
        }
        setNotice('Situação atualizada para ' + statusNames[status] + '.');
        setReject(false);
        setPublished(false);
        setReason('');
    }
    function cancelRejection() {
        returnToActions.current = true;
        setReject(false);
    }
    const category = row.categoryName;
    return (
        <article className="occurrence">
            <Link
                href={back}
                className="occurrence-back"
                onClick={(event) => {
                    if (origin === back && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                        event.preventDefault();
                        history.back();
                    }
                }}
            >
                <ArrowLeft size={16} />
                Voltar ao atendimento
            </Link>
            <header className="occurrence-head">
                <div>
                    <div className="occurrence-identity">
                        <span>{row.id}</span>
                        <span className="case-status" key={row.status} data-updated={!!notice || undefined}>
                            <Status value={row.status} />
                        </span>
                    </div>
                    <h1 className="occurrence-category-title">
                        <CategorySymbol icon={row.categoryIcon} size={26} />
                        {category}
                    </h1>
                </div>
                <ManagerStatusActions
                    status={row.status}
                    allowed={allowed}
                    disabled={reject}
                    triggerRef={actionsTrigger}
                    transition={(target) => {
                        if (target === 'REJECTED') {
                            setNotice('');
                            setReject(true);
                        } else transition(target);
                    }}
                />
            </header>
            {reject && (
                <form
                    className="occurrence-rejection"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (reason.trim()) transition('REJECTED', reason.trim());
                    }}
                >
                    <label htmlFor="occurrence-reason">Justificativa da rejeição</label>
                    <p id="reason-hint">A justificativa será publicada no histórico.</p>
                    <textarea id="occurrence-reason" ref={reasonField} required aria-describedby="reason-hint" maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div>
                        <button className="occurrence-confirm" type="submit" disabled={!reason.trim()}>
                            Confirmar rejeição
                        </button>
                        <button type="button" onClick={cancelRejection}>
                            Cancelar
                        </button>
                    </div>
                </form>
            )}
            <div role="status" ref={feedback} tabIndex={-1} className="occurrence-notice">
                {notice && (
                    <>
                        <Check size={16} />
                        {notice}
                    </>
                )}
            </div>
            <OccurrenceContent
                description={<p className="occurrence-description">{row.description}.</p>}
                location={row.address}
                registered={row.date}
                confirmations={row.count}
                photos={row.photos}
                category={category ?? row.category}
                count={row.events.length}
                events={row.events
                    .slice(firstEvent)
                    .map((event, index) => ({ id: firstEvent + index, reply: event.kind === 'reply', text: <span>{event.text}</span> }))
                    .reverse()}
                reply={
                    <OccurrenceReply
                        value={reply}
                        change={(text) => {
                            setReply(text);
                            setPublished(false);
                        }}
                        publish={() => {
                            update({ ...row, events: [...row.events, { kind: 'reply', text: reply.trim() }] });
                            setReply('');
                            setNotice('');
                            setPublished(true);
                            replyNotice.current?.focus();
                        }}
                        published={published}
                        noticeRef={replyNotice}
                    />
                }
                historyControls={
                    row.events.length > 4 && (
                        <button type="button" className="history-disclosure" aria-controls="occurrence-history" aria-expanded={showOlder} onClick={() => setShowOlder(!showOlder)}>
                            {showOlder ? 'Recolher histórico' : 'Ver registros anteriores (' + (row.events.length - 4) + ')'}
                        </button>
                    )
                }
            />
        </article>
    );
}
