import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { type ReportStatus } from '@mycity/contracts';
import { colors, mobileStyles } from '../theme';
import { statusLabels } from '../report-overview';
import { Icon } from '../prototype/civic-header';
import { MotionPressable } from './motion-pressable';
import { ReportThumbnail } from './report-photo';
import { Text } from './typography';

type Highlight = { description: string; category: string; status: ReportStatus; photo?: ImageSourcePropType | undefined };
type Props = { report?: Highlight | undefined; message?: string | undefined; open: () => void; feed: () => void };

export function CommunityHighlight({ report, message, open, feed }: Props) {
    return (
        <View style={styles.section}>
            <View style={styles.heading}>
                <Text accessibilityRole="header" style={mobileStyles.heading}>
                    Na cidade
                </Text>
                <MotionPressable accessibilityRole="button" accessibilityLabel="Ver feed" onPress={feed} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                    <Text style={styles.linkText}>Ver feed</Text>
                    <Icon name="next" size={15} color={colors.teal} />
                </MotionPressable>
            </View>
            {report && (
                <MotionPressable accessibilityRole="button" accessibilityLabel={'Abrir ocorrência: ' + report.description} accessibilityHint={report.category + '. ' + statusLabels[report.status]} onPress={open} style={({ pressed }) => [styles.story, pressed && styles.pressed]}>
                    {report.photo && <ReportThumbnail source={report.photo} />}
                    <View style={styles.copy}>
                        <Text style={styles.category}>{report.category}</Text>
                        <Text style={styles.title} numberOfLines={2}>
                            {report.description}
                        </Text>
                        <Text style={mobileStyles.meta}>{statusLabels[report.status]}</Text>
                    </View>
                </MotionPressable>
            )}
            {!!message && (
                <Text accessibilityLiveRegion="polite" style={mobileStyles.meta}>
                    {message}
                </Text>
            )}
        </View>
    );
}
const styles = StyleSheet.create({
    section: { gap: 4 },
    heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
    link: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 44, paddingHorizontal: 4 },
    linkText: { color: colors.teal, fontWeight: '700', fontSize: 14 },
    story: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 12, gap: 14 },
    copy: { flex: 1, gap: 3, minWidth: 0 },
    category: { color: colors.teal, fontSize: 13, fontWeight: '700' },
    title: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: colors.ink },
    pressed: { backgroundColor: colors.pale },
});
