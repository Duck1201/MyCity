import type { ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import type { ReportStatus } from '@mycity/contracts';
import { Icon } from './civic-header';
import { statusLabels } from '../report-overview';
import { colors, statusTint } from '../theme';
import { MotionPressable } from './motion-pressable';
import { ReportThumbnail } from './report-photo';
import { Text } from './typography';

type Props = {
    feed: boolean;
    protocol?: string;
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
    return (
        <View style={styles.card}>
            <MotionPressable accessibilityRole="button" accessibilityLabel={'Abrir ' + category} accessibilityHint={[protocol && 'Protocolo ' + protocol, statusLabels[status], description, update].filter(Boolean).join('. ')} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
                <View style={styles.body}>
                    <View style={styles.topline}>
                        <View style={[styles.status, { backgroundColor: tint.backgroundColor }]}>
                            <View style={[styles.dot, { backgroundColor: tint.color }]} />
                            <Text style={[styles.statusText, { color: tint.color }]}>{statusLabels[status]}</Text>
                        </View>
                        {protocol && (
                            <Text numberOfLines={1} ellipsizeMode="middle" style={styles.protocol}>
                                {protocol}
                            </Text>
                        )}
                    </View>
                    <View style={styles.details}>
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
                        {photo && <ReportThumbnail source={photo} label={'Foto da ocorrência: ' + description} />}
                        {!feed && !photo && <Icon name="next" size={17} color={colors.muted} />}
                    </View>
                    {!!update && (
                        <View style={styles.update}>
                            <Text numberOfLines={3} style={styles.updateText}>
                                {update}
                            </Text>
                        </View>
                    )}
                </View>
            </MotionPressable>
            <View style={styles.footer}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { overflow: 'hidden', borderColor: colors.line, borderWidth: 1, borderRadius: 14, backgroundColor: colors.surface },
    pressed: { backgroundColor: colors.pale },
    body: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
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
    update: { backgroundColor: colors.pale, borderLeftWidth: 2, borderColor: colors.teal, borderRadius: 3, paddingVertical: 8, paddingHorizontal: 10 },
    updateText: { color: colors.deepTeal, fontSize: 14, lineHeight: 20 },
    footer: { borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, paddingVertical: 6, paddingHorizontal: 14 },
});
