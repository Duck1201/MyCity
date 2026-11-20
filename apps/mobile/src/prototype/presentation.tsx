import { Pressable, StyleSheet } from 'react-native';
import { ReportCard } from '../components/report-card';
import { ReportConfirmation, confirmationLabel } from '../report-confirmation';
import { Text } from '../components/typography';
import { colors, statusTint } from '../theme';
import { statusLabels } from '../report-overview';
import { categoryName, type Case } from './fixtures';

import { Icon, type IconName } from './civic-header';

const blue = colors.teal;
const ink = colors.ink;
export const s = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: 18, paddingVertical: 22, gap: 20 },
    title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.4, color: ink },
    heading: { fontSize: 19, fontWeight: '700', color: ink },
    text: { fontSize: 16, color: ink, lineHeight: 23 },
    meta: { fontSize: 14, color: '#4b6078', lineHeight: 20 },
    card: { padding: 18, gap: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: 'white' },
    row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
    grow: { flex: 1 },
    photoLink: { color: colors.teal, textDecorationLine: 'underline' },
    picture: { width: '100%', height: 170, borderRadius: 8 },
    note: { padding: 12, gap: 6, backgroundColor: '#e8f0f9', borderLeftColor: blue, borderLeftWidth: 3 },
    button: { flexDirection: 'row', gap: 7, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
    primary: { backgroundColor: blue },
    buttonText: { color: ink, fontSize: 15, fontWeight: '700', textAlign: 'center' },
    primaryText: { color: 'white' },
    pressed: { opacity: 0.72 },
    disabled: { opacity: 0.55 },
    feedFilter: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: 12, backgroundColor: colors.pale },
    feedSegment: { flex: 1, paddingVertical: 8, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    selectedSegment: { backgroundColor: blue },
    nav: { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderColor: '#c8d3e0' },
    navItem: { minHeight: 66, flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 4, paddingTop: 9, paddingBottom: 6, gap: 3 },
    navActive: { backgroundColor: '#e9f0f8' },
    tabIcon: { height: 20, justifyContent: 'center', alignItems: 'center' },
    scenarioList: { borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
    scenarioRow: { minHeight: 58, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    navText: { userSelect: 'none', lineHeight: 18, fontSize: 13, fontWeight: '700', color: ink, textAlign: 'center' },
    listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
    linkButton: { alignSelf: 'flex-start', backgroundColor: 'transparent', paddingHorizontal: 0 },
    notice: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, backgroundColor: colors.pale, borderRadius: 8 },
    field: { padding: 12, minHeight: 94, color: ink, backgroundColor: '#f8fafd', borderRadius: 8, borderWidth: 1, borderColor: '#96a6ba', fontSize: 16, textAlignVertical: 'top' },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: { borderRadius: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, fontWeight: '700' },
    map: { height: 290 },
});
export function Button({ label, onPress, primary = false, disabled = false, icon, link = false, selected }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; icon?: IconName; link?: boolean; selected?: boolean }) {
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }} onPress={onPress} style={({ pressed }) => [s.button, link && s.linkButton, primary && s.primary, disabled && s.disabled, pressed && s.pressed]}>
            {icon && <Icon name={icon} size={18} color={primary ? 'white' : blue} />}
            <Text style={[s.buttonText, primary && s.primaryText]}>{label}</Text>
        </Pressable>
    );
}
export function Badge({ item }: { item: Case }) {
    return <Text style={[s.badge, statusTint(item.status)]}>{statusLabels[item.status]}</Text>;
}
export function CaseCard({ item, onPress, onConfirm }: { item: Case; onPress: () => void; onConfirm?: (confirmed: boolean) => void | Promise<void> }) {
    const name = categoryName(item.category);
    const inFeed = !!onConfirm;
    const hasUpdate = item.update !== statusLabels[item.status];
    return (
        <ReportCard feed={inFeed} protocol={'MC-' + item.id} category={name} description={item.description} status={item.status} when={item.when} place={item.place} update={!inFeed && hasUpdate ? item.update : undefined} photo={item.photo.image} onPress={onPress}>
            {onConfirm ? <ReportConfirmation report={{ ...item, isMine: item.mine }} context={'protocolo MC-' + item.id} onChange={async (confirmed) => onConfirm(confirmed)} /> : <Text style={s.meta}>{confirmationLabel(item.confirmationCount)}</Text>}
        </ReportCard>
    );
}
