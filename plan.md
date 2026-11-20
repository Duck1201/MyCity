# MyCity — Plano de entrega

**MVP entregue.** O APK assinado, a API HTTPS e o painel hospedado foram homologados no percurso cidadão → gestor → cidadão em 20/11/2026. A partir daqui, toda mudança é manutenção e segue o [fluxo do AGENTS.md](AGENTS.md#fluxo-de-uma-mudança).

O percurso principal liga cidadão, gestor e autor da denúncia. Um cidadão registra o problema com localização e fotos, outro confirma a ocorrência, o gestor atende e o autor acompanha o histórico e as notificações. Os [requisitos](docs/requirements.md) e os [fluxos](docs/flows.md) definem o comportamento, e o [escopo aprovado](docs/scope.md) diz o que a entrega inclui. As [referências acadêmicas](docs/references/) registram a proposta original.

## Etapas

| Etapa | Entrega                                                          | Situação                                                      |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| 0     | Especificação do MVP e conciliação com as referências acadêmicas | [Escopo aprovado](docs/scope.md) e [recortes](concerns.md).   |
| 1     | Monorepo, contratos, PostgreSQL, migrações, seed e ambiente      | Concluída.                                                    |
| 2     | Login por CPF, publicação com fotos e consulta pelo gestor       | Concluída.                                                    |
| 3     | Atendimento, histórico, respostas e avisos ao cidadão            | Concluída.                                                    |
| 4     | Feed, mapa, confirmações, prioridade, filtros e cancelamento     | Concluída.                                                    |
| 5     | Alertas simulados e revisão visual                               | Concluída.                                                    |
| 6     | Publicação e homologação do APK contra a API hospedada           | Concluída no Galaxy M32 contra o servidor da demonstração.    |
| 7     | Refinamento do app Android e limpeza do repositório              | Concluída: ajustes do app, fim do protótipo, release por tag. |

## Aceite da entrega

No Galaxy M32, o cidadão publicou uma ocorrência com fotos da câmera e da galeria e escolheu um ponto público no mapa. Outro cidadão confirmou, o gestor atendeu pelo painel e o autor consultou o histórico e o aviso no APK. A sessão e a leitura persistiram após reiniciar o aplicativo. A hospedagem passou pela rotação das contas, restrição do acesso ao banco, deploy por digest e recuperação isolada de banco e foto. Após o aceite, os dados do ensaio foram removidos.

A [matriz de aceite](docs/testing.md#aceite-por-critério) liga cada critério à sua evidência. As limitações conhecidas e o que ficou sem nova medição física estão em [concerns.md](concerns.md#pendências-abertas).

## Depois da entrega

- Versões novas saem por tag, como descreve [docs/deploy.md](docs/deploy.md#fluxo-de-entrega).
- Para outra instalação: [preparar um servidor](docs/deploy.md#preparar-um-servidor) e [configurar o Android](docs/runbook.md#configuração-do-android).
- Região, bairro e geocodificação continuam adiados conforme o [escopo](docs/scope.md).
