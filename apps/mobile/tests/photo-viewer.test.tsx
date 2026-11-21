import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { ReportOverview } from '../src/report-overview';

const apiBase = 'https://demo.test/api/v1';
const photos = [1, 2].map((n) => ({ id: 'foto-' + n, position: n - 1, width: 1600, height: 1200, byteSize: 300_000, contentPath: '/api/v1/reports/r/photos/foto-' + n, thumbnailPath: '/api/v1/reports/r/photos/foto-' + n + '/thumb' }));
const detail = { id: 'r', category: 'POTHOLE', categoryName: 'Buraco na via', description: 'Buraco fundo', status: 'SENT', location: { latitude: -20, longitude: -42, source: 'GPS' }, createdAt: '2026-11-19T12:00:00Z', updatedAt: '2026-11-19T12:00:00Z', confirmationCount: 0, confirmedByMe: false, isMine: true, showIdentity: false, photos, version: 1, allowedActions: [] } as never;

it('amplia a foto tocada em tela cheia, troca de foto e fecha', async () => {
    await render(<ReportOverview detail={detail} apiBase={apiBase} token="sessao" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ampliar foto 2 da denúncia' }));
    expect(screen.getByText('Foto 2 de 2')).toBeVisible();
    const viewerPhoto = screen.getByLabelText('Foto 2 de 2 da denúncia, ampliada');
    expect(viewerPhoto).toHaveProp('source', [{ uri: 'https://demo.test' + photos[1]!.contentPath, headers: { Authorization: 'Bearer sessao' } }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByText('Foto 2 de 2')).toBeNull();
});

it('aproxima com pinça, trava a troca de foto enquanto ampliada e volta com toque duplo, sem botão de zoom', async () => {
    await render(<ReportOverview detail={detail} apiBase={apiBase} token="sessao" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ampliar foto 1 da denúncia' }));
    expect(screen.queryByRole('button', { name: /Aproximar|Restaurar zoom/ })).toBeNull();
    expect(screen.getByTestId('photo-viewer-pages')).toHaveProp('scrollEnabled', true);
    await act(async () => {
        fireGestureHandler(getByGestureTestId('photo-viewer-pinch-0'), [
            { state: State.BEGAN, scale: 1 },
            { state: State.ACTIVE, scale: 1.5 },
            { state: State.ACTIVE, scale: 2.5 },
            { state: State.END, scale: 2.5 },
        ]);
    });
    expect(screen.getByTestId('photo-viewer-pages')).toHaveProp('scrollEnabled', false);
    await act(async () => {
        fireGestureHandler(getByGestureTestId('photo-viewer-double-tap-0'), [{ state: State.BEGAN }, { state: State.ACTIVE }, { state: State.END }]);
    });
    expect(screen.getByTestId('photo-viewer-pages')).toHaveProp('scrollEnabled', true);
});

it('oferece o zoom ao TalkBack como ação de acessibilidade da foto ampliada', async () => {
    await render(<ReportOverview detail={detail} apiBase={apiBase} token="sessao" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ampliar foto 1 da denúncia' }));
    const photo = screen.getByLabelText('Foto 1 de 2 da denúncia, ampliada');
    expect(photo.props.accessibilityActions).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'activate', label: 'Aproximar' })]));
    await act(async () => fireEvent(photo, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }));
    expect(screen.getByTestId('photo-viewer-pages')).toHaveProp('scrollEnabled', false);
});

it('amplia no ponto entre os dedos e no nível que a pinça escolher', async () => {
    await render(<ReportOverview detail={detail} apiBase={apiBase} token="sessao" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ampliar foto 1 da denúncia' }));
    const zoomLayer = () => screen.getByTestId('photo-viewer-zoom-0');
    const stage = screen.getByTestId('photo-viewer-stage-0');
    const { width, height } = stage.props.style.find((style: { width?: number }) => style?.width !== undefined);
    // Pinch around a point a quarter of the way in from the top-left corner.
    const focalX = width / 4;
    const focalY = height / 4;
    await act(async () => {
        fireGestureHandler(getByGestureTestId('photo-viewer-pinch-0'), [
            { state: State.BEGAN, scale: 1, focalX, focalY },
            { state: State.ACTIVE, scale: 1.7, focalX, focalY },
            { state: State.ACTIVE, scale: 3.3, focalX, focalY },
            { state: State.END, scale: 3.3, focalX, focalY },
        ]);
    });
    const transform = Object.assign({}, ...zoomLayer().props.style.transform);
    // Any level, not a preset, and the point under the fingers stays put: x = (focal - centre) * (1 - scale).
    expect(transform.scale).toBeCloseTo(3.3);
    expect(transform.translateX).toBeCloseTo((focalX - width / 2) * (1 - 3.3));
    expect(transform.translateY).toBeCloseTo((focalY - height / 2) * (1 - 3.3));
});
