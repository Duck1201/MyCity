import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';

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

it('compila a revisão aprovada e assina o APK em runner separado do build', () => {
    const release = parse(readFileSync('.github/workflows/android-release.yml', 'utf8'));
    expect(release.on).toEqual({ workflow_run: { workflows: ['CI'], types: ['completed'], branches: ['main'] } });
    const { build, sign } = release.jobs;
    expect(build.if).toContain("github.event.workflow_run.event == 'push'");
    expect(build.if).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(build.if).toContain('github.event.workflow_run.head_repository.full_name == github.repository');
    expect(build.steps[0].with.ref).toBe('${{ github.event.workflow_run.head_sha }}');
    expect(build.environment).toBe('demonstration');
    expect(sign.environment).toBe('demonstration');
    expect(sign.needs).toBe('build');
    expect(JSON.stringify(build)).not.toMatch(/secrets\.ANDROID_RELEASE/);
    expect(JSON.stringify(sign)).not.toMatch(/checkout@|gradlew|npm ci/);
    const steps = [...build.steps, ...sign.steps] as { name?: string; uses?: string; env?: Record<string, string>; with?: Record<string, string> }[];
    const stepsUsing = (secret: string) => steps.filter((step) => Object.values(step.env ?? {}).some((value) => value.includes('secrets.' + secret))).map((step) => step.name);
    expect(stepsUsing('GOOGLE_MAPS_ANDROID_API_KEY')).toEqual(['Generate native Android project']);
    expect(stepsUsing('ANDROID_RELEASE_KEYSTORE_BASE64')).toEqual(['Sign and verify APK']);
    expect(stepsUsing('ANDROID_RELEASE_STORE_PASSWORD')).toEqual(['Sign and verify APK']);
    const uploads = steps.filter((step) => step.uses?.startsWith('actions/upload-artifact@')).map((step) => step.with?.path?.trim().split('\n'));
    expect(uploads).toEqual([['apps/mobile/android/app/build/outputs/apk/release/app-release.apk'], ['release/mycity.apk', 'release/mycity.apk.sha256']]);
});
