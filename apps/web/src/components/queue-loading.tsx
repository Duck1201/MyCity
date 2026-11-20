import './queue-loading.css';

const messages = { queue: 'Carregando denúncias', detail: 'Carregando detalhes', history: 'Carregando histórico' };
export function QueueLoading({ kind }: { kind: keyof typeof messages }) {
    const label = messages[kind];
    return (
        <div className={'desk-placeholder desk-placeholder--' + kind} role="status" aria-label={label}>
            <span className="desk-load-caption">
                <i aria-hidden="true" />
                {label}…
            </span>
            <div className="desk-placeholder-lines" aria-hidden="true">
                {Array.from({ length: kind === 'queue' ? 3 : 2 }, (_, index) => (
                    <div key={index}>
                        <i />
                        <span />
                        <span />
                    </div>
                ))}
            </div>
        </div>
    );
}
