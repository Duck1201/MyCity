# Swagger, Dependabot e decisões de identidade

Data: 19/11/2026. Alteração limitada à documentação executável da API, automação de dependências e atualização da especificação. Login CPF e denúncias ainda não foram implementados.

## Decisões aprovadas

- CPF e senha próprios do MyCity, contas fictícias, sem integração gov.br e sem e-mail.
- “Quero mostrar minha cara” começa marcado e exibe nome e foto de perfil aos leitores autorizados.
- Desmarcado: publicação anônima inclusive para o gestor, com vínculo interno preservado para permissões/notificações. CPF e e-mail nunca aparecem em DTOs de denúncia; o modelo aprovado não contém e-mail.
- A migração da Identidade legada e credenciais distintas permanecem bloqueios antes do login HTTP. Alteração da preferência após publicação ainda precisa de decisão.

## Implementado e verificado

- `swagger-autogen` gera `apps/api/src/openapi.json` a partir das rotas, com refinamentos de schemas/respostas. `docs:check` detecta divergência entre código e JSON gerado.
- `swagger-ui-express` serve UI, schema e assets apenas em desenvolvimento com opt-in. O bootstrap restringe o listener a 127.0.0.1 nesse modo. Produção/staging não expõem documentação, inclusive com flag ligada.
- Sol verificou o bootstrap real e o Swagger no Chrome, sem acesso à EC2, credenciais ou banco da demonstração. UI exibiu as duas operações de saúde; execução de liveness retornou 200, sem violações CSP ou requisições externas observadas.
- O principal executou readiness pela UI com PostgreSQL local: 200 e `{ "data": { "status": "ready" } }`. [Captura local](swagger-local.png).
- Luna executou a suíte de tooling. A primeira execução read-only falhou em três testes por EROFS ao criar temporários. Com escrita de temporários permitida e sem alterar os testes, os 21 casos passaram. Isso não comprova QA de CPF/anonimato ainda inexistentes.
- Regressões novas falharam antes da implementação: UI retornava 404 no desenvolvimento, schemas gerados estavam com inferência incorreta, tipo XML indevido era anunciado e listener não era restrito ao loopback. A implementação foi corrigida; as expectativas não foram enfraquecidas.
- Dependabot configurado para npm, Actions e Docker, sem auto-merge. Alertas e PRs de atualização de segurança habilitados pela API do GitHub. A descoberta real de atualizações depende do processamento da configuração após merge.

Os endpoints já existentes mantiveram seu comportamento. Nenhuma migração de banco ou mudança nas senhas da EC2 foi feita nesta alteração. Os achados SEC-01 a SEC-07 da revisão anterior continuam separados e abertos.
