# Trabalhar no MyCity

Converse em pt-BR. Use inglês no código e nos commits, pt-BR na interface.

## Ambiente de desenvolvimento

- Trabalhe no checkout de desenvolvimento existente, inclusive ao delegar. Use essa raiz como diretório de trabalho de cada agente. Criar clone, worktree ou cópia do checkout para trabalhar exige pedido explícito do responsável.
- Reutilize a configuração, a API, o painel e o PostgreSQL já disponíveis. Preserve as alterações de outras tarefas e execute em sequência as verificações que gravam no mesmo recurso. Se faltar um serviço, verifique a configuração e siga o [README](README.md#executar-localmente) para iniciá-lo nesse checkout.
- Rode a suíte automatizada no banco dedicado `mycity_test`. Nos fluxos manuais integrados, use o banco de desenvolvimento com registros fictícios e preserve os dados das demais tarefas. Coordene com o agente principal qualquer verificação que escreva no banco, nos uploads ou em outro recurso compartilhado.

Use Nunito como fonte padrão das interfaces do painel web e do app mobile, inclusive nas prévias.

## Localizar a mudança

Antes de alterar comportamento, localize a fase em [plan.md](plan.md), as decisões abertas em [concerns.md](concerns.md) e o critério em [requisitos](docs/requirements.md). Uma proposta pendente exige decisão antes de virar comportamento. Para um bug, comece pelo comando ou fluxo em que o usuário observou o erro.

| Se a tarefa envolve                       | Comece aqui                                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Regra de negócio ou jornada               | [Escopo](docs/scope.md), [vocabulário](docs/context.md) e [fluxos](docs/flows.md). A regra pertence ao módulo em `apps/api/src/modules/`.                                                        |
| API, autenticação ou uploads              | [Contrato HTTP](docs/api/contract.md) e [segurança](docs/security.md). Valide permissões no backend antes do upload. DTOs e validações compartilhados ficam em `packages/contracts`.             |
| Banco ou migração                         | [Modelo de dados](docs/data-model.md) e [convenções Prisma](docs/prisma.md). Preserve migrações publicadas e dados existentes.                                                                   |
| Fronteiras entre módulos                  | [Arquitetura e decisões](docs/architecture.md). Use interfaces públicas em memória. Cada módulo controla seus dados.                                                                             |
| Painel ou app                             | `apps/web` (React/Tailwind/shadcn) ou `apps/mobile` (Expo/StyleSheet). Aplique as [heurísticas de usabilidade](docs/usability.md). Valide as mudanças no painel e no app integrados à API local. |
| Ambiente local                            | [Execução local](README.md#executar-localmente), `.env.example` e scripts do workspace envolvido. Use npm workspaces e o lockfile da raiz.                                                       |
| Deploy, migração hospedada ou recuperação | [CI/CD](docs/ci-cd.md) e [runbook](docs/runbook.md). Preserve serviços, volumes e segredos. Migrações e seed são explícitos.                                                                     |

## Implementar e verificar

- Para bug ou feature, escreva a regressão na mesma alteração e confirme a falha antes de implementar. Teste pela interface pública. Confira a persistência pela API e pelo painel do próprio ambiente de desenvolvimento, usando dados fictícios da tarefa. Mocks ficam nas fronteiras externas. Se o serviço estiver indisponível, verifique a configuração do projeto e informe o bloqueio.
- Preserve a força das asserções. Quando o comportamento solicitado mudar, atualize a expectativa correspondente e explique a mudança. Se um teste parecer errado por outro motivo, mostre esperado e obtido e peça autorização antes de alterá-lo. Investigue instabilidade sem skips, retries, detecção de teste ou aumento de tolerância.
- Para código, rode as [verificações locais](README.md#testes-e-qualidade) e as da plataforma afetada. Informe separadamente o resultado da suíte completa de CI. Em refactors, execute a suíte existente. Para mudanças no painel, confira o fluxo no navegador. Para mudanças que afetem câmera, GPS, mapa ou APK, valide em Android físico e registre lacunas em [testes](docs/testing.md). Para documentação, verifique links, formatação e os comandos ou fluxos que tiver alterado.
- Atualize o documento que define a regra alterada. Mudanças de comportamento atualizam o contrato aplicável e os critérios de aceitação. Registre pendências em `concerns.md` e informe na entrega as verificações realizadas e suas limitações. Preserve as fontes históricas em `docs/references/` e use a origem indicada pelo usuário para artefatos.

## Entregar

Informe o que mudou, o que passou e o que ficou pendente. Use branches curtas e Conventional Commits para PRs destinados a `main`; publique apenas dentro do escopo autorizado. Mantenha `.env`, credenciais e dumps fora do Git.

Ao **encerrar uma fase implementada do plano**, siga o [gate de revisão](agents/readme.md). Pentest Sol revisa segurança e Luna executa regressão pelas personas. Inclua os QAs de interface e integração conforme a superfície alterada. Os modelos e o procedimento alternativo para Luna estão nesse guia. Informe a finalidade antes de delegar, coordene o uso do banco, confira as entregas e reporte os resultados. Achados bloqueantes e verificações materiais pendentes impedem o fechamento da fase.
