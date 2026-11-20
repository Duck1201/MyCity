type ApiEnvironment = {
    development: boolean;
    developmentPort?: string | undefined;
    configuredUrl?: string | undefined;
    metroHostUri?: string | undefined;
};

export function resolveApiBase({ development, configuredUrl, metroHostUri, developmentPort = '3000' }: ApiEnvironment): string {
    const override = configuredUrl?.trim().replace(/\/+$/, '');
    if (override) return override;
    if (!development) return 'https://mycity.private-gateway.site:8080/api/v1';

    // Android Studio exposes the development computer's loopback at 10.0.2.2.
    const emulatorHost = '10.0.2.2';
    const host = metroHostUri ? new URL('http://' + metroHostUri).hostname : emulatorHost;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(host);
    return 'http://' + (local ? emulatorHost : host) + ':' + developmentPort + '/api/v1';
}
