# Casos de Uso Estendidos

Fonte original: Casos de Uso Estendidos.pdf (PDF removido após extração).

MyCity - Casos de Uso Estendidos

Sua cidade, sua voz · Sprint 4

Descrição expandida dos casos de uso principais do diagrama de casos de uso, com atores, condições, fluxos e requisitos relacionados (RF/RNF do documento de requisitos).

## Visão geral dos casos de uso

| ID | Caso de uso | Ator(es) | Requisitos |
| --- | --- | --- | --- |
| UC01 | Cadastrar e autenticar usuário | Cidadão, Gestor, Defesa Civil | RF01, RNF01, RNF02 |
| UC02 | Registrar denúncia | Cidadão | RF02 |
| UC03 | Capturar localização (GPS) | — (incluído em UC02) | RF03, RNF06 |
| UC04 | Consultar feed de denúncias | Cidadão | RF04 |
| UC05 | Confirmar denúncia (“também vi isso”) | Cidadão | RF05 |
| UC06 | Calcular prioridade | — (incluído em UC05) | RF06 |
| UC07 | Visualizar mapa de denúncias | Cidadão | RF08 |
| UC08 | Cancelar denúncia | Cidadão (extensão de UC09) | RF14 |
| UC09 | Acompanhar minhas denúncias | Cidadão | RF15 |
| UC10 | Avaliar atendimento | Cidadão (extensão de UC09) | RF16 |
| UC11 | Atualizar status da denúncia | Gestor público | RF07, RF12, RF17 |
| UC12 | Consultar histórico público | Cidadão, Gestor | RF09 |
| UC13 | Receber alerta climático | Cidadão | RF11, RNF03 |
| UC14 | Gerar alerta automático | Fonte meteorológica | RF10 |
| UC15 | Notificar cidadão da atualização | — (incluído em UC11) | RF15 |
| UC16 | Emitir alerta manual | Defesa Civil | RF13 |
| UC17 | Visualizar denúncias da sua região | Gestor público | RF17 |
| UC18 | Enviar notificação segmentada | — (incluído em UC14 e UC16) | RF11, RNF03 |
| UC19 | Responder publicamente | Gestor (extensão de UC11) | RF07 |
| UC20 | Rejeitar com justificativa | Gestor (extensão de UC11) | RF07 |

Os casos de uso a seguir detalham os fluxos principais dos dois pilares do sistema (denúncia e alerta). Os demais seguem o mesmo modelo e podem ser expandidos conforme a necessidade.

## UC01 – Cadastrar e autenticar usuário

### Ator(es)

Usuário (Cidadão, Gestor público, Defesa Civil)

### Requisitos

RF01, RF12, RNF01, RNF02, RNF06

### Pré-condições

Aplicativo instalado e com acesso à internet.

### Pós-condições

Usuário autenticado, com o papel (Cidadão, Gestor ou Defesa Civil) definido na sessão.

### Fluxo principal

1. O usuário abre o aplicativo e escolhe “Cadastrar” ou “Entrar”.
2. No cadastro, informa e-mail e senha; o sistema valida o formato e a unicidade do e- mail.
3. O sistema grava a senha com hash seguro e cria a conta como Cidadão.
4. No login, o usuário informa e-mail e senha.
5. O sistema valida as credenciais, identifica o papel e abre a tela inicial correspondente.

### Fluxos alternativos

- A1 – E-mail já cadastrado: o sistema informa e sugere o login ou a recuperação de senha.
- A2 – Gestor e Defesa Civil têm conta habilitada pela administração; o primeiro acesso segue o mesmo fluxo de login.

### Exceções

- E1 – Credenciais inválidas: o sistema exibe mensagem genérica e permite nova tentativa.
- E2 – Sem conexão: o sistema informa e não prossegue.

### Regras de negócio

Senha nunca é armazenada em texto puro. Toda comunicação ocorre por HTTPS. As permissões de cada papel são aplicadas após o login.

## UC02 – Registrar denúncia

### Ator(es)

Cidadão

### Requisitos

RF02, RF03, RF04, RNF05, RNF06

### Pré-condições

Cidadão autenticado (UC01). Permissão de localização concedida no aparelho.

### Pós-condições

Denúncia criada com status Enviado e publicada no feed do bairro/região.

### Fluxo principal

1. O cidadão escolhe “Nova denúncia”.
2. Seleciona a categoria do problema (buraco, lixo não coletado, iluminação, entulho, vazamento, poda de árvore).
3. Anexa uma foto.
4. Escreve uma descrição curta.
5. O sistema captura a localização por GPS (inclui UC03).
6. O cidadão confirma o envio.
7. O sistema grava a denúncia com status Enviado e a exibe no feed e no mapa.

### Fluxos alternativos

- A1 – GPS indisponível: o sistema permite ajustar o ponto manualmente no mapa.
- A2 – O cidadão cancela antes de enviar: nada é gravado.

### Exceções

- E1 – Foto, categoria ou descrição ausente: o sistema destaca o campo e bloqueia o envio.
- E2 – Falha de rede: o rascunho é mantido para novo envio.

### Regras de negócio

Foto, categoria e descrição curta são obrigatórias. A localização é capturada automaticamente e tratada conforme a LGPD.

## UC05 – Confirmar denúncia (“também vi isso”)

### Ator(es)

Cidadão

### Requisitos

RF05, RF06

### Pré-condições

Cidadão autenticado. Denúncia visível no feed e ainda não resolvida, rejeitada ou cancelada.

### Pós-condições

Confirmação registrada e prioridade da denúncia recalculada.

### Fluxo principal

1. O cidadão abre uma denúncia no feed.
2. Toca em “também vi isso”.
3. O sistema registra a confirmação do usuário.
4. O sistema recalcula a prioridade (inclui UC06).
5. O sistema atualiza o contador de confirmações exibido.

### Fluxos alternativos

- A1 – O cidadão remove a própria confirmação: o contador e a prioridade são recalculados.

### Exceções

- E1 – Usuário já confirmou esta denúncia: o sistema ignora a repetição e informa.
- E2 – O autor tenta confirmar a própria denúncia: ação bloqueada.

### Regras de negócio

Cada usuário confirma uma denúncia uma única vez. Mais confirmações aumentam a prioridade da demanda.

## UC08 – Cancelar denúncia

### Ator(es)

Cidadão (extensão de UC09 – Acompanhar minhas denúncias)

### Requisitos

RF14, RF15

### Pré-condições

Cidadão é o autor da denúncia. Status da denúncia é Enviado ou Em análise.

### Pós-condições

Denúncia com status Cancelado (estado final), mantida no histórico do autor.

### Fluxo principal

1. No acompanhamento (UC09), o cidadão abre a denúncia e escolhe “Cancelar”.
2. O sistema pede confirmação.
3. O cidadão confirma.
4. O sistema altera o status para Cancelado e registra no histórico.
5. O sistema retira a denúncia do feed e do mapa.

### Fluxos alternativos

- A1 – O cidadão desiste na confirmação: nada muda.

### Exceções

- E1 – Status já é Em andamento, Resolvido ou Rejeitado: a opção de cancelar não é oferecida.

### Regras de negócio

Só o autor cancela a própria denúncia. Cancelado é estado final; um novo problema exige nova denúncia.

## UC11 – Atualizar status da denúncia

### Ator(es)

Gestor público

### Requisitos

RF07, RF09, RF12, RF15, RF17

### Pré-condições

Gestor autenticado (UC01) com permissão (RF12). Denúncia pertence à região do gestor (RF17).

### Pós-condições

Status atualizado, histórico registrado e cidadão notificado (UC15).

### Fluxo principal

1. O gestor acessa o painel e vê as denúncias da sua região (UC17).
2. Seleciona uma denúncia e a analisa.
3. Escolhe o novo status (Em análise, Em andamento ou Resolvido).
4. O sistema verifica a permissão e valida a transição.
5. O sistema grava o novo status e registra o histórico.
6. O sistema notifica o cidadão autor (inclui UC15).
7. Denúncia Resolvida passa ao histórico público (UC12).

### Fluxos alternativos

- A1 – Responder publicamente (UC19): o gestor escreve uma resposta visível a todos.
- A2 – Rejeitar com justificativa (UC20): o gestor escolhe Rejeitado e informa a justificativa pública obrigatória.

### Exceções

- E1 – Transição inválida (ex.: Enviado direto para Resolvido): o sistema exibe erro ao gestor e mantém o status.
- E2 – Sem permissão ou fora da região: ação negada.

### Regras de negócio

Fluxo: Enviado → Em análise → Em andamento → Resolvido; de Em análise também pode ir a Rejeitado. Toda mudança fica no histórico e dispara notificação ao autor.

## UC14 – Gerar alerta automático

### Ator(es)

Fonte meteorológica (INMET / OpenWeather)

### Requisitos

RF10, RF11, RF13, RNF03, RNF04

### Pré-condições

Integração com a fonte meteorológica configurada. Sistema disponível 24 h (RNF04).

### Pós-condições

Alerta classificado e enviado aos usuários da área afetada em até 1 minuto.

### Fluxo principal

1. O sistema consulta periodicamente a fonte de dados meteorológicos.
2. Identifica condição severa para uma região.
3. Classifica o nível: Atenção (amarelo), Alerta (laranja) ou Emergência (vermelho).
4. Verifica se há alerta manual da Defesa Civil ativo na área.
5. Identifica os usuários da área afetada.
6. Envia a notificação segmentada (inclui UC18) em até 1 minuto.

### Fluxos alternativos

- A1 – Alerta manual ativo na área: o automático é descartado e prevalece o manual (UC16).

### Exceções

- E1 – Fonte indisponível: o sistema tenta novamente e registra a falha.
- E2 – Nenhuma condição severa: nenhum alerta é gerado.

### Regras de negócio

Só recebe o alerta quem está na área afetada. O nível do alerta segue a tabela do escopo (Atenção, Alerta, Emergência).

## UC16 – Emitir alerta manual

### Ator(es)

Defesa Civil

### Requisitos

RF11, RF12, RF13, RNF03

### Pré-condições

Usuário autenticado com papel Defesa Civil. Situação grave que justifique o alerta.

### Pós-condições

Alerta manual enviado e alertas automáticos da área sobrepostos.

### Fluxo principal

1. A Defesa Civil abre “Emitir alerta”.
2. Define a área, o nível e a mensagem.
3. O sistema mostra uma prévia e pede confirmação.
4. A Defesa Civil confirma.
5. O sistema marca o alerta como prioritário e envia a notificação segmentada (inclui UC18).
6. O sistema suspende alertas automáticos da mesma área enquanto o manual estiver ativo.

### Fluxos alternativos

- A1 – Encerrar alerta manual: a Defesa Civil o encerra e os automáticos voltam a valer.

### Exceções

- E1 – Sem permissão: ação negada.
- E2 – Área ou mensagem vazia: o sistema bloqueia o envio.

### Regras de negócio

Alerta manual sempre prevalece sobre o automático. Este papel é opcional no escopo do projeto.
