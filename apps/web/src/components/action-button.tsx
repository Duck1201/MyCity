import type { ComponentProps } from 'react';
import { Button } from './ui/button';

export function ActionButton({ pending = false, disabled, ...props }: ComponentProps<'button'> & { pending?: boolean }) {
    return <Button {...props} disabled={disabled || pending} aria-busy={pending} />;
}
