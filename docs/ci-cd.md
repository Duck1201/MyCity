# GitHub, permissões e CI/CD

Repositório: [Duck1201/MyCity](https://github.com/Duck1201/MyCity), público, conforme escolha explícita do responsável. O código do projeto é licenciado sob Apache 2.0.

## Colaboração

- Commits e títulos de PR seguem Conventional Commits, verificados por `scripts/check-commits.mjs` e testes em `scripts/tests/`.
- Usar branches de trabalho e PRs para `main`. Squash merge habilitado; merge commits e rebase merge desabilitados. O título do PR vira o título do commit de squash.
- Branches de origem são removidas após merge. Nenhum colaborador externo foi adicionado.
- Proteção aplicada e conferida pela API de `main`: PR, checks `Conventional Commits`, `Quality checks` e `Container builds`, histórico linear, conversas resolvidas, bloqueio de force push e exclusão. As regras também se aplicam a administradores; o projeto individual exige PR, mas não uma aprovação de outro colaborador.

## Permissões do Actions

- Token padrão somente leitura; workflows não podem aprovar PRs.
- Actions limitadas às do GitHub e `docker/*`, com referências fixadas por SHA completo.
- Jobs de validação têm apenas `contents: read`.
- Somente publicação após push aprovado na `main` recebe `packages: write`.
- Deploy recebe `contents: read` e `packages: read`.
- Environment `demonstration` aceita somente a branch `main`.
- Chave SSH exclusiva da automação, sem encaminhamento de portas/PTY, armazenada nos secrets do environment. A chave original da EC2 permanece local.

## CI

Workflow: `.github/workflows/ci.yml`.

1. Em PR/push de `main`, validar títulos convencionais.
2. Instalar pelo lockfile e gerar Prisma.
3. Verificar formatação, lint, tipos, todos os testes e builds.
4. Usar PostgreSQL real de teste como service do runner; sem credenciais de demonstração.
5. Exportar o bundle Android, sem afirmar geração de APK.
6. Construir imagens de API, ferramentas e web.
7. Somente em push para `main`, publicar imagens aprovadas no GHCR com tag `sha-<commit>`.

Imagens: `ghcr.io/duck1201/mycity-api`, `mycity-tools` e `mycity-web`. O runtime da API não leva ferramentas mobile/testes. Migrações/seed usam a imagem tools.

## CD

Workflow: `.github/workflows/deploy.yml`. Dispara após uma CI concluída com sucesso, originada por push na `main` deste mesmo repositório. PRs não disparam deploy. Checkout e imagens usam o SHA daquela execução, não a ponta da branch no momento posterior.

Destino: EC2 Debian x86_64, usuário `admin`, diretório `/opt/mycity`. Configuração de cada release fica em `releases/<sha>`. Volumes Docker de banco, fotos e certificados permanecem independentes da release.

`scripts/deploy.sh`:

1. Valida argumentos e usa lock contra deploy concorrente.
2. Recebe o token efêmero de leitura do GHCR por stdin, usando um diretório temporário de autenticação removido ao sair.
3. Baixa imagens, sobe o banco e aplica migrações explicitamente.
4. Executa seed apenas na preparação inicial, marcada por `.seeded`; não redefine senha em atualizações.
5. Atualiza API, web e proxy, espera saúde e confere a API pela porta local 8090.
6. Registra release atual/anterior. Não faz rollback automático de schema; falhas devem ser diagnosticadas preservando volumes.

O workflow verifica também o endpoint HTTPS externo. Uma falha externa marca o deploy como falho mesmo que o serviço local esteja saudável.

## Domínio e porta

URL escolhida: **https://mycity.private-gateway.site:8080**. O responsável informou que DNS e TCP 8080 no Security Group estão configurados; o acesso será confirmado no deploy.

O MyCity tem um Caddy separado, publicado apenas na porta 8080. O Caddy existente mantém suas portas 80/443 e os outros sistemas. Foi adicionada somente uma rota HTTP para o host do MyCity encaminhando a `mycity-edge:80`, para o desafio ACME HTTP-01 e redirecionamento. A validação TLS-ALPN na 443 está desativada no Caddy do MyCity.

O proxy do MyCity participa da rede externa já existente `kim-activity_stream-net`. O banco fica apenas na rede privada do Compose. A web também atende em loopback 8090 para verificações locais.

Backup do Caddyfile anterior: `/home/admin/discord-stream/deploy/Caddyfile.before-mycity`. Alterações futuras devem preservar o bloco original e validar a configuração antes de reload.

## Configuração protegida

| Tipo                        | Nome               | Uso                                               |
| --------------------------- | ------------------ | ------------------------------------------------- |
| Secret do environment       | SSH_PRIVATE_KEY    | Chave exclusiva do deploy                         |
| Secret do environment       | SSH_KNOWN_HOSTS    | Chave de host verificada na conexão inicial       |
| Variável do environment     | DEPLOY_HOST        | Host SSH da EC2                                   |
| Variável do environment     | DEPLOY_USER        | Usuário de deploy                                 |
| Variável do environment     | DEPLOY_DIR         | `/opt/mycity`                                     |
| Arquivo somente no servidor | `/opt/mycity/.env` | Senhas aleatórias do PostgreSQL e das contas demo |

Tokens/segredos não entram nos comandos impressos, arquivos versionados ou imagens. A chave de host é fixada; não usar `StrictHostKeyChecking=no` nem buscar uma nova chave de host sem validação a cada execução.

## Operação

Para verificar sem imprimir segredos:

```bash
gh run list --repo Duck1201/MyCity
gh run view <run-id> --repo Duck1201/MyCity
curl --fail https://mycity.private-gateway.site:8080/api/v1/health/ready
```

No servidor, usar o SHA de `current-release` como `RELEASE_SHA`, o arquivo `/opt/mycity/.env` e `/opt/mycity/current/compose.deploy.yaml` nos comandos Compose. Não remover volumes para atualizar. Antes de uma migração destrutiva, preparar backup consistente de banco/fotos e estratégia de restauração.

## Evidências

- Repositório tornado público por escolha explícita do responsável após o GitHub recusar proteção de branch no plano privado.
- Proteção da `main` aplicada e conferida pela API: PR, três checks obrigatórios, branch atualizada, histórico linear e bloqueio de force push/exclusão, inclusive para administradores.
- Secrets/variáveis do environment `demonstration` configurados; chave exclusiva de CI testada por SSH.
- Caddy existente validado e recarregado após adicionar somente a rota HTTP do MyCity. DNS A aponta para a EC2.
- A primeira CI do commit inicial foi cancelada para evitar deploy na porta anterior (3443), substituída por 8080 por solicitação do responsável.
- As execuções que publicarem e implantarem a versão final serão verificadas no GitHub; esta lista não declara sucesso antecipado.

O edge tem um healthcheck HTTPS limitado para aguardar a emissão inicial do certificado e a API saudável antes de concluir o Compose. A verificação pública no workflow usa timeout explícito; falha não é ignorada.

## Primeira implantação verificada

- [CI da main aprovada](https://github.com/Duck1201/MyCity/actions/runs/44442729128), com 40 testes, builds e publicação de API/tools/web para o commit `b8e5758e84d8ac0128d58123e4923bb440a63188`.
- [Deploy aprovado](https://github.com/Duck1201/MyCity/actions/runs/44443203779): conexão SSH, imagens do GHCR, migração, seed inicial e verificação HTTPS externa concluídos.
- `https://mycity.private-gateway.site:8080/api/v1/health/ready` respondeu HTTP 200 com `{ "data": { "status": "ready" } }`, validado novamente por curl com verificação TLS habilitada.
- [Tela inicial na EC2](evidence/ec2-foundation.png) aberta e inspecionada no navegador. A entrega hospedada é a fundação; login, painel e denúncias ainda serão implementados.
- Containers de banco/API/edge saudáveis, web em loopback 8090 e edge público 8080. Serviços anteriores da EC2 permaneceram ativos.
- Secret scanning e push protection habilitados. Nenhuma chave privada, senha local ou token foi versionado.

As execuções acima são evidência do commit identificado. Para releases posteriores, consultar os workflows; não presumir que um resultado antigo valida código novo.
