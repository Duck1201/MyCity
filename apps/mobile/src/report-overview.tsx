import { categoryLabel } from './category-catalog';
import { ReportPhoto } from './components/report-photo';
import { mobileStyles, colors, statusTint } from './theme';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './components/typography';
import { type ReportDetail, type ReportStatus } from '@mycity/contracts';

export const statusLabels: Record<ReportStatus, string> = { SENT: 'Enviado', UNDER_REVIEW: 'Em análise', IN_PROGRESS: 'Em andamento', RESOLVED: 'Resolvido', REJECTED: 'Rejeitado', CANCELED: 'Cancelado' };

export function ReportOverview({ detail, apiBase, token }: { detail: ReportDetail; apiBase: string; token: string }) {
    return (
        <>
            <Text style={mobileStyles.heading}>{categoryLabel(detail)}</Text>
            <Text style={mobileStyles.body}>{detail.description}</Text>
            <Text style={[mobileStyles.status, statusTint(detail.status)]}>Status: {statusLabels[detail.status]}</Text>
            <View style={styles.author}>
                {detail.author && <Image source={{ uri: detail.author.photoUrl }} accessibilityLabel="Foto do autor" style={styles.avatar} />}
                <Text style={mobileStyles.body}>Autor: {detail.author?.name ?? 'Anônimo'}</Text>
            </View>
            <Text style={mobileStyles.meta}>
                Coordenadas: {detail.location.latitude}, {detail.location.longitude}
            </Text>
            {detail.photos.map((photo, i) => (
                <ReportPhoto key={photo.id} apiBase={apiBase} token={token} path={photo.contentPath} label={'Foto ' + (i + 1) + ' da denúncia'} />
            ))}
        </>
    );
}
const styles = StyleSheet.create({ author: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.line } });
