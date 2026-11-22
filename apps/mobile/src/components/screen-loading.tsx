import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, mobileStyles } from '../theme';
import { Text } from './typography';

export function ScreenLoading({ label }: { label: string }) {
    return (
        <View style={styles.loading} accessible accessibilityRole="progressbar" accessibilityLabel={label} aria-busy={true}>
            <ActivityIndicator accessible={false} color={colors.teal} />
            <Text accessible={false} style={mobileStyles.meta}>
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({ loading: { flex: 1, minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.canvas } });
