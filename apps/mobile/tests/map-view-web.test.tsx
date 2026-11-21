import { createRef, type ComponentRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import MapView, { Marker } from '../src/map-view.web';
import { cityRegion } from '../src/map-region';

it('aproxima e desloca a câmera web, mantém os pinos selecionáveis e informa o centro para o ponto manual', async () => {
    const completed = jest.fn();
    const select = jest.fn();
    const ref = createRef<ComponentRef<typeof MapView>>();
    await render(
        <MapView ref={ref} initialRegion={cityRegion} onRegionChangeComplete={completed}>
            <Marker coordinate={cityRegion} accessibilityLabel="Iluminação, enviada" onPress={select} />
        </MapView>,
    );
    await fireEvent.press(screen.getByLabelText('Iluminação, enviada'));
    expect(select).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Aproximar mapa'));
    expect(completed.mock.lastCall![0].latitudeDelta).toBeLessThan(cityRegion.latitudeDelta);
    expect(completed.mock.lastCall![1]).toEqual({ isGesture: true });
    const center = { latitude: cityRegion.latitude + 0.001, longitude: cityRegion.longitude + 0.002 };
    await act(() => ref.current!.setCamera({ center, zoom: 17 }));
    expect(await ref.current!.getCamera()).toMatchObject({ center });
    expect(completed.mock.lastCall![1]).toEqual({ isGesture: false });
});

it('converte um toque em coordenadas e conclui o arraste sem selecionar outro ponto', async () => {
    const tap = jest.fn(),
        complete = jest.fn(),
        start = jest.fn(),
        ready = jest.fn();
    await render(<MapView testID="map" initialRegion={cityRegion} onMapReady={ready} onPress={tap} onRegionChangeStart={start} onRegionChangeComplete={complete} />);
    await fireEvent(screen.getByTestId('map'), 'layout', { nativeEvent: { layout: { width: 400, height: 400 } } });
    expect(ready).toHaveBeenCalledTimes(1);
    const region = complete.mock.lastCall![0];
    complete.mockClear();
    const surface = screen.getByLabelText('Explorar mapa');
    const point = { pointerId: 1, isPrimary: true, button: 0, clientX: 300, clientY: 100, currentTarget: { setPointerCapture: jest.fn(), getBoundingClientRect: () => ({ top: 0, left: 0, width: 400, height: 400 }) } };
    await fireEvent(surface, 'pointerDown', point);
    await fireEvent(surface, 'pointerUp', point);
    expect(tap.mock.lastCall![0].nativeEvent.coordinate.latitude).toBeCloseTo(region.latitude + region.latitudeDelta / 4, 8);
    expect(tap.mock.lastCall![0].nativeEvent.coordinate.longitude).toBeCloseTo(region.longitude + region.longitudeDelta / 4, 8);
    await fireEvent(surface, 'pointerDown', point);
    await fireEvent(surface, 'pointerMove', { ...point, clientX: 100 });
    expect(start).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    await fireEvent(surface, 'pointerUp', { ...point, clientX: 100 });
    expect(complete.mock.lastCall![0].longitude).toBeCloseTo(region.longitude + region.longitudeDelta / 2, 8);
    expect(complete.mock.lastCall![1]).toEqual({ isGesture: true });
    expect(tap).toHaveBeenCalledTimes(1);
});
