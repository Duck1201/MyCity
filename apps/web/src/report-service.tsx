import { usePanelLoading } from './panel-loading';
import { isReopening } from './manager-transitions';
import { ManagerStatusActions } from './components/manager-status-actions';
import { OccurrenceContent, OccurrenceReply } from './components/occurrence-content';
import { Status } from './queue-presentation';
import { CategorySymbol } from './components/category-symbol';
import { useCategoryCatalog } from './category-catalog';
import { useEffect, useRef, useState } from 'react';
import type { ReportDetail, ReportStatus, ReportEvent, ReportReply, ReportTransition } from '@mycity/contracts';
import { Check } from 'lucide-react';
import { reportCategoryLabels, categoryIconFor } from '@mycity/contracts';
import { QueueLoading } from './components/queue-loading';
import { useLiveQuery } from './use-live-query';
export const statuses: Record<ReportStatus, string> = { SENT: 'Enviado', UNDER_REVIEW: 'Em análise', IN_PROGRESS: 'Em andamento', RESOLVED: 'Resolvido', REJECTED: 'Rejeitado', CANCELED: 'Cancelado' };
export const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
function CaseText({ text, description = false, label }: { text: string; description?: boolean; label?: string }) {
    const className = description ? 'occurrence-description' : undefined;
    const lead = label && <strong className="case-text-label">{label} </strong>;
    if (text.length <= 220)
        return (
            <p className={className}>
                {lead}
                {text}
            </p>
        );
    return (
        <details className="case-long-text">
            <summary>
                <span className={description ? 'case-excerpt occurrence-description' : 'case-excerpt'}>{text.slice(0, 175).trimEnd()}…</span>
                <span className="case-read">{description ? 'Ler relato completo' : 'Ler texto completo'}</span>
                <span className="case-collapse">Recolher texto</span>
            </summary>
            <p className={className}>
                {lead}
                {text}
            </p>
        </details>
    );
}

type Props = { id: string; onSessionExpired: () => void; onChange?: (report: ReportDetail) => void };
export function ReportService({ id, onSessionExpired, onChange }: Props) {
    const base = '/api/v1/reports/' + encodeURIComponent(id);
    const detail = useLiveQuery<{ data: ReportDetail }>(base, onSessionExpired);
    usePanelLoading(!detail.data && !detail.failed);
    type EventPage = { data: ReportEvent[]; page: { nextCursor: string | null } };
    const historyUrl = base + '/history?order=newest&limit=4';
    const history = useLiveQuery<EventPage>(historyUrl, onSessionExpired);
    const anchor = history.data?.page.nextCursor;
    const [archive, setArchive] = useState<{ anchor: string; cursor: string; loaded: ReportEvent[] } | null>(null);
    const expanded = !!archive && archive.anchor === anchor;
    const older = useLiveQuery<EventPage>(expanded ? historyUrl + '&cursor=' + encodeURIComponent(archive.cursor) : null, onSessionExpired);
    const events = [...(history.data?.data ?? []), ...(expanded ? [...archive.loaded, ...(older.data?.data ?? [])] : [])];
    const more = older.data?.page.nextCursor;
    const [reason, setReason] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const reasonField = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (rejecting) reasonField.current?.focus();
    }, [rejecting]);
    const [reply, setReply] = useState('');
    const replyId = useRef<string | null>(null);
    const feedback = useRef<HTMLParagraphElement>(null);
    const replyFeedback = useRef<HTMLParagraphElement>(null);
    const replySuccess = 'Resposta publicada.';
    const rejectButton = useRef<HTMLButtonElement>(null);
    const errorFeedback = useRef<HTMLParagraphElement>(null);
    const [success, setSuccess] = useState('');
    useEffect(() => {
        if (success) (success === replySuccess ? replyFeedback : feedback).current?.focus({ preventScroll: true });
    }, [success]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    useEffect(() => {
        if (message) errorFeedback.current?.focus({ preventScroll: true });
    }, [message]);
    const write = useRef<AbortController | null>(null);
    const report = detail.data?.data;
    const catalog = useCategoryCatalog(onSessionExpired);
    const category = catalog.data?.data.find((item) => item.id === report?.category);
    const canReject = report?.allowedActions?.includes('REJECTED');
    const cancelFocus = useRef(false);
    useEffect(() => {
        if (rejecting && !canReject) {
            setRejecting(false);
            setReason('');
            setMessage('Esta denúncia foi alterada por outra operação. Confira o status atual antes de continuar.');
        } else if (!rejecting && cancelFocus.current) {
            cancelFocus.current = false;
            rejectButton.current?.focus();
        }
    }, [rejecting, canReject]);

    useEffect(() => () => write.current?.abort(), []);
    async function submit(command: ReportTransition | ReportReply) {
        if (!report || write.current) return;
        const isReply = 'clientRequestId' in command;
        const controller = new AbortController();
        write.current = controller;
        setBusy(true);
        setMessage('');
        setSuccess('');
        try {
            const response = await fetch(base + (isReply ? '/replies' : '/transitions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-MyCity-Client': 'web' },
                body: JSON.stringify(command),
                signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            if (response.status === 401) return onSessionExpired();
            if (response.status === 409) {
                setMessage(isReply ? 'Esta resposta entrou em conflito com uma publicação anterior. Confira o histórico e revise o texto.' : 'Esta denúncia foi alterada por outra operação. Confira o status atual antes de continuar.');
                detail.refresh();
                history.refresh();
                return;
            }
            if (!response.ok) throw new Error();
            if (isReply) {
                setReply('');
                replyId.current = null;
                setSuccess(replySuccess);
            } else {
                const result: { data: ReportDetail } = await response.json();
                if (controller.signal.aborted) return;
                detail.replace(result);
                onChange?.(result.data);
                setReason('');
                setRejecting(false);
                setSuccess('Status atualizado para ' + statuses[result.data.status] + '.');
            }
            setArchive(null);
            history.refresh();
        } catch {
            if (!controller.signal.aborted) {
                setMessage(isReply ? 'Não foi possível confirmar a publicação. Confira o histórico ou envie novamente.' : 'Não foi possível confirmar a alteração. Confira o status antes de tentar novamente.');
                detail.refresh();
                history.refresh();
            }
        } finally {
            if (!controller.signal.aborted) {
                write.current = null;
                setBusy(false);
            }
        }
    }
    function transition(targetStatus: ReportStatus) {
        if (report) void submit({ targetStatus, expectedVersion: report.version, ...(targetStatus === 'REJECTED' && { reason: reason.trim() }) });
    }
    return (
        <>
            {detail.failed && (
                <p role="alert">
                    Não foi possível atualizar os detalhes. <button onClick={detail.refresh}>Tentar novamente</button>
                </p>
            )}
            {!report && !detail.failed && <QueueLoading kind="detail" />}
            {report && (
                <>
                    <header className="occurrence-head">
                        <div>
                            <div className="occurrence-identity">
                                <span className="case-status" key={report.status} data-updated={!!success || undefined}>
                                    <Status value={report.status} />
                                </span>
                                {detail.revalidating && (
                                    <span role="status" className="occurrence-updating">
                                        Atualizando…
                                    </span>
                                )}
                            </div>
                            <h1 className="occurrence-category-title">
                                <CategorySymbol icon={categoryIconFor(report.category, category?.icon)} size={26} />
                                {report.categoryName ?? category?.name ?? reportCategoryLabels[report.category] ?? report.category}
                            </h1>
                            {report.status === 'REJECTED' && report.rejectionReason && (
                                <p role="note" aria-label="Motivo da rejeição" className="occurrence-rejection-reason">
                                    <strong>Motivo da rejeição</strong>
                                    <span>{report.rejectionReason}</span>
                                </p>
                            )}
                        </div>
                        <ManagerStatusActions status={report.status} allowed={report.allowedActions ?? []} disabled={busy || rejecting} triggerRef={rejectButton} transition={(target) => (target === 'REJECTED' ? setRejecting(true) : transition(target))} />
                    </header>
                    {rejecting && report.allowedActions?.includes('REJECTED') && (
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (reason.trim() && reason.trim().length <= 2000) void transition('REJECTED');
                            }}
                            className="occurrence-rejection"
                        >
                            <label htmlFor="occurrence-reason">Justificativa da rejeição</label>
                            <p id="reject-hint">A justificativa será publicada no histórico.</p>
                            <textarea id="occurrence-reason" ref={reasonField} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={2000} disabled={busy} aria-describedby="reject-hint" />
                            <div>
                                <button type="submit" className="occurrence-confirm" disabled={busy || !reason.trim() || reason.trim().length > 2000}>
                                    Confirmar rejeição
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                        cancelFocus.current = true;
                                        setReason('');
                                        setRejecting(false);
                                    }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}
                    {busy && <p role="status">Salvando atendimento…</p>}
                    {success && success !== replySuccess && (
                        <p className="occurrence-notice" ref={feedback} tabIndex={-1} role="status">
                            <Check size={16} />
                            {success}
                        </p>
                    )}
                    {message && (
                        <p className="case-error" role="alert" ref={errorFeedback} tabIndex={-1}>
                            {message}
                        </p>
                    )}
                    <OccurrenceContent
                        description={<CaseText text={report.description} description />}
                        location={
                            <>
                                {report.location.latitude}, {report.location.longitude}
                            </>
                        }
                        registered={<time dateTime={report.createdAt}>{formatDate(report.createdAt)}</time>}
                        confirmations={report.confirmationCount}
                        author={
                            <>
                                {report.author && <img className="author-photo" src={report.author.photoUrl} alt="" />}
                                {report.author?.name ?? 'Anônimo'}
                            </>
                        }
                        category={report.categoryName ?? category?.name ?? reportCategoryLabels[report.category] ?? report.category}
                        photos={report.photos.map((photo) => ({ image: photo.contentPath, width: photo.width, height: photo.height }))}
                        reply={
                            report.allowedActions?.includes('REPLY') && (
                                <OccurrenceReply
                                    value={reply}
                                    change={(value) => {
                                        setReply(value);
                                        replyId.current = null;
                                        setSuccess('');
                                        setMessage('');
                                    }}
                                    publish={() => {
                                        replyId.current ??= crypto.randomUUID();
                                        void submit({ text: reply.trim(), clientRequestId: replyId.current });
                                    }}
                                    published={success === replySuccess}
                                    noticeRef={replyFeedback}
                                    disabled={busy}
                                />
                            )
                        }
                        count={history.data ? String(events.length) + ((expanded ? more || !older.data : anchor) ? '+' : '') : '…'}
                        events={events.map((event) => ({
                            id: event.id,
                            reply: event.type === 'REPLY',
                            text: (
                                <>
                                    {event.type !== 'REPLY' && <span>{event.type === 'CREATED' ? 'Denúncia enviada' : (event.fromStatus && event.toStatus && isReopening(event.fromStatus, event.toStatus) ? 'Reaberta: ' : '') + statuses[event.fromStatus!] + ' → ' + statuses[event.toStatus!]}</span>}
                                    {event.text && <CaseText text={event.text} {...(event.type === 'STATUS_CHANGED' && event.toStatus === 'REJECTED' && { label: 'Justificativa:' })} />}
                                </>
                            ),
                            metadata: (
                                <>
                                    {event.actorRole === 'MANAGER' ? 'Gestor' : 'Cidadão'} · <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
                                </>
                            ),
                        }))}
                        historyFeedback={
                            <>
                                {history.failed && (
                                    <p role="alert">
                                        Não foi possível atualizar o histórico. <button onClick={history.refresh}>Tentar novamente</button>
                                    </p>
                                )}
                                {!history.data && !history.failed && <QueueLoading kind="history" />}
                            </>
                        }
                        historyControls={
                            anchor && (
                                <>
                                    <button type="button" className="history-disclosure" aria-controls="occurrence-history" aria-expanded={expanded} onClick={() => setArchive(expanded ? null : { anchor, cursor: anchor, loaded: [] })}>
                                        {expanded ? 'Recolher histórico' : 'Ver registros anteriores'}
                                    </button>
                                    {expanded && older.failed && (
                                        <p role="alert">
                                            Não foi possível atualizar os registros anteriores. <button onClick={older.refresh}>Tentar novamente</button>
                                        </p>
                                    )}
                                    {expanded && !older.data && !older.failed && <p role="status">Carregando registros anteriores…</p>}
                                    {expanded && more && (
                                        <button type="button" className="history-disclosure" onClick={() => setArchive({ anchor, cursor: more, loaded: [...archive.loaded, ...older.data!.data] })}>
                                            Ver mais registros
                                        </button>
                                    )}
                                </>
                            )
                        }
                    />
                </>
            )}
        </>
    );
}
