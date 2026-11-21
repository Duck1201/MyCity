import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { fetchWithServerTime, type ReportDetail } from '@mycity/contracts';
import { ReportOverview } from '../src/report-overview';

const apiBase = 'https://demo.test/api/v1';
const photos = [1, 2].map((n) => ({ id: 'foto-' + n, position: n - 1, width: 1600, height: 1200, byteSize: 300_000, contentPath: '/api/v1/reports/r/photos/foto-' + n, thumbnailPath: '/api/v1/reports/r/photos/foto-' + n + '/thumb' }));
const detail = { id: 'r', category: 'POTHOLE', categoryName: 'Buraco na via', description: 'Buraco fundo', status: 'SENT', location: { latitude: -20, longitude: -42, source: 'GPS' }, createdAt: '2026-11-19T12:00:00Z', updatedAt: '2026-11-19T12:00:00Z', confirmationCount: 0, confirmedByMe: false, isMine: true, showIdentity: false, photos, version: 1, allowedActions: [] } satisfies ReportDetail;

it('amplia a foto tocada em tela cheia, troca de foto e fecha', async () => {
    await render(<ReportOverview detail={detail} apiBase={apiBase} token="sessao" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ampliar foto 2 da denúncia' }));
    expect(screen.getByText('Foto 2 de 2')).toBeVisible();
    const viewerPhoto = screen.getByLabelText('Foto 2 de 2 da denúncia, ampliada');
    expect(viewerPhoto).toHaveProp('source', [{ uri: 'https://demo.test' + photos[1]!.contentPath, headers: { Authorization: 'Bearer sessao' } }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByText('Foto 2 de 2')).toBeNull();
});

const pinch = (scale: number, focalX: number, focalY: number) =>
    fireGestureHandler(getByGestureTestId('photo-viewer-pinch'), [
        { state: State.BEGAN, scale: 1, focalX, focalY },
        { state: State.ACTIVE, scale: 1, focalX, focalY },
        { state: State.ACTIVE, scale: (1 + scale) / 2, focalX, focalY },
        { state: State.ACTIVE, scale, focalX, focalY },
        { state: State.END, scale, focalX, focalY },
    ]);
const drag = (translationX: number) =>
    fireGestureHandler(getByGestureTestId('photo-viewer-pan'), [
        { state: State.BEGAN, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, translationX, translationY: 0 },
        { state: State.END, translationX, translationY: 0, velocityX: 0 },
    ]);
const stageSize = () => screen.getByTestId('photo-viewer-stage').props.style.find((style: { width?: number }) => style?.width !== undefined) as { width: number; height: number };
const transformOf = (i: number) => Object.assign({}, ...screen.getByTestId('photo-viewer-zoom-' + i).props.style.transform);

it('troca de foto arrastando com um dedo quando a foto não está ampliada', async () => {
    await render(<ReportOverview detail={detail} apiBase={apiBase} token="sessao" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ampliar foto 1 da denúncia' }));
    const { width } = stageSize();
    await act(async () => drag(-width * 0.1));
    expect(screen.getByText('Foto 1 de 2')).toBeVisible();
    await act(async () => drag(-width * 0.5));
    expect(screen.getByText('Foto 2 de 2')).toBeVisible();
    // Past the last photo the strip only resists.
    await act(async () => drag(-width * 0.5));
    expect(screen.getByText('Foto 2 de 2')).toBeVisible();
});

it('amplia no ponto entre os dedos e no nível que a pinça escolher, sem botão de zoom', async () => {
    await render(<ReportOverview detail={detail} apiBase={apiBase} token="sessao" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ampliar foto 1 da denúncia' }));
    expect(screen.queryByRole('button', { name: /Aproximar|Restaurar zoom/ })).toBeNull();
    const { width, height } = stageSize();
    const focalX = width / 4;
    const focalY = height / 4;
    await act(async () => pinch(3.3, focalX, focalY));
    const transform = transformOf(0);
    // Any level, not a preset, and the point under the fingers stays put: x = (focal - centre) * (1 - scale).
    expect(transform.scale).toBeCloseTo(3.3);
    expect(transform.translateX).toBeCloseTo((focalX - width / 2) * (1 - 3.3));
    expect(transform.translateY).toBeCloseTo((focalY - height / 2) * (1 - 3.3));
    // While zoomed, a one-finger drag moves the photo instead of changing it.
    await act(async () => drag(-width * 0.5));
    expect(screen.getByText('Foto 1 de 2')).toBeVisible();
    // A double tap restores the photo.
    await act(async () => fireGestureHandler(getByGestureTestId('photo-viewer-double-tap'), [{ state: State.BEGAN }, { state: State.ACTIVE, x: 10, y: 10 }, { state: State.END }]));
    await act(async () => drag(-width * 0.5));
    expect(screen.getByText('Foto 2 de 2')).toBeVisible();
});

it('oferece o zoom ao TalkBack como ação de acessibilidade da foto ampliada', async () => {
    await render(<ReportOverview detail={detail} apiBase={apiBase} token="sessao" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ampliar foto 1 da denúncia' }));
    const photo = screen.getByLabelText('Foto 1 de 2 da denúncia, ampliada');
    expect(photo.props.accessibilityActions).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'activate', label: 'Aproximar' })]));
    await act(async () => fireEvent(photo, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }));
    expect(screen.getByLabelText('Foto 1 de 2 da denúncia, ampliada').props.accessibilityActions).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Restaurar zoom' })]));
});

it('começa a pinça de onde a foto está, mesmo no meio da volta aos limites', async () => {
    jest.useFakeTimers();
    try {
        await render(<ReportOverview detail={detail} apiBase={apiBase} token="sessao" />);
        await fireEvent.press(screen.getByRole('button', { name: 'Ampliar foto 1 da denúncia' }));
        const { width, height } = stageSize();
        await act(async () => pinch(2, width / 2, height / 2));
        // Drag the zoomed photo far past its edge; on release it springs back inside.
        await act(async () => drag(width * 2));
        await act(async () => {
            jest.advanceTimersByTime(60);
        });
        const midway = transformOf(0).translateX;
        expect(midway).toBeGreaterThan(width / 2);
        // A new pinch that does not change scale or focal must leave the photo where it is.
        await act(async () =>
            fireGestureHandler(getByGestureTestId('photo-viewer-pinch'), [
                { state: State.BEGAN, scale: 1, focalX: width / 2, focalY: height / 2 },
                { state: State.ACTIVE, scale: 1, focalX: width / 2, focalY: height / 2 },
                { state: State.ACTIVE, scale: 1, focalX: width / 2, focalY: height / 2 },
            ]),
        );
        expect(transformOf(0).translateX).toBeCloseTo(midway, 0);
    } finally {
        jest.useRealTimers();
    }
});

it('mantém fotos com prazo guardadas fora da tela enquanto aguarda uma leitura da API após reiniciar', async () => {
    const cached = { ...detail, photosExpireAt: new Date(Date.now() + 60_000).toISOString() };
    await render(<ReportOverview detail={cached} apiBase={apiBase} token="sessao" />);
    expect(screen.queryByLabelText('Foto 1 da denúncia')).toBeNull();
    expect(screen.getByText('Conecte-se para verificar a validade das fotos.')).toBeVisible();
    expect(screen.getByText(detail.description)).toBeVisible();
});

it.each(['timer', 'retorno da suspensão'])('remove as imagens do detalhe e da tela cheia offline via %s', async (wake) => {
    jest.useFakeTimers();
    try {
        let resume = () => {};
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
            resume = () => handler('active');
            return { remove: jest.fn() };
        });
        jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { headers: { 'X-MyCity-Server-Time': String(Date.now()) } }));
        await fetchWithServerTime(apiBase + '/reports/r');
        const closing = { ...detail, photosExpireAt: new Date(Date.now() + 3000).toISOString() };
        await render(<ReportOverview detail={closing} apiBase={apiBase} token="sessao" />);
        await fireEvent.press(screen.getByRole('button', { name: 'Ampliar foto 1 da denúncia' }));
        expect(screen.getByText('Foto 1 de 2')).toBeVisible();
        await act(async () => {
            if (wake === 'timer') jest.advanceTimersByTime(3000);
            else {
                const tick = performance.now();
                jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 4000);
                resume();
                expect(performance.now()).toBe(tick);
            }
        });
        expect(screen.queryByText('Foto 1 de 2')).toBeNull();
        expect(screen.queryByLabelText('Foto 1 da denúncia')).toBeNull();
        expect(screen.getByText('Fotos expiradas')).toBeVisible();
    } finally {
        jest.restoreAllMocks();
        jest.useRealTimers();
    }
});
