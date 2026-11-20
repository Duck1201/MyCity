import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ScreenTransition } from './components/navigation-motion';
import { Text } from './components/typography';
import type { WeatherAlert } from '@mycity/contracts';
import type { CitizenRequest } from './citizen-api';
import { colors, mobileStyles } from './theme';
import { ActionButton } from './components/action-button';
import { useActiveQuery } from './use-active-query';

const levels = {
    ATTENTION: { label: 'Atenção', background: '#fef3c7', color: '#713f12' },
    ALERT: { label: 'Alerta', background: '#ffedd5', color: '#9a3412' },
    EMERGENCY: { label: 'Emergência', background: '#fee2e2', color: colors.danger },
};
const demoDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

function Level({ level }: { level: WeatherAlert['level'] }) {
    const { label, color, background } = levels[level];
    return <Text style={[styles.level, { color, backgroundColor: background }]}>{label}</Text>;
}

function Heading({ title }: { title: string }) {
    return (
        <View style={styles.headingBlock}>
            <Text style={styles.simulation}>Simulação climática</Text>
            <Text accessibilityRole="header" style={styles.title}>
                {title}
            </Text>
        </View>
    );
}

function Feedback({ failed, retry, loading }: { failed: boolean; retry: () => void; loading: boolean }) {
    if (failed)
        return (
            <View style={styles.feedback}>
                <Text accessibilityLiveRegion="polite" style={styles.body}>
                    Não foi possível consultar os cenários. Confira sua conexão e tente novamente.
                </Text>
                <ActionButton label="Tentar novamente" onPress={retry} />
            </View>
        );
    if (loading)
        return (
            <Text style={styles.body} accessibilityLiveRegion="polite">
                Carregando cenários…
            </Text>
        );
    return null;
}

type Page = { data: WeatherAlert[]; page: { nextCursor: string | null } };
function AlertList({ request, cursors, setCursors, open }: { request: CitizenRequest; cursors: (string | null)[]; setCursors: (next: (string | null)[]) => void; open: (id: string) => void }) {
    const cursor = cursors.at(-1);
    const path = cursor ? '/weather-alerts?cursor=' + encodeURIComponent(cursor) : '/weather-alerts';
    const load = useCallback((signal: AbortSignal) => request<Page>(path, signal), [request, path]);
    const query = useActiveQuery(load);
    const nextCursor = query.data?.page.nextCursor;
    return (
        <ScrollView contentContainerStyle={styles.page}>
            <Heading title="Alertas climáticos" />
            <Text style={styles.description}>Cenários fictícios de 25 de novembro de 2026.</Text>
            <Feedback loading={!query.data} failed={query.failed} retry={query.retry} />
            {query.data?.data.length === 0 && <Text style={styles.body}>Nenhum cenário disponível.</Text>}
            {query.data?.data.map((alert) => (
                <Pressable key={alert.id} accessibilityRole="button" onPress={() => open(alert.id)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                    <Level level={alert.level} />
                    <Text style={styles.cardTitle}>{alert.title}</Text>
                    <Text style={styles.description}>{alert.regionLabel}</Text>
                </Pressable>
            ))}
            {(cursors.length > 1 || nextCursor) && (
                <View style={styles.pager}>
                    <Text style={styles.description}>Página {cursors.length}</Text>
                    {cursors.length > 1 && <ActionButton label="Página anterior" onPress={() => setCursors(cursors.slice(0, -1))} />}
                    {nextCursor && <ActionButton label="Próxima página" onPress={() => setCursors([...cursors, nextCursor])} />}
                </View>
            )}
        </ScrollView>
    );
}
function AlertDetail({ request, id, back }: { request: CitizenRequest; id: string; back: () => void }) {
    const load = useCallback((signal: AbortSignal) => request<{ data: WeatherAlert }>('/weather-alerts/' + encodeURIComponent(id), signal), [request, id]);
    const query = useActiveQuery(load);
    const alert = query.data?.data;
    return (
        <ScrollView contentContainerStyle={styles.page}>
            <Pressable accessibilityRole="button" onPress={back} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
                <Text style={styles.backLabel}>Voltar aos alertas</Text>
            </Pressable>
            <Heading title={alert?.title ?? 'Detalhes do cenário'} />
            {query.unavailable ? (
                <Text accessibilityLiveRegion="polite" style={styles.body}>
                    Este cenário está indisponível.
                </Text>
            ) : (
                <Feedback loading={!alert} failed={query.failed} retry={query.retry} />
            )}
            {alert && (
                <>
                    <Level level={alert.level} />
                    <Text style={styles.body}>{alert.message}</Text>
                    <View style={styles.metadata}>
                        <Text style={styles.metaLabel}>Região ilustrativa</Text>
                        <Text style={styles.body}>{alert.regionLabel}</Text>
                        <Text style={styles.metaLabel}>Período fictício · horário de Brasília</Text>
                        <Text style={styles.body}>
                            {demoDate.format(new Date(alert.issuedAt))} até {demoDate.format(new Date(alert.expiresAt))}
                        </Text>
                    </View>
                </>
            )}
        </ScrollView>
    );
}

export function WeatherAlerts({ request }: { request: CitizenRequest }) {
    const [id, setId] = useState<string | null>(null);
    const [cursors, setCursors] = useState<(string | null)[]>([null]);
    useEffect(() => {
        if (!id) return;
        const listener = BackHandler.addEventListener('hardwareBackPress', () => {
            setId(null);
            return true;
        });
        return () => listener.remove();
    }, [id]);
    return (
        <ScreenTransition route={id ?? 'alerts'} depth={id ? 1 : 0}>
            {id ? <AlertDetail request={request} id={id} back={() => setId(null)} /> : <AlertList key={cursors.at(-1) ?? 'initial'} request={request} cursors={cursors} setCursors={setCursors} open={setId} />}
        </ScreenTransition>
    );
}

const styles = StyleSheet.create({
    page: mobileStyles.page,
    headingBlock: { gap: 4 },
    simulation: { color: colors.teal, fontSize: 14, fontWeight: '700' },
    title: mobileStyles.title,
    description: mobileStyles.meta,
    body: mobileStyles.body,
    level: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, fontSize: 14, fontWeight: '700' },
    card: mobileStyles.card,
    cardTitle: { fontWeight: '700', fontSize: 19, color: colors.ink },
    pressed: { backgroundColor: colors.pale },
    feedback: mobileStyles.message,
    pager: { gap: 8 },
    back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
    backLabel: { color: colors.teal, fontWeight: '700', fontSize: 16 },
    metadata: { marginTop: 8, padding: 16, gap: 6, borderRadius: 10, backgroundColor: '#f1f5f9' },
    metaLabel: { fontSize: 14, fontWeight: '600', color: colors.muted },
});
