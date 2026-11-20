import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import icon from '../../assets/icon.png';
import { colors } from '../theme';
import { Text } from './typography';

export function AppLoadingScreen() {
    return (
        <View style={styles.screen} accessible accessibilityRole="progressbar" accessibilityLabel="Abrindo MyCity" accessibilityState={{ busy: true }}>
            <Image source={icon} style={styles.icon} accessible={false} />
            <Text style={styles.brand}>MyCity</Text>
            <ActivityIndicator color={colors.teal} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.surface },
    icon: { width: 80, height: 80 },
    brand: { color: colors.ink, fontSize: 32, fontWeight: '800', marginTop: 12, marginBottom: 24 },
});
