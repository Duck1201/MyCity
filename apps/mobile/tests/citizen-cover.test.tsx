import { render, screen } from '@testing-library/react-native';
import { CitizenCover } from '../src/components/civic-header';

it('reserva a paisagem do Início antes e depois da chegada dos contadores', async () => {
    const { rerender } = await render(<CitizenCover ready={false} open={1} closed={2} />);
    expect(screen.root).toHaveStyle({ minHeight: 144 });

    await rerender(<CitizenCover ready open={1} closed={2} />);
    expect(screen.root).toHaveStyle({ minHeight: 144 });
    expect(screen.getByLabelText('1 denúncia em aberto')).toBeVisible();
    expect(screen.getByLabelText('2 denúncias encerradas')).toBeVisible();
});
