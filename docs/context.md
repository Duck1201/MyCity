# Vocabulário do MyCity

Glossário do domínio do MVP. Mantido neste caminho lowercase por convenção documental do projeto.

**Denúncia (`report`):** registro de um problema urbano observado por um cidadão, com categoria, descrição, localização, fotos e estado de atendimento. Evitar alternar com “post” ou “chamado” nos contratos.

**Cidadão (`citizen`):** pessoa que registra e acompanha denúncias e confirma ocorrências de outras pessoas.

**Autor (`author`):** cidadão responsável pela criação de uma denúncia; não é qualquer usuário que a confirma.

**Gestor (`manager`):** usuário que analisa, responde e conduz o atendimento das denúncias. Neste MVP, atende todas as regiões.

**Confirmação (`confirmation`):** manifestação “também vi isso” feita por outro cidadão sobre uma denúncia. Não é curtida nem confirmação do atendimento.

**Prioridade (`priority`):** ordem de atendimento sugerida pela quantidade de confirmações, com antiguidade como desempate; não é nível de emergência climática.

**Status (`status`):** estado atual do atendimento: Enviado, Em análise, Em andamento, Resolvido, Rejeitado ou Cancelado.

**Resposta pública (`reply`):** mensagem do gestor vinculada à denúncia e consultável por quem pode vê-la. Não é conversa privada.

**Justificativa de rejeição (`rejection reason`):** explicação pública obrigatória para encerrar uma denúncia como Rejeitado.

**Histórico da denúncia (`history`):** sequência de criação, mudanças de status e respostas de uma denúncia. Diferente da listagem histórica de denúncias resolvidas.

**Histórico de resolvidas:** coleção consultável das denúncias cujo atendimento terminou como Resolvido.

**Notificação (`notification`):** aviso individual ao autor sobre mudança de status, com estado de leitura. Diferente de alerta climático.

**Alerta climático (`weather alert`):** comunicado de risco classificado em Atenção, Alerta ou Emergência. No MVP, seu conteúdo é simulado.

**Região (`region`):** agrupamento territorial usado para consulta e filtragem. Sua associação com coordenadas ainda precisa ser definida; não delimita a permissão do gestor no MVP.

**Localização (`location`):** ponto geográfico do problema, capturado por GPS ou indicado manualmente. Não representa rastreamento contínuo do cidadão.
