import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <Text style={styles.title}>MyCity</Text>
            <Text style={styles.subtitle}>Sua cidade, sua voz.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: 24,
    },
    title: {
        fontSize: 40,
        fontWeight: '700',
        color: '#155e75',
        letterSpacing: -1,
    },
    subtitle: { fontSize: 18, color: '#475569', marginTop: 12 },
});
