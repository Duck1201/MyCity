import type { RefObject } from 'react';
import { useRef } from 'react';
import { DropdownMenu } from 'radix-ui';
import { ArrowRight, Ban, ChevronDown, CircleCheck, RotateCcw, Undo2 } from 'lucide-react';
import type { ReportStatus } from '@mycity/contracts';
import { isReopening, managerTransitions, reopeningHint } from '../manager-transitions';

type Props = { status: ReportStatus; allowed: readonly string[]; disabled: boolean; triggerRef: RefObject<HTMLButtonElement | null>; transition: (target: ReportStatus) => void };
export function ManagerStatusActions({ status, allowed, disabled, triggerRef, transition }: Props) {
    const selectedFromMenu = useRef(false);
    const [primary, ...secondary] = managerTransitions(status).filter((action) => allowed.includes(action.target));
    if (!primary) return null;
    const PrimaryIcon = primary.target === 'RESOLVED' ? CircleCheck : isReopening(status, primary.target) ? RotateCcw : ArrowRight;
    return (
        <section className="occurrence-actions" aria-labelledby="action-heading">
            <h2 id="action-heading">Atualizar situação</h2>
            <div className="case-action-group">
                <button type="button" className="primary case-next" disabled={disabled} aria-describedby={isReopening(status, primary.target) ? 'reopen-hint' : undefined} onClick={() => transition(primary.target)}>
                    {primary.label}
                    <PrimaryIcon size={17} aria-hidden="true" />
                </button>
                {secondary.length > 0 && (
                    <DropdownMenu.Root modal={false}>
                        <DropdownMenu.Trigger asChild>
                            <button type="button" className="case-other-actions" disabled={disabled} ref={triggerRef} aria-label="Outras ações de situação" title="Outras ações de situação">
                                <ChevronDown size={18} aria-hidden="true" />
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                className="case-action-menu"
                                align="end"
                                sideOffset={6}
                                collisionPadding={12}
                                onCloseAutoFocus={(event) => {
                                    if (selectedFromMenu.current) event.preventDefault();
                                    selectedFromMenu.current = false;
                                }}
                            >
                                {secondary.map(({ target, label }) => (
                                    <DropdownMenu.Item
                                        key={target}
                                        className="case-action-item"
                                        data-reject={target === 'REJECTED' || undefined}
                                        onSelect={() => {
                                            selectedFromMenu.current = true;
                                            transition(target);
                                        }}
                                    >
                                        {target === 'REJECTED' ? <Ban size={16} aria-hidden="true" /> : <Undo2 size={16} aria-hidden="true" />}
                                        {label}
                                    </DropdownMenu.Item>
                                ))}
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                )}
            </div>
            {isReopening(status, 'UNDER_REVIEW') && (
                <p id="reopen-hint" className="muted">
                    {reopeningHint}
                </p>
            )}
        </section>
    );
}
