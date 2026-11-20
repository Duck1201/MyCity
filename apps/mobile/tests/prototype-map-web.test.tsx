import { fireEvent, render, screen } from '@testing-library/react-native';
import { cases, examplePoint, categoryName } from '../src/prototype/fixtures';
import { PrototypeMap } from '../src/prototype/prototype-map.web';

const firstPoint = { ...cases[0]!, id: 2042, category: 'POTHOLE' as const, point: examplePoint };
const secondPoint = { ...cases[0]!, id: 2043, category: 'WASTE' as const, point: { latitude: examplePoint.latitude - 0.003, longitude: examplePoint.longitude + 0.004 } };
const points = [firstPoint, secondPoint];

it('abre a ocorrência correspondente ao marcador da simulação local', async () => {
    const open = jest.fn();
    const region = { current: { ...examplePoint, latitudeDelta: 0.012, longitudeDelta: 0.012 } };
    await render(<PrototypeMap records={points} region={region} open={open} />);
    expect(screen.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeVisible();
    expect(screen.queryByText('MC-2043')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir ocorrência MC-2043, Lixo não coletado' }));
    expect(open).toHaveBeenCalledWith(secondPoint);
});

it('permite escolher entre denúncias no mesmo ponto', async () => {
    const first = firstPoint;
    const second = { ...first, id: 2000 };
    const open = jest.fn();
    const region = { current: { ...examplePoint, latitudeDelta: 0.012, longitudeDelta: 0.012 } };
    await render(<PrototypeMap records={[first, second]} region={region} open={open} />);
    await fireEvent.press(screen.getByRole('button', { name: '2 ocorrências neste ponto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir ocorrência MC-2000, Buraco na via' }));
    expect(open).toHaveBeenCalledWith(second);
});

it('aproxima, desloca e enquadra os pontos sem perder a região escolhida', async () => {
    const region = { current: { ...examplePoint, latitudeDelta: 0.012, longitudeDelta: 0.012 } };
    await render(<PrototypeMap records={points} region={region} open={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Aproximar mapa' }));
    expect(region.current.latitudeDelta).toBeLessThan(0.012);
    await fireEvent(screen.getByLabelText('Deslocar mapa de Viçosa'), 'keyDown', { key: 'ArrowRight', preventDefault: jest.fn() });
    expect(region.current.longitude).toBeGreaterThan(examplePoint.longitude);
    await fireEvent.press(screen.getByRole('button', { name: 'Enquadrar ocorrências' }));
    for (const item of points) expect(screen.getByRole('button', { name: 'Abrir ocorrência MC-' + item.id + ', ' + categoryName(item.category) })).toBeVisible();
});

it('preserva o grupo de marcadores ao voltar de um detalhe no mesmo enquadramento', async () => {
    const selectedGroup = { current: null as number | null };
    const region = { current: { ...examplePoint, latitudeDelta: 0.012, longitudeDelta: 0.012 } };
    const records = [firstPoint, { ...firstPoint, id: 2001 }];
    const open = jest.fn();
    const view = await render(<PrototypeMap records={records} region={region} selectedGroup={selectedGroup} open={open} />);
    await fireEvent.press(screen.getByRole('button', { name: '2 ocorrências neste ponto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir ocorrência MC-2001, Buraco na via' }));
    await view.unmount();
    await render(<PrototypeMap records={records} region={region} selectedGroup={selectedGroup} open={open} />);
    expect(screen.getByRole('button', { name: 'Abrir ocorrência MC-2001, Buraco na via' })).toBeVisible();
});
