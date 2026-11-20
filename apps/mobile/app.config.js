module.exports = ({ config }) => ({
    ...config,
    plugins: [...(config.plugins ?? []), ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY }], ['expo-image-picker', { microphonePermission: false }], 'expo-location', 'expo-secure-store'],
});
