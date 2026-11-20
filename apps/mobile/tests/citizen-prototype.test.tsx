import { Linking } from 'react-native';
import photoCredits from '../../web/src/prototype/images/report-credits.json';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as demoConfirmations from '../src/prototype/use-demo-confirmations';
import { CitizenPrototype } from '../src/prototype/citizen-prototype';

jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

it('abre no Início com os registros pessoais em seção própria e distingue o feed público', async () => {
    await render(<CitizenPrototype />);
    expect(screen.getAllByRole('header')[0]).toHaveTextContent('Início');
    expect(screen.getByRole('header', { name: 'Meus registros' })).toBeVisible();
    expect(screen.queryByText('MC-1048')).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    expect(screen.getAllByRole('header')[0]).toHaveTextContent('Feed');
    expect(screen.queryByRole('header', { name: 'Meus registros' })).toBeNull();
    expect(screen.getByText('MC-1048')).toBeVisible();
    expect(screen.getAllByText('Buraco próximo à travessia de pedestres')[0]).toBeVisible();
    expect(screen.queryByText('Equipe encaminhada para vistoria.')).toBeNull();
});

it('abre a resposta da gestão e registra uma denúncia demonstrativa para acompanhamento', async () => {
    await render(<CitizenPrototype />);
    await press('Abrir Buraco na via');
    expect(screen.getByText('Equipe encaminhada para vistoria.')).toBeVisible();
    await press('Voltar');
    await press('Nova denúncia');
    expect(screen.queryByRole('button', { name: 'Buraco na via' })).toBeNull();
    expect(screen.getByLabelText('Relato')).toBeVisible();
    await press('Categoria');
    await press('Fechar');
    expect(screen.queryByRole('button', { name: 'Buraco na via' })).toBeNull();
    await press('Categoria');
    await press('Buraco na via');
    expect(screen.getByRole('button', { name: 'Categoria' })).toHaveProp('accessibilityValue', { text: 'Buraco na via' });
    await fireEvent.changeText(screen.getByLabelText('Relato'), 'Pavimento danificado na esquina');
    await press('Usar ponto de exemplo');
    await press('Adicionar foto de exemplo');
    const draftPhoto = screen.getByLabelText('Foto de exemplo da ocorrência').props.source;
    await press('Simular falha no envio');
    await press('Enviar denúncia');
    expect(await screen.findByText('O envio falhou. Seus dados estão salvos nesta tela.')).toBeVisible();
    expect(screen.getByLabelText('Relato')).toHaveProp('value', 'Pavimento danificado na esquina');
    await press('Enviar denúncia');
    expect(await screen.findByText('Denúncia enviada')).toBeVisible();
    await press('Acompanhar denúncia');
    expect(screen.getByText('Pavimento danificado na esquina')).toBeVisible();
    expect(screen.getByLabelText('Foto demonstrativa da ocorrência')).toHaveProp('source', draftPhoto);
    expect(screen.getByRole('link', { name: photoCredits.POTHOLE.author })).toBeVisible();
});

it('permite experimentar lista vazia e recuperar uma falha de consulta', async () => {
    await render(<CitizenPrototype />);
    expect(screen.getByRole('tab', { name: 'Início' })).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    await press('Cenários');
    expect(screen.getByRole('header', { name: 'Cenários' })).toBeVisible();
    expect(screen.queryByRole('header', { name: 'Meus registros' })).toBeNull();
    await press('Voltar');
    expect(screen.getByRole('header', { name: 'Meus registros' })).toBeVisible();
    await press('Cenários');
    await press('Lista vazia');
    expect(screen.getByText('Você ainda não registrou denúncias.')).toBeVisible();
    await press('Cenários');
    await press('Falha na consulta');
    await press('Tentar novamente');
    expect(await screen.findByRole('button', { name: 'Abrir Buraco na via' })).toBeVisible();
});

it('permite consultar outra tela e retomar o rascunho com relato, foto, categoria e ponto', async () => {
    await render(<CitizenPrototype />);
    await press('Nova denúncia');
    await press('Categoria');
    await press('Entulho irregular');
    await fireEvent.changeText(screen.getByLabelText('Relato'), 'Material sobre a calçada');
    await press('Usar ponto de exemplo');
    await press('Adicionar foto de exemplo');
    await press('Voltar');
    await press('Notificações');
    await press('Voltar');
    await press('Continuar rascunho');
    expect(screen.getByLabelText('Relato')).toHaveProp('value', 'Material sobre a calçada');
    expect(screen.getByRole('button', { name: 'Enviar denúncia' })).toBeEnabled();
    await press('Enviar denúncia');
    await fireEvent.press(await screen.findByRole('button', { name: 'Acompanhar denúncia' }));
    expect(screen.getByText('Entulho irregular')).toBeVisible();
    await press('Voltar');
    expect(screen.getByRole('button', { name: 'Nova denúncia' })).toBeVisible();
});

it('retorna ao enquadramento escolhido no mapa após abrir uma ocorrência', async () => {
    await render(<CitizenPrototype />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    const region = { latitude: -20.753, longitude: -42.878, latitudeDelta: 0.003, longitudeDelta: 0.003 };
    await fireEvent(screen.getByLabelText('Mapa de ocorrências'), 'regionChangeComplete', region);
    await fireEvent.press(screen.getByText('MC-1046'));
    expect(screen.getByText('Protocolo MC-1046')).toBeVisible();
    await press('Voltar');
    expect(screen.getByLabelText('Mapa de ocorrências')).toHaveProp('initialRegion', region);
});

it('mantém notificações coerentes com o cenário de cidadão sem registros', async () => {
    await render(<CitizenPrototype />);
    await press('Cenários');
    await press('Lista vazia');
    await press('Notificações');
    expect(screen.getByText('Você ainda não recebeu retornos da prefeitura.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Abrir Buraco na via' })).toBeNull();
    await press('Voltar');
    expect(screen.getByText('Você ainda não registrou denúncias.')).toBeVisible();
});

it('preserva o filtro de resolvidas ao voltar e separa os alertas dos retornos da prefeitura', async () => {
    await render(<CitizenPrototype />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    await press('Resolvidas');
    await press('Abrir Iluminação pública');
    expect(screen.getByText('Luminária substituída pela equipe.')).toBeVisible();
    await press('Voltar');
    expect(screen.getByRole('button', { name: 'Abrir Iluminação pública' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Abrir Buraco na via' })).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Alertas' }));
    await press('Emergência');
    expect(screen.getByText('Cenários simulados para demonstração.')).toBeVisible();
    await press('Ver todos os alertas');
    for (const level of ['Atenção', 'Alerta', 'Emergência']) expect(screen.getByRole('button', { name: level })).toBeVisible();
});

it('resume somente as denúncias do cidadão na capa e atualiza os totais no cenário vazio', async () => {
    await render(<CitizenPrototype />);
    expect(screen.getByLabelText('1 denúncia em aberto')).toBeVisible();
    expect(screen.getByLabelText('1 denúncia encerrada')).toBeVisible();
    expect(screen.getByText('Encerrada')).toBeVisible();
    await press('Cenários');
    await press('Lista vazia');
    expect(screen.getByLabelText('0 denúncias em aberto')).toBeVisible();
    expect(screen.getByLabelText('0 denúncias encerradas')).toBeVisible();
    await press('Notificações');
    expect(screen.getByText('Você ainda não recebeu retornos da prefeitura.')).toBeVisible();
});

it('mostra o crédito da foto específica do protocolo compartilhado com o painel', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    try {
        await render(<CitizenPrototype />);
        await press('Abrir Buraco na via');
        await fireEvent.press(screen.getAllByRole('link')[0]!);
        expect(openURL).not.toHaveBeenCalledWith(photoCredits.POTHOLE.source);
        expect(openURL).toHaveBeenCalledWith(photoCredits.POTHOLE_3.source);
        expect(screen.getByText(photoCredits.POTHOLE_3.author)).toBeVisible();
    } finally {
        openURL.mockRestore();
    }
});

it('filtra as ocorrências do mapa e conserva categoria e situação ao voltar do detalhe', async () => {
    await render(<CitizenPrototype />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    // Resolved, rejected and canceled cases are excluded from the default map.
    for (const protocol of ['MC-1038', 'MC-1037', 'MC-1036']) expect(screen.queryByText(protocol)).toBeNull();
    expect(screen.getByText('MC-1048')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull();
    await press('Situação');
    await press('Resolvido');
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeEnabled();
    await press('Categoria');
    await press('Iluminação pública');
    expect(screen.getByText('MC-1038')).toBeVisible();
    await press('Abrir Iluminação pública');
    await press('Voltar');
    expect(screen.getByText('Iluminação pública · Resolvido')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Categoria' })).toHaveAccessibilityValue({ text: 'Iluminação pública' });
    expect(screen.getByRole('button', { name: 'Situação' })).toHaveAccessibilityValue({ text: 'Resolvido' });
    expect(screen.queryByRole('button', { name: 'Abrir Buraco na via' })).toBeNull();
    await press('Limpar filtros');
    expect(screen.getByText('MC-1048')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Categoria' })).toHaveAccessibilityValue({ text: 'Todas' });
    expect(screen.getByRole('button', { name: 'Situação' })).toHaveAccessibilityValue({ text: 'Ativas' });
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull();
});

it.each([
    ['Atenção', 'Chuva moderada no vale', 'Vale do Ipê', '09:00 – 18:00'],
    ['Alerta', 'Vento forte na serra', 'Alto da Serra', '10:00 – 15:00'],
    ['Emergência', 'Alagamento na área ribeirinha', 'Vila das Pontes', '11:30 – 17:00'],
])('apresenta o cenário simulado de %s com região e período aprovados', async (level, title, region, hours) => {
    await render(<CitizenPrototype />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Alertas' }));
    await press(level);
    expect(screen.getByText(title)).toBeVisible();
    expect(screen.getByText(region)).toBeVisible();
    expect(screen.getByText('25/11/2026 · ' + hours)).toBeVisible();
    expect(screen.getByText('Período fictício · horário de Brasília')).toBeVisible();
});

it('registra e desfaz a confirmação do mesmo protocolo entre o feed e o acompanhamento', async () => {
    await render(<CitizenPrototype />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    await press('Também vi isso, protocolo MC-1048');
    expect(await screen.findByText('19 confirmações')).toBeVisible();
    await fireEvent.press(screen.getByText('MC-1048'));
    expect(screen.getByText('19 confirmações')).toBeVisible();
    await press('Retirar confirmação');
    expect(await screen.findByText('18 confirmações')).toBeVisible();
    await press('Voltar');
    expect(screen.getByRole('button', { name: 'Também vi isso, protocolo MC-1048' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Também vi isso, protocolo MC-1042' })).toBeNull();
});

it('retoma pelo Mapa o registro iniciado no Feed, conserva a origem e volta ao Início após publicar', async () => {
    await render(<CitizenPrototype />);
    const tab = (label: string) => fireEvent.press(screen.getByRole('tab', { name: label }));
    await tab('Feed');
    await press('Resolvidas');
    await press('Nova denúncia');
    await fireEvent.changeText(screen.getByLabelText('Relato'), 'Ocorrência de demonstração');
    await press('Voltar');
    expect(screen.getByRole('tab', { name: 'Feed' })).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    expect(screen.getByRole('button', { name: 'Resolvidas' })).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    await tab('Mapa');
    await press('Continuar rascunho');
    expect(screen.getByLabelText('Relato')).toHaveProp('value', 'Ocorrência de demonstração');
    await press('Voltar');
    expect(screen.getByRole('tab', { name: 'Mapa' })).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    await press('Continuar rascunho');
    await press('Categoria');
    await press('Buraco na via');
    await press('Usar ponto de exemplo');
    await press('Adicionar foto de exemplo');
    await press('Enviar denúncia');
    await fireEvent.press(await screen.findByRole('button', { name: 'Acompanhar denúncia' }));
    await press('Voltar');
    expect(screen.getByRole('header', { name: 'Início' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Início' })).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Nova denúncia' })).toBeVisible();
});

it('percorre o catálogo de fotos do MC-1046 com identificação da imagem e crédito correspondente', async () => {
    await render(<CitizenPrototype />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    await fireEvent.press(screen.getByText('MC-1046'));
    expect(screen.getByText('Foto 1 de 2')).toBeVisible();
    expect(screen.getByRole('link', { name: photoCredits.WASTE.author })).toBeVisible();
    await press('Próxima foto');
    expect(screen.getByText('Foto 2 de 2')).toBeVisible();
    expect(screen.getByRole('link', { name: photoCredits.WASTE_2.author })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Próxima foto' })).toBeDisabled();
    await press('Foto anterior');
    expect(screen.getByText('Foto 1 de 2')).toBeVisible();
});

it('anexa até três exemplos, remove a capa, retoma o rascunho e publica as imagens restantes em ordem', async () => {
    await render(<CitizenPrototype />);
    await press('Nova denúncia');
    await press('Categoria');
    await press('Buraco na via');
    await fireEvent.changeText(screen.getByLabelText('Relato'), 'Mais de um ângulo da ocorrência');
    await press('Usar ponto de exemplo');
    await press('Adicionar foto de exemplo');
    await press('Adicionar outra foto');
    await press('Anexar Buraco na via, exemplo 2');
    await press('Adicionar outra foto');
    await press('Anexar Buraco na via, exemplo 3');
    expect(screen.getByText('3 de 3 fotos')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Adicionar outra foto' })).toBeNull();
    await press('Remover foto 1');
    await press('Voltar');
    await press('Continuar rascunho');
    expect(screen.getByText('2 de 3 fotos')).toBeVisible();
    await press('Enviar denúncia');
    await fireEvent.press(await screen.findByRole('button', { name: 'Acompanhar denúncia' }));
    expect(screen.getByText('Foto 1 de 2')).toBeVisible();
    expect(screen.getByRole('link', { name: photoCredits.POTHOLE_2.author })).toBeVisible();
    await press('Próxima foto');
    expect(screen.getByRole('link', { name: photoCredits.POTHOLE_3.author })).toBeVisible();
});

it('apresenta o retorno à situação inicial sem inventar o motivo ou repetir a resposta antiga', async () => {
    const snapshot = jest.spyOn(demoConfirmations, 'useDemoConfirmations').mockReturnValue({ confirmed: [], setConfirmed: jest.fn(), statusById: { 1042: 'UNDER_REVIEW' }, bridge: null });
    try {
        await render(<CitizenPrototype />);
        await press('Notificações');
        await press('Abrir Buraco na via');
        expect(screen.getByText('Situação atualizada para Em análise.')).toBeVisible();
        expect(screen.queryByText('Equipe encaminhada para vistoria.')).toBeNull();
    } finally {
        snapshot.mockRestore();
    }
});
