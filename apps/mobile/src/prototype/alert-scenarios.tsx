import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/typography';
import { Button, s } from './presentation';
import { Icon } from './civic-header';

const scenarios = [
    { level: 'Emergência', title: 'Alagamento na área ribeirinha', region: 'Vila das Pontes', hours: '11:30 – 17:00', message: 'Neste cenário simulado, o rio transbordou e a água cobriu as ruas mais baixas próximas à margem.', background: '#fee2e2', color: '#881d20' },
    { level: 'Alerta', title: 'Vento forte na serra', region: 'Alto da Serra', hours: '10:00 – 15:00', message: 'Neste cenário simulado, rajadas de vento atingem a parte alta do bairro, com possibilidade de queda de galhos.', background: '#ffedd5', color: '#933a14' },
    { level: 'Atenção', title: 'Chuva moderada no vale', region: 'Vale do Ipê', hours: '09:00 – 18:00', message: 'Neste cenário simulado, há previsão de chuva moderada durante a tarde, com acúmulo de água em pontos de drenagem lenta.', background: '#fef3c7', color: '#735013' },
];
function Level({ scenario }: { scenario: (typeof scenarios)[number] }) {
    return <Text style={[s.badge, { color: scenario.color, backgroundColor: scenario.background }]}>{scenario.level}</Text>;
}
export function AlertScenarios({ selected, choose }: { selected: string; choose: (level: string) => void }) {
    const current = scenarios.find((item) => item.level === selected);
    return (
        <>
            <Text style={s.meta}>Cenários simulados para demonstração.</Text>
            {current ? (
                <View style={s.card}>
                    <Level scenario={current} />
                    <Text accessibilityRole="header" style={s.heading}>
                        {current.title}
                    </Text>
                    <Text style={s.text}>{current.message}</Text>
                    <View style={styles.details}>
                        <Text style={s.meta}>Região ilustrativa</Text>
                        <Text style={s.text}>{current.region}</Text>
                    </View>
                    <View style={styles.details}>
                        <Text style={s.meta}>Período fictício · horário de Brasília</Text>
                        <Text style={s.text}>25/11/2026 · {current.hours}</Text>
                    </View>
                    <Button label="Ver todos os alertas" icon="back" link onPress={() => choose('')} />
                </View>
            ) : (
                scenarios.map((item) => (
                    <Pressable key={item.level} accessibilityRole="button" accessibilityLabel={item.level} accessibilityHint={item.title + ' · ' + item.region} onPress={() => choose(item.level)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
                        <View style={s.topline}>
                            <Level scenario={item} />
                            <Icon name="next" size={17} />
                        </View>
                        <Text style={s.heading}>{item.title}</Text>
                        <Text style={s.meta}>{item.region}</Text>
                    </Pressable>
                ))
            )}
        </>
    );
}
const styles = StyleSheet.create({ details: { gap: 2, borderTopWidth: 1, borderColor: '#d4dfe8', paddingTop: 10 } });
