# Escopo do Projeto

Fonte original: Escopo do Projeto.pdf (PDF removido após extração).

MyCity - Sua cidade, sua voz

Documento de Escopo do Projeto

Curso: Análise e Desenvolvimento de Sistemas (ADS)

Autor: Pietro

## 1. Visão Geral

MyCity é um aplicativo que conecta o cidadão à prefeitura, unindo duas frentes em um só lugar: o registro de problemas urbanos (como buracos na via, iluminação apagada ou coleta de lixo não realizada) e o envio de alertas de emergência sobre clima severo e desastres naturais. A proposta é criar um canal direto, transparente e geolocalizado entre a população e a gestão pública.

## 2. Objetivo

Facilitar a comunicação entre cidadão e prefeitura, dando visibilidade e prioridade a problemas urbanos reais, e ao mesmo tempo manter a população informada em tempo real sobre riscos climáticos e situações de emergência em sua região.

## 3. Pilares do Aplicativo

### 3.1 Denúncia e solicitação urbana (cidadão → prefeitura)

O cidadão registra problemas da cidade em formato de postagem, semelhante a uma rede social:

- Buraco na via

- Lixo não coletado / lixeiro não passou no local

- Iluminação pública queimada

- Entulho irregular

- Vazamento de água ou esgoto

- Poda de árvore / risco de queda

### 3.2 Alerta de emergência (sistema → cidadão)

O aplicativo envia notificações automáticas sobre condições climáticas severas e riscos à população:

- Chuva forte / risco de alagamento

- Ventania forte

- Risco de enchente ou deslizamento

- Comunicados emergenciais da Defesa Civil

## 4. Fluxo de Denúncia

1. O usuário cria uma postagem com foto, localização automática (GPS), categoria do problema e uma descrição curta.

2. A postagem entra no feed público, organizado por bairro/região.

3. Outros moradores podem confirmar que também presenciaram o mesmo problema ("também vi isso"), o que aumenta a prioridade da demanda.

4. A prefeitura acompanha e atualiza o status da denúncia:

| Enviado | Em análise | Em andamento | Resolvido |
| --- | --- | --- | --- |
| Denúncia registrada pelo cidadão, aguardando triagem. | Equipe da prefeitura avalia a demanda e sua prioridade. | Serviço/reparo em execução no local. | Problema solucionado; fica no histórico público. |
5. Um mapa da cidade exibe todos os problemas reportados como marcadores, permitindo visualizar rapidamente as áreas mais afetadas.

## 5. Fluxo de Alertas Climáticos

O app se conecta a uma fonte de dados meteorológicos (ex.: INMET, OpenWeather) para gerar alertas automáticos, segmentados por bairro/região — ou seja, só recebe o alerta quem está na área afetada.

### 5.1 Níveis de alerta

| Nível | Significado |
| --- | --- |
| Atenção (amarelo) | Condição climática que exige cuidado, sem risco iminente (ex.: chuva moderada prevista). |
| Alerta (laranja) | Risco relevante em curso ou iminente (ex.: chuva forte, ventania, risco de alagamento pontual). |
| Emergência (vermelho) | Perigo grave e imediato à segurança das pessoas (ex.: risco de deslizamento, enchente confirmada). |
## 6. Papéis de Usuário

| Papel | Pode fazer | Objetivo |
| --- | --- | --- |
| Cidadão | Postar denúncias, confirmar denúncias de outros usuários, receber alertas de clima/desastre. | Reportar problemas e se manter informado. |
| Gestor público | Ver denúncias da sua região, atualizar status, responder publicamente. | Dar retorno e transparência ao cidadão. |
| Defesa Civil (opcional) | Emitir alertas manuais em situações graves, sobrepondo os alertas automáticos. | Agir rápido em emergências reais. |
## 7. Diferenciais do MyCity

- Georreferenciamento: cada problema aparece no local exato do mapa.

- Validação social: confirmações de outros moradores aumentam a prioridade da

denúncia.

- Transparência: histórico público de resolução, mostrando o que a prefeitura já resolveu.

- Alertas segmentados por localização, evitando notificações irrelevantes.
