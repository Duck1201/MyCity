import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReportMarker } from '@mycity/contracts';
import { MapMarkers } from '../src/map-markers';

jest.mock('react-native-maps', () => ({ Marker: 'Marker' }));
const region = { latitude: 0, longitude: 0, latitudeDelta: 1, longitudeDelta: 1 };
const point = (id: string, longitude: number, latitude = 0): ReportMarker => ({ id, longitude, latitude, category: 'POTHOLE', categoryName: 'Buraco na via', status: 'SENT', confirmationCount: 0 });

it('agrupa pontos próximos mesmo em células adjacentes, mostra a contagem e separa ao ampliar', async () => {
    const pins = [point('a', 0.099), point('b', 0.129), point('c', -0.3)];
    const props = { pins, region, width: 400, height: 600, onSelect: jest.fn(), onGroup: jest.fn() };
    const view = await render(<MapMarkers {...props} />);
    await fireEvent.press(screen.getByLabelText('2 denúncias próximas'));
    expect(props.onGroup).toHaveBeenCalledWith(['a', 'b']);
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.queryByTestId('report-marker-b')).toBeNull();
    const isolated = screen.getByTestId('report-marker-c');
    expect(isolated).toHaveProp('accessibilityLabel', 'Buraco na via, Enviado');
    await fireEvent.press(isolated);
    expect(props.onSelect).toHaveBeenCalledWith('c');

    await view.rerender(<MapMarkers {...props} region={{ ...region, longitude: 0.115, longitudeDelta: 0.2 }} />);
    expect(screen.queryByLabelText('2 denúncias próximas')).toBeNull();
    await fireEvent.press(screen.getByTestId('report-marker-b'));
    expect(props.onSelect).toHaveBeenLastCalledWith('b');
});

it('mantém pontos coincidentes selecionáveis e reúne vizinhos nos dois lados do antimeridiano', async () => {
    const onGroup = jest.fn();
    const pins = [point('a', 179.99), point('b', -179.99), point('c', -179.99)];
    await render(<MapMarkers pins={pins} region={{ ...region, longitude: 180 }} width={400} height={600} selectedId="c" onGroup={onGroup} onSelect={jest.fn()} />);
    const group = screen.getByLabelText('3 denúncias próximas');
    expect(group).toHaveProp('coordinate', { latitude: 0, longitude: 179.99 });
    await fireEvent.press(group);
    expect(onGroup).toHaveBeenCalledWith(['a', 'b', 'c']);
});

it('usa a distância vertical e as dimensões medidas para preservar pontos separados', async () => {
    const props = { pins: [point('a', 0), point('b', 0, 0.095)], region, width: 400, onGroup: jest.fn(), onSelect: jest.fn() };
    const view = await render(<MapMarkers {...props} height={600} />);
    expect(screen.getByTestId('report-marker-a')).toBeVisible();
    expect(screen.getByTestId('report-marker-b')).toBeVisible();
    await view.rerender(<MapMarkers {...props} height={300} />);
    expect(screen.getByLabelText('2 denúncias próximas')).toBeVisible();
});

it('identifica a categoria no próprio mapa quando há uma única denúncia visível', async () => {
    await render(<MapMarkers pins={[point('único', 0)]} region={region} width={400} height={600} onSelect={jest.fn()} onGroup={jest.fn()} />);
    expect(screen.getByText('Buraco na via')).toBeVisible();
});
