import { categoryLabel } from './category-catalog';
import { ReportPhoto } from './components/report-photo';
import { mobileStyles, colors, statusTint } from './theme';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './components/typography';
import { type ReportDetail, type ReportStatus } from '@mycity/contracts';

export const statusLabels: Record<ReportStatus, string> = { SENT: 'Enviado', UNDER_REVIEW: 'Em análise', IN_PROGRESS: 'Em andamento', RESOLVED: 'Resolvido', REJECTED: 'Rejeitado', CANCELED: 'Cancelado' };

export function ReportOverview({ detail, apiBase, token }: { detail: ReportDetail; apiBase: string; token: string }) {
    return (
        <View style={styles.overview}>
            <View style={styles.heading}>
                <Text accessibilityRole="header" style={mobileStyles.heading}>
                    {categoryLabel(detail)}
                </Text>
                <Text style={[mobileStyles.status, statusTint(detail.status)]}>Status: {statusLabels[detail.status]}</Text>
            </View>
            <Text style={mobileStyles.body}>{detail.description}</Text>
            <View style={styles.metadata}>
                <View style={styles.author}>
                    {detail.author && <Image source={{ uri: detail.author.photoUrl }} accessibilityLabel="Foto do autor" style={styles.avatar} />}
                    <Text style={mobileStyles.body}>Autor: {detail.author?.name ?? 'Anônimo'}</Text>
                </View>
                <Text style={mobileStyles.meta}>
                    Coordenadas: {detail.location.latitude}, {detail.location.longitude}
                </Text>
            </View>
            {detail.photos.map((photo, i) => (
                <ReportPhoto key={photo.id} apiBase={apiBase} token={token} path={photo.contentPath} index={i} width={photo.width} height={photo.height} />
            ))}
        </View>
    );
}
const styles = StyleSheet.create({
    overview: { ...mobileStyles.card, gap: 14 },
    heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    metadata: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 10 },
    author: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.line },
});
