# Instruções do MyCity

## Idioma e continuidade

- Converse sempre em português do Brasil. Código, identificadores e commits seguem inglês; mensagens de interface usam pt-BR.
- Preserve alterações existentes e incorpore o direcionamento mais recente do usuário. Após retomada, confira o estado real antes de repetir trabalho.
- Antes de alterar comportamento, consulte `plan.md`, `concerns.md` e a especificação correspondente. Propostas marcadas como pendentes não são requisitos aprovados.
- Resolva detalhes rotineiros e reversíveis; alinhe escolhas que mudem escopo, comportamento ou contrato importante. Não interrompa trabalho já autorizado para pedir a mesma aprovação.

## Fontes e SDD

- Para termos do domínio, leia `docs/context.md`; para regras, `docs/requirements.md` e `docs/flows.md`.
- Para API, consulte `docs/api/contract.md`; para entidades, `docs/data-model.md`. Atualize contrato e critérios de aceitação junto de mudanças de comportamento.
- Antes de mudar arquitetura ou dependências entre módulos, consulte `docs/architecture.md` e `docs/decisions/`.
- Preserve o conteúdo histórico em `docs/references/`. Use exatamente a origem indicada pelo usuário antes de converter ou enviar um artefato.
- Registre pendências em `concerns.md` e evidências reais em `docs/evidence/`. Mantenha o estado do plano coerente com o código, sem marcar cenários futuros como testados.

## Arquitetura

- Mantenha npm workspaces e um único `package-lock.json`. Versões e comandos vêm dos manifestos; use `npm ci` para instalação reproduzível.
- O backend é um monólito modular. Identidade, Denúncias, Notificações e Alertas se comunicam em memória por suas interfaces públicas; não introduza HTTP interno, fila ou microserviços.
- Cada módulo encapsula seus dados e implementação. Importe somente a interface pública de outro módulo; a composição controla dependências e transações.
- `packages/contracts` compartilha DTOs e validações, sem Prisma, segredos ou acesso ao banco. O backend valida entradas e permissões independentemente da interface.
- Use React/Tailwind/shadcn na web e React Native/Expo/StyleSheet no app. O alvo homologado é Android.
- Siga `.prettierrc.json`; preserve o padrão escolhido pelo usuário. Não altere limites de lint/testes para fazer verificações passarem.

## TDD e integridade dos testes

- Para feature ou bug, escreva regressão na mesma alteração e commit, quando houver commit. Confirme a falha antes da implementação; avance uma fatia funcional por vez.
- Teste por funções/interfaces públicas dos módulos, HTTP e interfaces observáveis dos clientes. Evite acoplamento a métodos privados.
- Use os runners e diretórios existentes. Unitários de regras puras não precisam de banco; integração de persistência usa PostgreSQL real e isolado.
- Nunca mocke banco nem regra de negócio sob teste. Mocks ficam nas fronteiras externas não avaliadas. Se o banco estiver indisponível, informe o bloqueio antes de substituir por mock ou criar outra infraestrutura.
- Não apague casos, use skips/`.only`, reduza asserções, aumente tolerâncias/timeouts, engula erros, adicione retries ou regrave snapshots para esconder defeitos.
- Código de produção atende ao contrato real; não introduza comportamento exclusivo de testes. Investigue flakiness como bug.
- Quando uma mudança de comportamento for solicitada, atualize as expectativas correspondentes e informe quais mudaram. Nos demais casos, peça autorização antes de alterar uma expectativa que pareça incorreta, mostrando esperado, obtido e motivo.
- Refactors sem mudança de comportamento exigem os testes existentes. Toda lacuna manual deve ter motivo e registro em `docs/testing.md`.
- Antes de concluir código, execute `npm run check`, `npm run format:check` e verificações específicas da plataforma. Prepare o banco de teste conforme `README.md`. Reporte falhas preexistentes e tudo que não foi executado.
- Para documentação, valide links e formatação; não declare testes da aplicação executados se somente os documentos foram conferidos.

## Visual e integração

- Use os conceitos da raiz como direção, não como produto final. O painel precisa de refinamento no frontend conforme feedback; não aguarde referências externas inexistentes.
- Verifique telas, estados de erro/vazio e ações no navegador. Verifique câmera, GPS, mapa e APK em Android real antes de afirmar que funcionam.
- Bundle exportado, imagem gerada ou thumbnail não comprovam funcionamento integrado. Complete o fluxo no aplicativo de destino.

## Git e entrega

- Commits e títulos de PR seguem Conventional Commits: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore` ou `revert`, com escopo opcional. Exemplo: `feat(reports): add report creation`.
- Use branches curtas e PRs para `main`; prefira squash com título convencional. Preserve alterações do usuário e evite commits que fragmentem artificialmente uma solução integrada.
- Commit/push não são pré-requisito para limpar contexto. Só publique mudanças dentro do escopo autorizado.
- Nunca versione `.env`, chaves, tokens, dumps ou arquivos de credenciais. Use secrets do GitHub para CI/CD.
- Antes de deploy, leia `docs/ci-cd.md` e `docs/runbook.md`. Preserve serviços existentes, volumes e segredos; migrações e seed são explícitos, sem reset automático.
- Na entrega, informe mudanças, verificações reais e pendências. Entrega com falhas ou verificação incompleta deve ser identificada como limitada.

## Subagentes

Delegue apenas partes independentes quando autorizado pelas instruções da sessão. Antes de iniciar, informe a finalidade; confira os resultados e reporte quem terminou e o que entregou. Status de agentes deve ser consultado no estado real.
