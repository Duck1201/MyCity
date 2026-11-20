import { withAppBuildGradle } from 'expo/config-plugins';

const releaseRules = 'android.buildTypes.release.proguardFile(file("../../release-rules.pro"))';

export default ({ config }) =>
    withAppBuildGradle(
        {
            ...config,
            plugins: [...(config.plugins ?? []), ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY }], ['expo-image-picker', { microphonePermission: false }], 'expo-location', 'expo-secure-store'],
        },
        (mod) => {
            if (!mod.modResults.contents.includes(releaseRules)) mod.modResults.contents += '\n' + releaseRules + '\n';
            return mod;
        },
    );
