import { useLayoutEffect, useRef, type ComponentProps, type ReactNode, type Ref } from 'react';
import { animateHeight } from '../history-motion';
import { CalendarDays, Check, History, MapPin, MessageSquare, UserRound, UsersRound } from 'lucide-react';
import { PhotoGallery } from './photo-gallery';

type ReplyProps = {
    value: string;
    change: (value: string) => void;
    publish: () => void;
    disabled?: boolean;
    published: boolean;
    noticeRef: Ref<HTMLParagraphElement>;
};

export function OccurrenceReply({ value, change, publish, disabled = false, published, noticeRef }: ReplyProps) {
    return (
        <form
            className="occurrence-reply"
            aria-labelledby="reply-heading"
            onSubmit={(event) => {
                event.preventDefault();
                if (!disabled && value.trim()) publish();
            }}
        >
            <h2 id="reply-heading">
                <MessageSquare />
                <label htmlFor="occurrence-reply">Responder ao cidadão</label>
            </h2>
            <textarea id="occurrence-reply" required disabled={disabled} placeholder="Escreva o retorno sobre a ocorrência" maxLength={2000} value={value} onChange={(event) => change(event.target.value)} />
            <div>
                <span>{value.length}/2.000</span>
                <button className="primary" disabled={disabled || !value.trim()}>
                    Publicar resposta
                </button>
            </div>
            <p className="occurrence-notice" role="status" ref={noticeRef} tabIndex={-1}>
                {published && (
                    <>
                        <Check size={16} />
                        Resposta publicada.
                    </>
                )}
            </p>
        </form>
    );
}

export type TimelineEntry = { id: number | string; reply: boolean; text: ReactNode; metadata?: ReactNode; archived?: boolean; fresh?: boolean };
type ContentProps = ComponentProps<typeof PhotoGallery> & {
    description: ReactNode;
    location: ReactNode;
    registered: ReactNode;
    confirmations: number;
    author?: ReactNode;
    reply?: ReactNode;
    events: TimelineEntry[];
    count: string | number;
    historyFeedback?: ReactNode;
    historyControls?: ReactNode;
};

export function OccurrenceContent({ description, location, registered, confirmations, author, photos, category, reply, events, count, historyFeedback, historyControls }: ContentProps) {
    const list = useRef<HTMLOListElement>(null);
    const listHeight = useRef<number | null>(null);
    // When entries come or go, the list eases from its previous height.
    useLayoutEffect(() => {
        if (listHeight.current !== null) animateHeight(list.current, listHeight.current);
        listHeight.current = list.current?.getBoundingClientRect().height ?? 0;
    }, [events.length]);
    return (
        <>
            <section className="occurrence-report" aria-labelledby="report-heading">
                <div className="occurrence-report-copy">
                    <h2 id="report-heading">Relato do cidadão</h2>
                    {description}
                    <dl>
                        <div>
                            <dt>
                                <MapPin />
                                Local
                            </dt>
                            <dd>{location}</dd>
                        </div>
                        <div>
                            <dt>
                                <CalendarDays />
                                Registro
                            </dt>
                            <dd>{registered}</dd>
                        </div>
                        <div>
                            <dt>
                                <UsersRound />
                                Confirmações
                            </dt>
                            <dd>{confirmations}</dd>
                        </div>
                        {author && (
                            <div>
                                <dt>
                                    <UserRound />
                                    Autor
                                </dt>
                                <dd>{author}</dd>
                            </div>
                        )}
                    </dl>
                </div>
                <PhotoGallery photos={photos} category={category} />
            </section>
            <div className="occurrence-followup">
                {reply}
                <section className="occurrence-events" aria-labelledby="events-heading">
                    <h2 id="events-heading">
                        <History />
                        Histórico{' '}
                        <span aria-hidden="true" className="event-total">
                            {count}
                        </span>
                    </h2>
                    {historyFeedback}
                    <ol id="occurrence-history" ref={list}>
                        {events.map((event) => (
                            <li key={event.id} data-kind={event.reply ? 'reply' : 'status'} data-archived={event.archived || undefined} data-fresh={event.fresh || undefined}>
                                {event.reply && (
                                    <strong>
                                        <MessageSquare size={14} aria-hidden="true" />
                                        Resposta pública
                                    </strong>
                                )}
                                {event.text}
                                {event.metadata && <small className="event-metadata">{event.metadata}</small>}
                            </li>
                        ))}
                    </ol>
                    {historyControls}
                </section>
            </div>
        </>
    );
}
