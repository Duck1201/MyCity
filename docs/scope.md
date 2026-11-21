# Escopo do MVP

Status: recorte funcional confirmado. Detalhes ainda propostos estão identificados nos documentos vinculados e em [concerns](../concerns.md).

## Entrega

Um APK Android para cidadãos e uma aplicação web para o gestor demonstram o ciclo completo de uma denúncia urbana. React Native/Expo e React acessam Express/Prisma com PostgreSQL compartilhado. TypeScript é usado nas três partes; web utiliza Tailwind CSS e shadcn/ui, app utiliza componentes nativos com StyleSheet.

O [guia de hospedagem](deploy.md#preparar-um-servidor) descreve web, API e PostgreSQL em Docker Compose. Volumes mantêm banco e fotos após a recriação dos containers. O APK é instalado no celular.

## Atores e responsabilidades

| Ator                     | Responsabilidades                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Cidadão autor            | Criar, acompanhar, editar antes do atendimento, cancelar quando permitido e reabrir sua denúncia cancelada; ler notificações. |
| Outro cidadão            | Consultar denúncias e confirmar/retirar sua confirmação.                                                                      |
| Gestor                   | Consultar sem restrição territorial, atender denúncias e gerenciar o catálogo de categorias.                                  |
| Operador da demonstração | Preparar ambiente, executar seed e instalar APK; não é um quarto papel da aplicação.                                          |

## Funcional e persistido

- Login por CPF e senha próprios do MyCity com duas contas de cidadão e uma de gestor provisionadas para demonstração.
- Criação com uma a três fotos, categoria ativa, descrição e localização obrigatórias. A opção “Quero mostrar minha cara” começa ligada e exibe nome e foto de perfil. Desligada, oculta a identidade inclusive do gestor.
- GPS com seleção manual alternativa; compressão JPEG no celular, maior lado até 1.600 px e qualidade inicial de 80%.
- Feed, mapa, detalhes, minhas denúncias e histórico de resolvidas.
- Confirmações únicas por cidadão, sem confirmar a própria denúncia, com retirada e prioridade por quantidade/antiguidade.
- Atendimento sequencial, respostas públicas, rejeição justificada e cancelamento pelo autor antes de Em andamento.
- Histórico e notificações internas persistidos; polling a cada cinco segundos nas telas ativas.
- Painel autenticado com Visão geral, fila e Categorias. Permite abrir um indicador na fila, buscar pelo protocolo, relato ou coordenadas, filtrar por situação, categoria e período, exportar os resultados e atender no detalhe.

## Simulado

O seed cria contas e denúncias fictícias no mesmo backend usado pelo APK e pelo painel. Alertas climáticos têm conteúdo de demonstração com três níveis, sem integração meteorológica, segmentação operacional ou envio emergencial.

## Fora desta entrega

Cadastro público, recuperação de senha, avaliação do atendimento, chat, filtros por região ou bairro, geocodificação, restrição regional do gestor, painel operacional da Defesa Civil, push/e-mail, fila de mensagens, WebSocket, dashboard separado com gráficos, geolocalização contínua, navegação de rotas, funcionamento offline completo e homologação iOS.

Não prometer SLA de emergência ou disponibilidade 24/7. Preservar preenchimento durante uma falha de envio não significa implementar sincronização offline.

## Roteiro principal

O cidadão A cria uma denúncia. O cidadão B a confirma. O gestor vê a ocorrência na lista e move Enviado → Em análise → Em andamento → Resolvido, podendo publicar resposta. O cidadão A vê cada mudança e seus avisos. Usar outras denúncias para demonstrar cancelamento e rejeição. A reabertura pelo gestor retorna a Em análise.

## Condição de sucesso

O APK e o painel observam dados consistentes do mesmo backend. O APK funciona conectado ao servidor, e os cenários de [teste](testing.md) têm evidências do fluxo integrado.
