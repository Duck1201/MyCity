# Escopo do MVP

Status: recorte funcional confirmado. Detalhes ainda propostos estão identificados nos documentos vinculados e em [concerns](../concerns.md).

## Entrega

Um APK Android para cidadãos e uma aplicação web para o gestor demonstram o ciclo completo de uma denúncia urbana. React Native/Expo e React acessam Express/Prisma com PostgreSQL compartilhado. TypeScript é usado nas três partes; web utiliza Tailwind CSS e shadcn/ui, app utiliza componentes nativos com StyleSheet.

Hospedar web, API e PostgreSQL no servidor do responsável com Docker Compose. O APK roda no celular, não como container do servidor. Volumes mantêm banco e fotos após recriação dos containers.

## Atores e responsabilidades

| Ator                     | Responsabilidades                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Cidadão autor            | Criar, acompanhar e, quando permitido, cancelar sua denúncia; ler notificações.                |
| Outro cidadão            | Consultar denúncias e confirmar/retirar sua confirmação.                                       |
| Gestor                   | Consultar todas as regiões, analisar, responder, avançar status ou rejeitar com justificativa. |
| Operador da demonstração | Preparar ambiente, executar seed e instalar APK; não é um quarto papel da aplicação.           |

## Funcional e persistido

- Login planejado por CPF e senha próprios do MyCity, sem e-mail ou gov.br, com duas contas de cidadão e uma de gestor fictícias previamente cadastradas. A fundação legada por e-mail ainda precisa de migração.
- Criação com uma a três fotos reais, categoria, descrição e localização obrigatórias. Checkbox “Quero mostrar minha cara” marcado por padrão exibe nome/foto de perfil; desmarcado oculta a identidade inclusive do gestor.
- GPS com seleção manual alternativa; compressão JPEG no celular, maior lado até 1.600 px e qualidade inicial de 80%.
- Feed, mapa, detalhes, minhas denúncias e histórico de resolvidas.
- Confirmações únicas por cidadão, sem confirmar a própria denúncia, com retirada e prioridade por quantidade/antiguidade.
- Atendimento sequencial, respostas públicas, rejeição justificada e cancelamento pelo autor antes de Em andamento.
- Histórico e notificações internas persistidos; polling a cada cinco segundos nas telas ativas.
- Web com lista, filtros de status/categoria/região, contadores e detalhes de atendimento.

## Simulado

Contas e denúncias iniciais serão fictícias, mas suas ações usam a implementação real. Alertas climáticos têm conteúdo de demonstração com três níveis, sem integração meteorológica, segmentação operacional ou envio emergencial. A simulação não deve produzir notificações para pessoas externas.

## Fora desta entrega

Cadastro público, recuperação de senha, avaliação do atendimento, chat, restrição regional do gestor, painel operacional da Defesa Civil, push/e-mail, fila, WebSocket, dashboard separado com gráficos, geolocalização contínua, navegação de rotas, funcionamento offline completo e homologação iOS.

Não prometer SLA de emergência ou disponibilidade 24/7. Preservar preenchimento durante uma falha de envio não significa implementar sincronização offline.

## Roteiro principal

O cidadão A cria uma denúncia. O cidadão B a confirma. O gestor vê a ocorrência na lista e move Enviado → Em análise → Em andamento → Resolvido, podendo publicar resposta. O cidadão A vê cada mudança e seus avisos. Usar outras denúncias para demonstrar cancelamento e rejeição sem tentar reabrir a principal.

## Condição de sucesso

As três interfaces observam dados consistentes do mesmo backend, o APK funciona conectado ao servidor real e os cenários de [teste](testing.md) possuem evidências. Uma tela estática, um seed ou uma imagem de preview não comprovam o fluxo.
