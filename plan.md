# MyCity — Plano de entrega

**Etapa 6 concluída.** O APK assinado, a API HTTPS e o painel hospedado foram homologados no percurso cidadão → gestor → cidadão em 20/11/2026.

O percurso principal liga cidadão, gestor e autor da denúncia. Um cidadão registra o problema com localização e fotos, outro confirma a ocorrência, o gestor atende e o autor acompanha o histórico e as notificações. Os [requisitos](docs/requirements.md) e os [fluxos](docs/flows.md) definem o comportamento. Decisões em aberto ficam em [concerns.md](concerns.md).

As [referências acadêmicas](docs/references/) registram a proposta original. Para saber o que a entrega inclui, consulte o [escopo aprovado do MVP](docs/scope.md).

## Etapas

| Etapa | Entrega                                                          | Situação e referência                                                                               |
| ----- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 0     | Especificação do MVP e conciliação com as referências acadêmicas | [Escopo aprovado](docs/scope.md). As divergências e decisões pendentes têm registro em concerns.md. |
| 1     | Monorepo, contratos, PostgreSQL, migrações, seed e ambiente      | Fundação verificada.                                                                                |
| 2     | Login por CPF, publicação com fotos e consulta pelo gestor       | Percurso local validado.                                                                            |
| 3     | Atendimento, histórico, respostas e avisos ao cidadão            | Percurso local validado.                                                                            |
| 4     | Feed, mapa, confirmações, prioridade, filtros e cancelamento     | Participação validada localmente.                                                                   |
| 5     | Alertas simulados e revisão visual                               | Gate local concluído.                                                                               |
| 6     | Publicação e homologação do APK contra a API hospedada           | APK no Galaxy M32, API e painel na EC2. Gate concluído.                                             |

## Revisão do frontend — painel administrativo e acompanhamento no Android

As prévias navegáveis usam exemplos fictícios no cliente. Para iniciar a prévia do gestor, execute `npm run prototype -w @mycity/web` e abra a porta 8091. Para a prévia do cidadão, execute `npm run dev:mobile:web` e abra a porta 8093. Use o mesmo host de loopback nas duas abas para sincronizar confirmações e situações no navegador. Para testar a aplicação integrada com PostgreSQL, siga o [início rápido](README.md#executar-localmente).

| Superfície             | O que está disponível                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Painel demonstrativo   | Visão geral com rosca e contagens, ranking e prioridades. A marca abre a Visão geral. A linha inteira abre o detalhe, onde ficam todas as ações de situação. Busca por protocolo, endereço ou relato, ordenação e intervalo de datas alimentam a fila e o CSV completo. O editor de resposta tem altura limitada. Categorias tem busca, edição do nome, acesso às ocorrências por grupo e uma seção recolhida para as arquivadas. |
| App demonstrativo      | Início reúne **Meus registros**. O Feed traz as ocorrências da cidade e a confirmação **Também vi isso**. É possível abrir ou retomar o registro do Início, Feed ou Mapa e voltar ao contexto anterior. Os seletores abrem sobre a tela; **Limpar** aparece somente quando há filtros aplicados. Alertas simulados, notificações e cenários de teste têm percursos distintos.                                                     |
| Identidade e movimento | Nunito nos dois clientes. Login e capa do painel usam ilustrações urbanas genéricas. Login do cidadão com a Praça Silviano Brandão e capa com a Lagoa da UFV. As ocorrências usam fotos ilustrativas com origem e licença; os ícones são vetoriais. Transições preservam foco e respeitam movimento reduzido.                                                                                                                     |
| Dados                  | As prévias compartilham 15 exemplos. MC-1046 e MC-1049 têm duas fotos. No mesmo navegador, confirmações e situações se refletem entre as portas 8093 e 8091. Criação, resposta e arquivamento demonstrativos ficam no cliente. O Android integrado e o painel integrado usam sessões, API e PostgreSQL.                                                                                                                           |

A API integrada já permite renomear categorias e desfazer somente o último avanço de atendimento. Reabrir uma resolvida, rejeitada ou cancelada retorna a Em análise e preserva o histórico. Para revisar as fotos na prévia, abrir MC-1046 ou MC-1049.

- [x] Disponibilizar o protótipo navegável e exercitar o percurso demonstrativo no navegador e em Android físico.
- [x] Isolar a paginação da fila, persistir o arquivamento e a reativação de categorias e integrar Início e Meus registros ao Android autenticado.
- [x] Exercitar publicação e confirmação por HTTP, atendimento no painel atual, histórico, aviso e arquivamento no PostgreSQL de teste.
- [x] Revalidar o app integrado no Galaxy M32 com API local, incluindo câmera, galeria, GPS, ponto manual, teclado, movimento reduzido, fonte ampliada e retomada do rascunho.
- [x] Integrar o painel após o aceite, incluindo indicadores, ranking, filtros, CSV completo e verificação da mudança de categoria sob latência.
- [x] Repetir os percursos com o painel definitivo e colher os quatro pareceres do gate local.

### Refinamento do Android integrado

O responsável aprovou no Galaxy M32 o registro de denúncia pelo **+**, com câmera e GPS automático ao abrir o formulário. O mapa de ajuste é opcional. O mapa comunitário agrupa pontos próximos e mantém a seleção ao voltar do detalhe. O gate local incluiu Sol, Luna e os QAs de interface e integração. Os ensaios e seus limites estão na [matriz de testes](docs/testing.md); o parecer de segurança está em [C29](concerns.md#revisão-independente-por-fase).

## Aceite da entrega hospedada

No Galaxy M32, o cidadão publicou uma ocorrência com fotos da câmera e da galeria e escolheu um ponto público no mapa. Outro cidadão confirmou, o gestor atendeu pelo painel e o autor consultou o histórico e o aviso no APK. A sessão e a leitura persistiram após reiniciar o aplicativo. A [matriz de aceite](docs/testing.md#aceite-por-critério) identifica as revisões e verificações realizadas.

A hospedagem passou pela rotação das contas, restrição do acesso ao banco, deploy por digest e recuperação isolada de banco e foto. Após o aceite, as duas denúncias e os três anexos do ensaio foram removidos. Para preparar outra instalação, consulte [hospedagem própria](docs/deploy.md#preparar-um-servidor) e [configuração do Android](docs/runbook.md#configuração-do-android). Região, bairro e geocodificação continuam adiados conforme o [escopo aprovado](docs/scope.md).

O fechamento de cada fase segue o [gate de revisão](agents/readme.md). Para desenvolver e testar uma alteração, consulte o [AGENTS.md](AGENTS.md).
