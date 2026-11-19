import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ActionButton } from '../src/components/action-button';

it('bloqueia acionamento repetido durante envio e libera ao concluir', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
        <ActionButton pending onClick={onClick}>
            Publicar resposta
        </ActionButton>,
    );
    const button = screen.getByRole('button', { name: 'Publicar resposta' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    rerender(
        <ActionButton pending={false} onClick={onClick}>
            Publicar resposta
        </ActionButton>,
    );
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
});
