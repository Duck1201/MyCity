# Revisão independente da fundação — Sol

Data: 19/11/2026. Agente `/root/pentest`, modelo `gpt-6.2-sol`, esforço high. Base Git: `402be6f2c3afb3b775a0cd27b9ff68a85731271c`, incluindo as especificações locais ainda não commitadas de sessão, acesso restrito e usabilidade. Relatório consolidado e conferido pelo agente principal.

## Escopo e resultado

Revisão somente leitura de API, scripts, Docker/proxy, CI/CD e contratos. O agente não leu credenciais, acessou a EC2 ou testou o domínio público. Validou os dois Compose com valores fictícios, sintaxe Bash, diff e a regressão de diagnósticos Docker. Exercitou rotas locais por Supertest: liveness 200; rotas de negócio inexistentes retornam 404.

**Parecer: incompleto para segurança de uma aplicação funcional.** A fundação continua sendo uma página de marca e rotas de saúde; as verificações não aprovam login, gestão ou upload futuros. Os pontos abaixo bloqueiam as liberações correspondentes e não foram corrigidos nesta criação dos agentes.

| ID     | Gravidade e momento              | Evidência                                                                                                | Ação necessária                                                                                                                     |
| ------ | -------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | Alta antes de liberar login HTTP | `apps/api/src/modules/identity/index.ts` e teste de integração usam a mesma senha nas três contas        | Senha distinta por conta, testes cruzados e rotação explícita das contas existentes; seed idempotente não faz essa rotação sozinho  |
| SEC-02 | Média, configuração atual        | API/migração/seed usam a conta inicial administrativa do PostgreSQL no Compose                           | Separar runtime DML de migração DDL e verificar permissões negativas com banco real                                                 |
| SEC-03 | Média, integridade de entrega    | Imagens são recompiladas após checks e implantadas por tag; rerun antigo pode reaplicar release anterior | Validar e implantar digests correspondentes; controlar retrocesso por procedimento explícito                                        |
| SEC-04 | Média antes de liberar upload    | Nginx usa buffering padrão em `/api/`                                                                    | Verificar autorização antes de escrita inclusive nos temporários do proxy; configurar streaming/limites e testar o caminho completo |
| SEC-05 | Baixa, disponibilidade           | Readiness pública chama `user.count()` sem contenção específica                                          | Limitar/restringir consultas mantendo resposta genérica; não houve teste de carga nem indisponibilidade observada                   |
| SEC-06 | Baixa, isolamento local          | Runner de integração carrega `.env` comum e herda variáveis; Prisma também pode carregá-lo               | Separar configuração de teste e usar canários para verificar ambiente dos subprocessos                                              |
| SEC-07 | Baixa, contexto de build         | `.dockerignore` e `COPY . .` não constituem uma exclusão abrangente de chaves/arquivos aninhados         | Restringir contexto/cópias e verificar com canários sintéticos; nenhum novo segredo exposto foi observado                           |

## Gate por fase

- 0: fechar matriz de acesso, exceções públicas, sessão, limites e retenção.
- 1: verificar redes/portas, privilégios de banco, contexto/artefatos e integridade de release.
- 2: corrigir SEC-01/SEC-04 e comprovar sessões, papéis, CSRF, limites e fotos protegidas antes da publicação.
- 3: testar ações administrativas, destinatário das notificações e efeitos atômicos.
- 4: testar titularidade, visibilidade por status, unicidade e concorrência.
- 5: revisar estado após logout/expiração, bundles, console e simulações.
- 6: validar destino autorizado, restauração isolada e APK instalado em Android real.

Mudanças posteriores precisam de nova revisão no escopo afetado. A classificação de risco não equivale a exploração confirmada.

## Revalidação dos gates adicionados nesta alteração

O Sol revisou os quatro registros de agentes e os novos scripts. Encontrou bypasses no scanner em desenvolvimento (configuração/ignore vindos do checkout e índice Git não inspecionado); eles foram reproduzidos com chaves sintéticas e corrigidos antes de publicação.

A revalidação independente usou repositórios descartáveis: caso limpo passou; chaves fictícias na árvore, somente no índice e somente no histórico foram detectadas; `.gitleaksignore` regular/quebrado e leitura por ancestral simbólico externo foram bloqueados. Os nove testes novos de tooling passaram. O canário também detecta a chave mesmo com configuração hostil. Nenhuma credencial real foi usada.

O helper de firewall passou a serializar chamadas com `flock`, validar a interface existente e testar a política completa. O principal reaplicou o helper na VM e conferiu salto único em ambas as famílias e API saudável. O Sol não executou alterações remotas.

Parecer sobre os novos gates: bloqueantes encontrados na revisão corrigidos no escopo testado. SEC-01 a SEC-07 da aplicação/base permanecem abertos. A suíte completa local passou com 50 testes, lint, typecheck, builds, formatação e validação dos workflows.
