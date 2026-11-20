import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';
import { Text } from '../components/typography';
import { colors } from '../theme';
import lake from './photos/cidade.webp';

// Lucide outlines.
const icons = {
    pin: (
        <>
            <Path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
            <Circle cx="12" cy="10" r="3" />
        </>
    ),
    inbox: (
        <>
            <Polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <Path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </>
    ),
    feed: (
        <>
            <Path d="M15 18h-5" />
            <Path d="M18 14h-8" />
            <Path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" />
            <Rect width="8" height="4" x="10" y="6" rx="1" />
        </>
    ),
    map: (
        <>
            <Path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
            <Path d="M15 5.764v15" />
            <Path d="M9 3.236v15" />
        </>
    ),
    alerts: (
        <>
            <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <Path d="M12 9v4" />
            <Path d="M12 17h.01" />
        </>
    ),
    bell: (
        <>
            <Path d="M10.268 21a2 2 0 0 0 3.464 0" />
            <Path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
        </>
    ),
    settings: (
        <>
            <Path d="M10 5H3" />
            <Path d="M12 19H3" />
            <Path d="M14 3v4" />
            <Path d="M16 17v4" />
            <Path d="M21 12h-9" />
            <Path d="M21 19h-5" />
            <Path d="M21 5h-7" />
            <Path d="M8 10v4" />
            <Path d="M8 12H3" />
        </>
    ),
    add: (
        <>
            <Path d="M5 12h14" />
            <Path d="M12 5v14" />
        </>
    ),
    back: (
        <>
            <Path d="m12 19-7-7 7-7" />
            <Path d="M19 12H5" />
        </>
    ),
    next: <Path d="m9 18 6-6-6-6" />,
};
export type IconName = keyof typeof icons;
export function Icon({ name, color = colors.teal, size = 21 }: { name: IconName; color?: string; size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...(Platform.OS !== 'web' && { accessible: false })} aria-hidden={true} focusable={false}>
            {icons[name]}
        </Svg>
    );
}
export function CivicHeader({ home, onScenarios, onNotifications }: { home: boolean; onScenarios: () => void; onNotifications: () => void }) {
    return (
        <View style={styles.header}>
            <View style={styles.identity}>
                <View style={styles.mark}>
                    <Icon name="pin" color="white" size={25} />
                </View>
                <View style={styles.brandText}>
                    <Text style={styles.brand}>MyCity</Text>
                    <Text style={styles.caption}>Prévia do cidadão</Text>
                </View>
            </View>
            {home && (
                <View style={styles.actions}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Notificações" onPress={onNotifications} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                        <Icon name="bell" />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Cenários" onPress={onScenarios} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                        <Icon name="settings" />
                    </Pressable>
                </View>
            )}
        </View>
    );
}
export function CitizenCover({ open, closed, ready }: { open: number; closed: number; ready: boolean }) {
    return (
        <View style={styles.cover}>
            <Image source={lake} style={styles.lake} resizeMode="cover" accessible={false} />
            <View style={styles.coverContent}>
                <View style={styles.place}>
                    <Icon name="pin" color="#e8f2fc" size={16} />
                    <Text style={styles.placeName}>Viçosa, Minas Gerais</Text>
                </View>
                {ready && (
                    <View style={styles.metrics}>
                        <View accessible accessibilityLabel={open + (open === 1 ? ' denúncia em aberto' : ' denúncias em aberto')} style={styles.metric}>
                            <Text style={styles.number}>{open}</Text>
                            <Text style={styles.metricLabel}>Em aberto</Text>
                        </View>
                        <View accessible accessibilityLabel={closed + (closed === 1 ? ' denúncia encerrada' : ' denúncias encerradas')} style={[styles.metric, styles.lastMetric]}>
                            <Text style={styles.number}>{closed}</Text>
                            <Text style={styles.metricLabel}>{closed === 1 ? 'Encerrada' : 'Encerradas'}</Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}
const styles = StyleSheet.create({
    header: { minHeight: 60, backgroundColor: 'white', borderBottomWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
    brandText: { flexShrink: 1 },
    mark: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#316ba9', width: 35, height: 39, borderRadius: 12, borderBottomLeftRadius: 3 },
    brand: { fontSize: 23, color: colors.ink, fontWeight: '800', letterSpacing: -0.9 },
    caption: { fontSize: 12, color: colors.muted },
    actions: { flexDirection: 'row' },
    iconButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    pressed: { backgroundColor: colors.pale },
    cover: { overflow: 'hidden', backgroundColor: '#0b2339', borderRadius: 8, minHeight: 134, justifyContent: 'center' },
    lake: { position: 'absolute', width: '100%', height: '100%', opacity: 0.34 },
    coverContent: { padding: 17, gap: 4 },
    place: { flexDirection: 'row', gap: 5, alignItems: 'center' },
    placeName: { fontSize: 16, color: '#e8f2fc', fontWeight: '700' },
    metrics: { marginTop: 5, alignItems: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    metric: { gap: 0 },
    lastMetric: { paddingLeft: 14, borderLeftWidth: 1, borderColor: '#adc6d6' },
    number: { fontSize: 24, fontWeight: '800', color: 'white' },
    metricLabel: { fontSize: 14, fontWeight: '600', color: 'white' },
});
