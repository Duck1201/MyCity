import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput } from '../components/typography';
import { categories, categoryName, type Photo, type ReportPhotos, type Category } from './fixtures';
import { PhotoAttachments } from './case-photos';
import { ChoiceField } from './choice-field';
import { colors } from '../theme';
import { Button, s } from './presentation';

const categoryOptions = categories.map((value) => ({ value, label: categoryName(value) }));

export type Draft = { category: Category | null; description: string; located: boolean; photos: Photo[] };
export const emptyDraft: Draft = { category: null, description: '', located: false, photos: [] };

export function CreateCase({ draft, onChange, onSent }: { draft: Draft; onChange: (draft: Draft) => void; onSent: (category: Category, description: string, photos: ReportPhotos) => void }) {
    const { category, description, located, photos } = draft;
    const [fail, simulate] = useState(false);
    const [message, feedback] = useState('');
    const [sending, setSending] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );
    function submit() {
        const [first, ...rest] = photos;
        if (timer.current || !category || !description.trim() || !located || !first || photos.length > 3) return;
        feedback('');
        setSending(true);
        timer.current = setTimeout(() => {
            timer.current = null;
            setSending(false);
            if (fail) {
                simulate(false);
                feedback('O envio falhou. Seus dados estão salvos nesta tela.');
            } else onSent(category, description.trim(), [first, ...rest]);
        }, 350);
    }
    const ready = Boolean(category && description.trim() && located && photos.length > 0 && photos.length <= 3);
    return (
        <>
            <View style={styles.form}>
                <View style={styles.block}>
                    <ChoiceField<Category> label="Categoria" placeholder="Selecionar categoria" value={category} options={categoryOptions} disabled={sending} onChange={(next) => onChange({ ...draft, category: next })} />
                    <View style={styles.field}>
                        <Text style={styles.label}>Relato</Text>
                        <TextInput accessibilityLabel="Relato" placeholder="Descreva o que você encontrou" placeholderTextColor={colors.muted} multiline maxLength={1000} editable={!sending} value={description} onChangeText={(text) => onChange({ ...draft, description: text })} style={styles.input} />
                    </View>
                </View>
                <View style={styles.attachments}>
                    <View style={styles.attachment}>
                        <Text style={styles.sectionTitle}>Localização</Text>
                        <Text style={s.meta}>{located ? 'Rua dos Passos, Centro' : 'Indique onde está a ocorrência.'}</Text>
                        <View style={styles.attachmentAction}>
                            <Button disabled={sending} label={located ? 'Remover ponto' : 'Usar ponto de exemplo'} {...(!located && { icon: 'pin' as const })} link onPress={() => onChange({ ...draft, located: !located })} />
                        </View>
                    </View>
                    <View style={[styles.attachment, styles.divider]}>
                        <PhotoAttachments category={category} photos={photos} disabled={sending} onChange={(next) => onChange({ ...draft, photos: next })} />
                    </View>
                </View>
            </View>
            {!!message && (
                <Text accessibilityLiveRegion="polite" style={s.note}>
                    {message}
                </Text>
            )}
            <Button disabled={!ready || sending} label={sending ? 'Enviando denúncia…' : 'Enviar denúncia'} onPress={submit} primary />
            {!ready && <Text style={s.meta}>Categoria, relato, localização e foto são obrigatórios.</Text>}
            <Button disabled={sending} link label={fail ? 'Cancelar falha simulada' : 'Simular falha no envio'} onPress={() => simulate(!fail)} />
        </>
    );
}

const styles = StyleSheet.create({
    form: { gap: 18 },
    block: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 20 },
    field: { gap: 7 },
    label: { fontSize: 15, fontWeight: '700', color: colors.ink },
    input: { minHeight: 98, borderWidth: 1, borderColor: '#98adc2', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 13, fontSize: 16, color: colors.ink, textAlignVertical: 'top', backgroundColor: colors.surface },
    attachments: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 16 },
    attachment: { paddingTop: 16, paddingBottom: 8, gap: 5 },
    attachmentAction: { alignItems: 'flex-start' },
    divider: { borderTopWidth: 1, borderColor: colors.line },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
});
