import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';

it('mantém o projeto Android gerado fora do Git e a configuração de release rastreável', () => {
    const generated = spawnSync('git', ['check-ignore', '--', 'apps/mobile/android/app/src/main/AndroidManifest.xml'], { encoding: 'utf8' });
    expect(generated.status, generated.stderr).toBe(0);
    const source = spawnSync('git', ['check-ignore', '--no-index', '--', 'apps/mobile/release-rules.pro'], { encoding: 'utf8' });
    expect(source.status, source.stderr).toBe(1);
});

it('configura o release gerado pelo Expo para preservar o construtor do banco do WorkManager', () => {
    const project = mkdtempSync(join(tmpdir(), 'mycity-android-release-'));
    try {
        for (const file of ['app.config.js', 'app.json', 'package.json', 'release-rules.pro']) copyFileSync(join('apps/mobile', file), join(project, file));
        symlinkSync(resolve('apps/mobile/assets'), join(project, 'assets'));
        symlinkSync(resolve('node_modules'), join(project, 'node_modules'));
        const run = spawnSync(resolve('node_modules/.bin/expo'), ['prebuild', '--platform', 'android', '--no-install', '--template', resolve('node_modules/expo/template.tgz')], {
            cwd: project,
            env: { PATH: process.env.PATH, HOME: project, CI: '1', EXPO_NO_DOTENV: '1', EXPO_OFFLINE: '1', EXPO_NO_TELEMETRY: '1' },
            encoding: 'utf8',
        });
        expect(run.status, run.stderr).toBe(0);
        const app = join(project, 'android/app');
        const rulesFile = /android\.buildTypes\.release\.proguardFile\(file\("([^"]+)"\)\)/.exec(readFileSync(join(app, 'build.gradle'), 'utf8'));
        expect(rulesFile).toBeTruthy();
        expect(readFileSync(resolve(app, rulesFile![1]!), 'utf8')).toMatch(/^-keep class androidx\.work\.impl\.WorkDatabase_Impl\s*\{\s*public <init>\(\);\s*\}/m);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

it('compila a tag aprovada e assina o APK em runner separado do build', () => {
    const release = parse(readFileSync('.github/workflows/release.yml', 'utf8'));
    expect(release.on).toEqual({ push: { tags: ['v*.*.*'] } });
    const { verify, 'android-build': build, 'android-sign': sign } = release.jobs;
    expect(verify).toBeDefined();
    expect(build.needs).toBe('verify');
    expect(build.environment).toBe('demonstration');
    expect(sign.environment).toBe('demonstration');
    expect(sign.needs).toEqual(['android-build', 'server-package']);
    expect(sign.if).toBe("${{ !cancelled() && needs.android-build.result == 'success' }}");
    expect(JSON.stringify(build)).not.toMatch(/secrets\.ANDROID_RELEASE/);
    expect(JSON.stringify(sign)).not.toMatch(/checkout@|gradlew|npm ci/);
    const steps = [...build.steps, ...sign.steps] as { name?: string; uses?: string; env?: Record<string, string>; with?: Record<string, string> }[];
    const stepsUsing = (secret: string) => steps.filter((step) => Object.values(step.env ?? {}).some((value) => value.includes('secrets.' + secret))).map((step) => step.name);
    expect(stepsUsing('GOOGLE_MAPS_ANDROID_API_KEY')).toEqual(['Generate native Android project']);
    expect(stepsUsing('ANDROID_RELEASE_KEYSTORE_BASE64')).toEqual(['Sign and verify APK']);
    expect(stepsUsing('ANDROID_RELEASE_STORE_PASSWORD')).toEqual(['Sign and verify APK']);
    const uploads = steps.filter((step) => step.uses?.startsWith('actions/upload-artifact@')).map((step) => step.with?.path?.trim().split('\n'));
    expect(uploads).toEqual([['apps/mobile/android/app/build/outputs/apk/release/app-release.apk']]);
    const publish = sign.steps.find((step: { name?: string }) => step.name === 'Attach APK to the GitHub release');
    expect(publish.run).toContain('gh release create');
    expect(publish.run).toContain('release/mycity.apk release/mycity.apk.sha256');
    expect(sign.permissions).toEqual({ contents: 'write' });
});
