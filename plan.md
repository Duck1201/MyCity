# MyCity — Plano de entrega

**Etapa 5 concluída no ambiente local.** O responsável aceitou a revisão visual em 20/11/2026. O painel aprovado usa a API e o PostgreSQL de desenvolvimento. A homologação do APK com a API hospedada pertence à etapa 6.

O percurso principal liga cidadão, gestor e autor da denúncia. Um cidadão registra o problema com localização e fotos, outro confirma a ocorrência, o gestor atende e o autor acompanha o histórico e as notificações. Os [requisitos](docs/requirements.md) e os [fluxos](docs/flows.md) definem o comportamento. Decisões em aberto ficam em [concerns.md](concerns.md).

## Etapas

| Etapa | Entrega                                                          | Situação e referência                                                                               |
| ----- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 0     | Especificação do MVP e conciliação com as referências acadêmicas | [Escopo aprovado](docs/scope.md). As divergências e decisões pendentes têm registro em concerns.md. |
| 1     | Monorepo, contratos, PostgreSQL, migrações, seed e ambiente      | Fundação verificada.                                                                                |
| 2     | Login por CPF, publicação com fotos e consulta pelo gestor       | Percurso local validado.                                                                            |
| 3     | Atendimento, histórico, respostas e avisos ao cidadão            | Percurso local validado.                                                                            |
| 4     | Feed, mapa, confirmações, prioridade, filtros e cancelamento     | Participação validada localmente.                                                                   |
| 5     | Alertas simulados e revisão visual                               | Gate local concluído.                                                                               |
| 6     | Publicação e homologação do APK contra a API hospedada           | Preparação local concluída. APK assinado e fluxo hospedado aguardam homologação.                    |

## Revisão do frontend — painel administrativo e acompanhamento no Android

**Retomada.** A prévia navegável, o app integrado e o painel integrado coexistem no workspace da branch `feat/demo-account-credentials`. O fechamento da sessão foi feito sobre `f7e19f6`, com alterações locais e arquivos novos fora do stage. Na próxima sessão, conferir `git status --short --branch` antes de trabalhar.

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

## Aceite da entrega hospedada

A preparação local da etapa 6 inclui cotas nas rotas públicas, credencial restrita para a API e deploy por digest. Antes da publicação, fixe a revisão que será homologada: o workspace da etapa 5 contém alterações locais e arquivos novos, incluindo as migrações de arquivamento e ícone de categoria. Confira o conteúdo da release e os checks de CI antes da publicação.

O perfil `preview` em [eas.json](apps/mobile/eas.json) já seleciona o formato APK. O APK terá assinatura local (C10), URL HTTPS da API e chave de mapas restrita ao pacote e ao certificado, conforme o [runbook Android](docs/runbook.md#configuração-do-android). Antes de expor dados da demonstração, aplicar as regras de retenção do ensaio (C12) e conferir os achados de segurança da hospedagem (C28 em [concerns.md](concerns.md)).

- Publicar as imagens com HTTPS, aplicar migrações explicitamente e rotacionar as contas legadas no destino. Preservar dados e fotos conforme o [runbook](docs/runbook.md) e os [procedimentos de implantação](docs/ci-cd.md).
- Instalar o APK assinado em Android físico. Conferir câmera, compressão e leitura de fotos, permissões, GPS e seleção manual no mapa. Percorrer criação, confirmação, atendimento e notificação contra a API pública.
- Conferir persistência e recuperação no destino. Remover os dados do ensaio após o aceite conforme C12. Região, bairro e geocodificação foram adiados.
- Conferir a conciliação final das [fontes acadêmicas](docs/references/) com os critérios e registrar o resultado de cada verificação na [matriz de aceite](docs/testing.md#aceite-por-critério). Distinguir simulações e verificações locais dos resultados obtidos no destino.

O fechamento de cada fase segue o [gate de revisão](agents/readme.md). Para desenvolver e testar uma alteração, consulte o [AGENTS.md](AGENTS.md).
