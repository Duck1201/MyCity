import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import type { ReportStatus } from '@mycity/contracts';
import { Icon } from '../prototype/civic-header';
import { statusLabels } from '../report-overview';
import { colors, statusTint } from '../theme';
import { Text } from './typography';

type Props = {
    feed: boolean;
    protocol: string;
    category: string;
    description: string;
    status: ReportStatus;
    when: string;
    photo?: ImageSourcePropType | undefined;
    place?: string;
    update?: string | undefined;
    onPress: () => void;
    children: ReactNode;
};

export function ReportCard({ feed, protocol, category, description, status, when, photo, place, update, onPress, children }: Props) {
    const tint = statusTint(status);
    const image = photo ? (
        <View style={feed ? styles.cover : styles.thumb}>
            <Image accessibilityLabel={'Foto da ocorrência: ' + description} source={photo} resizeMode="cover" style={styles.photo} />
        </View>
    ) : null;
    return (
        <View style={styles.card}>
            <Pressable accessibilityRole="button" accessibilityLabel={'Abrir ' + category} accessibilityHint={['Protocolo ' + protocol, statusLabels[status], description, update].filter(Boolean).join('. ')} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
                {feed && image}
                <View style={styles.body}>
                    <View style={styles.topline}>
                        <View style={[styles.status, { backgroundColor: tint.backgroundColor }]}>
                            <View style={[styles.dot, { backgroundColor: tint.color }]} />
                            <Text style={[styles.statusText, { color: tint.color }]}>{statusLabels[status]}</Text>
                        </View>
                        <Text numberOfLines={1} ellipsizeMode="middle" style={styles.protocol}>
                            {protocol}
                        </Text>
                    </View>
                    <View style={styles.details}>
                        {!feed && image}
                        <View style={styles.copy}>
                            <Text style={styles.category}>{category}</Text>
                            <Text numberOfLines={3} style={styles.title}>
                                {description}
                            </Text>
                            {place && (
                                <View style={styles.location}>
                                    <Icon name="pin" size={14} color={colors.muted} />
                                    <Text style={styles.place}>{place}</Text>
                                </View>
                            )}
                            <Text style={styles.date}>{when}</Text>
                        </View>
                        {!feed && <Icon name="next" size={17} color={colors.muted} />}
                    </View>
                    {!!update && (
                        <View style={styles.update}>
                            <Text numberOfLines={3} style={styles.updateText}>
                                {update}
                            </Text>
                        </View>
                    )}
                </View>
            </Pressable>
            <View style={styles.footer}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { overflow: 'hidden', borderColor: colors.line, borderWidth: 1, borderRadius: 14, backgroundColor: colors.surface },
    pressed: { backgroundColor: colors.pale },
    cover: { width: '100%', aspectRatio: 2.1, maxHeight: 200, backgroundColor: colors.pale },
    photo: { width: '100%', height: '100%' },
    thumb: { width: 56, height: 66, borderRadius: 7, overflow: 'hidden', backgroundColor: colors.pale },
    body: { padding: 16, gap: 13 },
    topline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 20 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 13, fontWeight: '800' },
    protocol: { flex: 1, minWidth: 72, textAlign: 'right', color: colors.muted, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
    details: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    copy: { flex: 1, minWidth: 0, gap: 4 },
    category: { color: colors.teal, fontSize: 13, fontWeight: '800' },
    title: { color: colors.ink, fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.35 },
    location: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    place: { flexShrink: 1, color: colors.muted, fontSize: 14, lineHeight: 19 },
    date: { color: colors.muted, fontSize: 13 },
    update: { backgroundColor: '#eef4f9', borderLeftWidth: 2, borderColor: colors.teal, borderRadius: 3, paddingVertical: 8, paddingHorizontal: 10 },
    updateText: { color: colors.deepTeal, fontSize: 14, lineHeight: 20 },
    footer: { borderTopWidth: 1, borderColor: colors.line, backgroundColor: '#f6f9fc', paddingVertical: 9, paddingHorizontal: 16 },
});
