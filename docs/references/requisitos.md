# Requisitos

Fonte original: Requisitos.pdf (PDF removido após extração).

MyCity - Levantamento de Requisitos

Sua cidade, sua voz

## Requisitos Funcionais

### RF01

O sistema deve permitir que o usuário faça cadastro e login utilizando e-mail e senha.

- Visibilidade: Evidente.
- Prioridade: Obrigatório.

### RF02

O sistema deve permitir que o cidadão crie uma denúncia com foto, categoria do problema e descrição curta.

- Visibilidade: Evidente.
- Prioridade: Obrigatório.

### RF03

O sistema deve capturar automaticamente a localização (GPS) do usuário ao criar uma denúncia.

- Visibilidade: Oculto.
- Prioridade: Obrigatório.

### RF04

O sistema deve exibir um feed público de denúncias, organizado por bairro/região.

- Visibilidade: Evidente.
- Prioridade: Obrigatório.

### RF05

O sistema deve permitir que outros moradores confirmem uma denúncia (“também vi isso”), uma única vez por usuário.

- Visibilidade: Evidente.
- Prioridade: Obrigatório.

### RF06

O sistema deve calcular automaticamente a prioridade da denúncia com base nas confirmações dos moradores.

- Visibilidade: Oculto.
- Prioridade: Obrigatório.

### RF07

O sistema deve permitir que o gestor público atualize o status da denúncia (Enviado, Em análise, Em andamento, Resolvido ou Rejeitado, este com justificativa pública) e responda publicamente.

- Visibilidade: Evidente.
- Prioridade: Obrigatório.

### RF08

O sistema deve exibir um mapa da cidade com todas as denúncias como marcadores.

- Visibilidade: Evidente.
- Prioridade: Desejado.

### RF09

O sistema deve manter um histórico público das denúncias resolvidas.

- Visibilidade: Evidente.
- Prioridade: Desejado.

### RF10

O sistema deve consultar periodicamente uma fonte de dados meteorológicos (INMET/OpenWeather) para gerar alertas.

- Visibilidade: Oculto.
- Prioridade: Obrigatório.

### RF11

O sistema deve enviar notificações de alerta (Atenção, Alerta, Emergência) apenas aos usuários da área afetada.

- Visibilidade: Evidente.
- Prioridade: Obrigatório.

### RF12

O sistema deve controlar as permissões por papel de usuário (Cidadão, Gestor público e, quando habilitada, Defesa Civil).

- Visibilidade: Oculto.
- Prioridade: Obrigatório.

### RF13

O sistema deve permitir que a Defesa Civil emita alertas manuais que sobreponham os automáticos.

- Visibilidade: Evidente.
- Prioridade: Desejado.

### RF14

O sistema deve permitir que o cidadão cancele a própria denúncia enquanto ela estiver nos status Enviado ou Em análise.

- Visibilidade: Evidente.
- Prioridade: Desejado.

### RF15

O sistema deve notificar o cidadão autor a cada mudança de status da sua denúncia.

- Visibilidade: Evidente.
- Prioridade: Obrigatório.

### RF16

O sistema deve permitir que o cidadão avalie o atendimento após a denúncia ser marcada como Resolvido.

- Visibilidade: Evidente.
- Prioridade: Desejado.

### RF17

O sistema deve restringir a visualização e a atualização do gestor público às denúncias da sua região.

- Visibilidade: Oculto.
- Prioridade: Obrigatório.

## Requisitos Não-Funcionais

### RNF01

Criptografia de Senha: As senhas dos usuários devem ser salvas no banco de dados utilizando algoritmo de hash seguro.

- Duração: Permanente.

### RNF02

Segurança na Comunicação: Toda a troca de dados entre o aplicativo e o servidor deve usar HTTPS.

- Duração: Permanente.

### RNF03

Desempenho de Alertas: As notificações de emergência devem ser entregues em até 1 minuto após a geração do alerta.

- Duração: Permanente.

### RNF04

Disponibilidade: O sistema deve estar disponível 24 horas por dia, principalmente durante situações de emergência.

- Duração: Permanente.

### RNF05

Usabilidade: A interface deve ser simples e intuitiva, funcionando em Android e iOS.

- Duração: Permanente.

### RNF06

Privacidade (LGPD): Os dados de localização e dados pessoais devem ser tratados conforme a Lei Geral de Proteção de Dados.

- Duração: Permanente.

### RNF07

Homologação: antes de entrar em produção, o sistema deve ser validado em ambiente de homologação com dados fictícios, sem enviar alertas reais à população.

- Duração: Transitório.

## Critérios de classificação

- Evidente ou Oculto: é evidente quando o usuário vê e interage diretamente com a função; é oculto quando o sistema faz o trabalho por trás (GPS automático, cálculo de prioridade, consulta à API do clima, controle de permissões).
- Obrigatório ou Desejado: é obrigatório o que sustenta os dois pilares do escopo (denúncia e alerta). Ficaram como desejados o histórico público e os alertas manuais da Defesa Civil, que o documento marca como "opcional".
- Transitório ou Permanente: é permanente o que vale durante toda a vida do sistema. É transitório o que só existe em uma fase específica, como o RNF07 na homologação.
