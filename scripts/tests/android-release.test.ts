import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

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
