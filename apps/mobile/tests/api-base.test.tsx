import { resolveApiBase } from '../src/api-base';

it.each([
    ['192.168.2.19:8081', '192.168.2.19'],
    ['computador.local:8181', 'computador.local'],
    ['[fd00::123]:8081', '[fd00::123]'],
    ['localhost:8081', '10.0.2.2'],
    ['127.0.0.1:8081', '10.0.2.2'],
    ['[::1]:8081', '10.0.2.2'],
    [undefined, '10.0.2.2'],
])('usa a API de desenvolvimento com a origem Metro %s', (metroHostUri, expectedHost) => {
    expect(resolveApiBase({ development: true, metroHostUri })).toBe('http://' + expectedHost + ':3000/api/v1');
});

it.each([true, false])('prioriza a URL explícita em development=%s', (development) => {
    expect(resolveApiBase({ development, configuredUrl: 'https://demo.test/api/v1///', metroHostUri: '192.168.2.19:8081' })).toBe('https://demo.test/api/v1');
});

it('preserva a API HTTPS da distribuição fora do desenvolvimento', () => {
    expect(resolveApiBase({ development: false, metroHostUri: '192.168.2.19:8081' })).toBe('https://mycity.private-gateway.site:8080/api/v1');
});

it('usa a porta da API escolhida ao iniciar os serviços de desenvolvimento', () => {
    expect(resolveApiBase({ development: true, metroHostUri: '192.168.2.19:8081', developmentPort: '3100' })).toBe('http://192.168.2.19:3100/api/v1');
});
