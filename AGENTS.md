# Trabalhar no MyCity

Converse em pt-BR. Código, identificadores, comentários e commits em inglês; textos da interface em pt-BR. Use Nunito como fonte do painel e do app.

O MVP está entregue (veja [plan.md](plan.md)). Toda mudança agora é manutenção: um PR pequeno por assunto.

## Fluxo de uma mudança

Siga os passos na ordem. Nenhum deles é opcional.

1. **Ambiente.** Use este checkout, o `.env` e os serviços que já existem; não crie clone, worktree ou cópia sem pedido explícito. Se faltar algo, siga o [README](README.md#executar-localmente):

    ```bash
    docker compose up -d --wait db                    # banco de desenvolvimento
    docker compose --profile test up -d --wait test-db # banco da suíte (mycity_test)
    npm run dev                                       # API :3000 + painel :8090
    npm run dev:mobile                                # Metro para o app (Expo Go ou APK de dev)
    ```

2. **Localize a regra** antes de mudar comportamento (tabela abaixo). Se a regra depende de uma decisão aberta em [concerns.md](concerns.md), pergunte ao responsável antes.

3. **Teste primeiro.** Escreva o teste de regressão, veja-o **falhar** pelo motivo certo e só então implemente. Teste pela interface pública (rota HTTP, componente, função exportada), na pasta `tests/` do workspace. Banco e regra de negócio nunca são mockados; mock só na fronteira externa (relógio, Maps, rede do aparelho).

4. **Verifique tudo**, nesta ordem:

    ```bash
    npm run format:check
    npm run check                                 # OpenAPI, lint, tipos, todos os testes, build
    npm run export:android -w @mycity/mobile      # se mexeu no app
    ```

    Mudou o painel? Confira o fluxo no navegador contra a API local. Mudou câmera, GPS, mapa ou build Android? Valide no Android físico; se não der, registre a lacuna em [docs/testing.md](docs/testing.md).

5. **Atualize o documento da regra** que mudou (tabela abaixo) e registre pendências em [concerns.md](concerns.md).

6. **Commit, push e PR.**

    ```bash
    git add <arquivos> && git commit -m "<tipo>: <resumo em inglês>"
    git push -u origin HEAD
    gh pr create --base main
    ```

    A CI precisa ficar verde. O merge é **squash** e o título do PR vira o commit na `main`. Diga no PR o que mudou, o que foi verificado e o que ficou pendente.

7. **Release** (só quando o responsável pedir): uma tag `vX.Y.Z` na `main` publica as imagens, implanta no servidor e anexa o APK. Antes da tag, rode os dois revisores sobre a `main`: no Claude Code, os subagentes `security-reviewer` e `regression-reviewer`; no Codex, `security_reviewer` e `regression_reviewer` (`.codex/agents/`). As instruções são as mesmas, em `.claude/agents/`. Veja [docs/deploy.md](docs/deploy.md#fluxo-de-entrega).

## Testes vermelhos

Teste falhando é informação sobre o código. Conserte o código, nunca o teste: nada de apagar, pular (`skip`, `.only`, comentar), afrouxar asserção, aumentar timeout, colocar retry ou regravar snapshot. Se o teste parecer errado, pare e mostre ao responsável esperado, obtido e o motivo. Teste instável é bug a investigar. Teste que já estava vermelho antes da sua mudança é reportado como pré-existente.

## Onde está cada regra

| Se a tarefa envolve        | Leia                                                                                                                                                                      | O código fica em                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Regra de negócio, jornada  | [Escopo](docs/scope.md), [vocabulário](docs/context.md), [fluxos](docs/flows.md), [requisitos (AC)](docs/requirements.md)                                                 | `apps/api/src/modules/<módulo>/`                          |
| API, autenticação, uploads | [Contrato HTTP](docs/api/contract.md), [segurança](docs/security.md). Autorize antes de processar o upload.                                                               | `apps/api/src/`, DTOs e validação em `packages/contracts` |
| Banco, migração            | [Modelo de dados](docs/data-model.md), [Prisma](docs/prisma.md). Nunca altere migração publicada.                                                                         | `apps/api/prisma/`                                        |
| Fronteira entre módulos    | [Arquitetura](docs/architecture.md). Interfaces públicas em memória; cada módulo controla seus dados.                                                                     | `apps/api/src/modules/*/index.ts`                         |
| Painel do gestor           | [Usabilidade](docs/usability.md)                                                                                                                                          | `apps/web/src/` (React, Tailwind, shadcn)                 |
| App do cidadão             | [Usabilidade](docs/usability.md), [Android](docs/runbook.md#configuração-do-android)                                                                                      | `apps/mobile/src/` (Expo, StyleSheet)                     |
| Testes e evidências        | [Estratégia de testes](docs/testing.md)                                                                                                                                   | `*/tests/`, `scripts/tests/`                              |
| Publicação, servidor       | [Publicação e operação](docs/deploy.md). Para mexer no servidor, use a skill `prod-vm` (`.agents/skills/`). Detalhes do servidor ficam no servidor, nunca no repositório. | `deploy/`, `.github/workflows/`                           |
| Ambiente local             | [README](README.md#executar-localmente), [runbook](docs/runbook.md), `.env.example`. npm workspaces com o lockfile da raiz.                                               | `scripts/`, `compose.yaml`                                |

As fontes acadêmicas em `docs/references/` são históricas: não as edite.

## Recursos compartilhados

- A suíte automatizada usa só o banco `mycity_test`. Ensaios manuais usam o banco de desenvolvimento com dados fictícios, preservando o que outras tarefas criaram.
- Rode em sequência as verificações que escrevem no mesmo banco ou nos uploads. Ao delegar, combine antes quem escreve.
- `.env`, credenciais, keystores e dumps nunca entram no Git.
