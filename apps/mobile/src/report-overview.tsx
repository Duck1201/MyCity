import { usePhotoExpiry } from './use-photo-expiry';
import { confirmationLabel } from './report-confirmation';
import { categoryLabel } from './category-catalog';
import { useState } from 'react';
import { ReportPhoto, reportPhotoSource } from './components/report-photo';
import { PhotoViewer } from './components/photo-viewer';
import { mobileStyles, colors, statusTint } from './theme';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './components/typography';
import { type ReportDetail, type ReportStatus } from '@mycity/contracts';

export const statusLabels: Record<ReportStatus, string> = { SENT: 'Enviado', UNDER_REVIEW: 'Em análise', IN_PROGRESS: 'Em andamento', RESOLVED: 'Resolvido', REJECTED: 'Rejeitado', CANCELED: 'Cancelado' };

export function ReportOverview({ detail, apiBase, token }: { detail: ReportDetail; apiBase: string; token: string }) {
    const [viewing, setViewing] = useState<number | null>(null);
    const { hidden, waitingForTime } = usePhotoExpiry([detail]);
    const photosHidden = hidden(detail.photosExpireAt) || (!!detail.photosExpireAt && !detail.photos.length);
    const photos = photosHidden ? [] : detail.photos;
    const viewable = photos.flatMap((photo) => {
        const source = reportPhotoSource(photo.contentPath, apiBase, token);
        return source ? [{ id: photo.id, source }] : [];
    });
    return (
        <View style={styles.overview}>
            <View style={styles.heading}>
                <Text accessibilityRole="header" style={mobileStyles.heading}>
                    {categoryLabel(detail)}
                </Text>
                <Text style={[mobileStyles.status, statusTint(detail.status)]}>Status: {statusLabels[detail.status]}</Text>
            </View>
            <Text style={mobileStyles.body}>{detail.description}</Text>
            <View testID="report-metadata" style={styles.metadata}>
                <View style={styles.author}>
                    {detail.author && <Image source={{ uri: detail.author.photoUrl }} accessibilityLabel="Foto do autor" style={styles.avatar} />}
                    <Text style={mobileStyles.body}>Autor: {detail.author?.name ?? 'Anônimo'}</Text>
                </View>
                <Text style={mobileStyles.meta}>
                    Coordenadas: {detail.location.latitude}, {detail.location.longitude}
                </Text>
                {detail.isMine && <Text style={mobileStyles.meta}>{confirmationLabel(detail.confirmationCount)}</Text>}
            </View>
            {photosHidden && (
                <Text style={mobileStyles.meta} accessibilityLiveRegion="polite">
                    {detail.photos.length && waitingForTime ? 'Conecte-se para verificar a validade das fotos.' : 'Fotos expiradas'}
                </Text>
            )}
            {photos.length > 0 && (
                <View testID="report-photos" style={styles.photos}>
                    {photos.map((photo, i) => (
                        <View key={photo.id} style={styles.photo}>
                            <ReportPhoto apiBase={apiBase} token={token} path={photo.contentPath} index={i} width={photo.width} height={photo.height} onExpand={() => setViewing(i)} />
                        </View>
                    ))}
                </View>
            )}
            {viewing !== null && viewable.length > 0 && <PhotoViewer photos={viewable} start={Math.min(viewing, viewable.length - 1)} onClose={() => setViewing(null)} />}
        </View>
    );
}
const styles = StyleSheet.create({
    overview: { ...mobileStyles.card, gap: 8 },
    photos: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    photo: { flex: 1, minWidth: 0 },
    heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    metadata: { gap: 3, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 6 },
    author: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.line },
});
