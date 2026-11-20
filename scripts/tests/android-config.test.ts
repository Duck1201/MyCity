import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('aplica um fundo branco à janela nativa depois da abertura do Android', () => {
    const result = spawnSync(process.execPath, ['../../node_modules/expo/bin/cli', 'config', '--type', 'introspect', '--json'], {
        cwd: fileURLToPath(new URL('../../apps/mobile', import.meta.url)),
        encoding: 'utf8',
        env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', EXPO_OFFLINE: '1', GOOGLE_MAPS_ANDROID_API_KEY: '' },
    });
    expect(result.status).toBe(0);
    const config = JSON.parse(result.stdout);
    const theme = config._internal.modResults.android.styles.resources.style.find((style: { $: { name: string } }) => style.$.name === 'AppTheme');
    expect(theme?.item).toContainEqual({ $: { name: 'android:windowBackground' }, _: '#ffffff' });
});
