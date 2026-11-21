# Publicação, operação e recuperação

Este guia cobre o caminho do código até o servidor: como o GitHub valida e publica, como preparar um servidor, como lançar e desfazer uma versão e como fazer backup. Para rodar no seu computador, use o [README](../README.md#executar-localmente).

## Fluxo de entrega

| Evento                   | O que acontece                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR para `main`           | [CI](../.github/workflows/ci.yml): commits convencionais, segredos, auditoria, formatação, lint, tipos, testes com PostgreSQL, build.                                                                                                                                                                                                                                                              |
| Merge na `main` (squash) | A mesma CI roda no commit da `main`. Nada é publicado.                                                                                                                                                                                                                                                                                                                                             |
| Tag `vX.Y.Z` na `main`   | [Release](../.github/workflows/release.yml): publica as imagens, implanta na demonstração e anexa o pacote de servidor e o APK assinado ao GitHub Release.                                                                                                                                                                                                                                         |
| Rollback                 | No servidor, `bash /srv/mycity/current/deploy.sh /srv/mycity --rollback` volta para a release anterior com as imagens já baixadas. Ajuste o diretório para sua instalação. Pelo GitHub, **Actions → Release** → execução da versão anterior → **Re-run jobs → Deploy**. As migrações só avançam: volte para uma versão compatível com o schema atual ou restaure o backup feito antes da migração. |

Para lançar uma versão autorizada, faça as revisões de segurança e regressão da `main` previstas no [AGENTS.md](../AGENTS.md#fluxo-de-uma-mudança). Depois de confirmar a aprovação da CI no commit da `main`, crie e envie a tag da versão.

```bash
git switch main && git pull
git tag -a v1.0.0 -m "MyCity 1.0.0"
git push origin v1.0.0
```

O job **Verify tag** exige que o commit esteja no histórico de `origin/main` e que a CI disparada por push na `main` tenha passado para esse commit. As imagens `ghcr.io/duck1201/mycity-{api,tools,web}` recebem a tag da versão. O deploy da demonstração e o pacote de hospedagem usam os digests produzidos nessa execução. O APK é gerado e assinado em runners separados. O job de assinatura não faz checkout do código.

## Configuração no GitHub

Environment `demonstration`, que aceita somente tags `v*.*.*` (nenhuma branch):

| Tipo     | Nome                                                                | Uso                                         |
| -------- | ------------------------------------------------------------------- | ------------------------------------------- |
| Variável | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_DIR`                          | Destino SSH e diretório de deploy           |
| Secret   | `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`                                | Chave exclusiva da automação e host fixado  |
| Secret   | `GOOGLE_MAPS_ANDROID_API_KEY`                                       | Chave de Maps restrita ao pacote e ao SHA-1 |
| Secret   | `ANDROID_RELEASE_KEYSTORE_BASE64`, `ANDROID_RELEASE_STORE_PASSWORD` | Keystore PKCS12 com alias `mycity-release`  |

As senhas do banco e das contas **não** ficam no GitHub: elas existem só no `.env.production` do servidor e na cópia local do operador (veja abaixo). A origem pública da demonstração está em `PUBLIC_ORIGIN` no workflow e é usada no build do APK e na verificação final.

A `main` exige PR, os checks da CI, histórico linear e conversas resolvidas. O ruleset **Release tags** permite que só administradores criem, movam ou apaguem tags `v*`, porque uma tag dispara a publicação com os secrets do environment. Actions usa token somente leitura por padrão e actions fixadas por SHA. O [Dependabot](../.github/dependabot.yml) abre PRs mensais; nenhuma atualização é mesclada sem CI. Não aplique downgrade ou override incompatível só para zerar a auditoria.

## Preparar um servidor

Use um servidor Linux x86-64 com Bash, OpenSSL, `flock`, `curl`, `tar`, `sha256sum`, Docker com Compose 2.24 ou superior e acesso ao GHCR. Na configuração padrão, use uma instância por servidor e reserve as portas TCP 80 e 443 para o Caddy. Libere-as no firewall e aponte o DNS do seu domínio para o servidor. Escolha um caminho absoluto gravável pelo usuário de deploy, como `/srv/mycity`.

1. Baixe `mycity-server.tar.gz` e `mycity-server.tar.gz.sha256` da mesma versão nos [GitHub Releases](https://github.com/Duck1201/MyCity/releases). Em uma pasta vazia, verifique e extraia o pacote.
2. Rode o instalador com o caminho absoluto do diretório de deploy e o domínio DNS completo, sem protocolo, porta ou caminho.

    ```bash
    sha256sum --check mycity-server.tar.gz.sha256 &&
        tar -xzf mycity-server.tar.gz &&
        bash install.sh /srv/mycity mycity.example.org
    ```

3. Abra `https://mycity.example.org`. Entre como gestor com CPF `00000000003` e a senha de `DEMO_MANAGER_PASSWORD` no `/srv/mycity/.env.production`. Confira a saúde em `https://mycity.example.org/api/v1/health/ready`. O proxy usa a porta 80 para emitir o certificado HTTPS e o painel também reserva a porta 8090 em loopback para a verificação local.

Para atualizar, faça [backup](#backup) e repita com o pacote da versão mais recente, em outra pasta de extração, usando o mesmo diretório de deploy. O instalador reaproveita a configuração, o banco e as fotos. Para voltar à versão anterior, siga o [fluxo de rollback](#fluxo-de-entrega).

### Usar suas credenciais

O instalador baixa as imagens públicas sem login. Se precisar se autenticar no GHCR, use seu usuário e um token de leitura informado no terminal sem eco.

```bash
read -r -s -p 'Token do GHCR: ' mycity_registry_token && printf '\n'
printf '%s\n' "$mycity_registry_token" | bash install.sh /srv/mycity mycity.example.org --registry-user seu-usuario
unset mycity_registry_token
```

Em uma instalação nova, o instalador gera senhas distintas para o banco, a API e as três contas fictícias. Para escolher suas próprias credenciais, veja [o arquivo de configuração](#o-envproduction). Para usar Android com seu domínio, defina a URL da sua API, prepare [sua chave de Maps](runbook.md#obter-a-chave-do-google-maps) e gere [seu APK assinado](runbook.md#gerar-o-apk-assinado-localmente).

### Usar um proxy existente

Se outro proxy já ocupa a porta 80, encaminhe as requisições HTTP do domínio para a porta 80 do Caddy pela rede compartilhada. O Caddy continua recebendo HTTPS na porta publicada por `EDGE_PORT`. Antes de instalar, crie `<deploy-dir>/compose.override.yaml` com essa rede. O instalador preserva o override existente. Quando gera o `.env.production` e o override ainda não existe, o instalador cria um para publicar a porta 80 para o desafio ACME HTTP-01.

```yaml
# Proxy existente que encaminha a porta 80 do domínio para "mycity-edge".
services:
    edge:
        networks:
            default:
            proxy:
                aliases: [mycity-edge]
networks:
    proxy:
        external: true
        name: <rede-do-proxy-existente>
```

O [`deploy.sh`](../deploy/deploy.sh) trava contra deploys simultâneos, valida os três digests, baixa as imagens, sobe o banco, aplica as migrações, provisiona o papel restrito `mycity_api`, roda o seed na primeira vez (e depois só sincroniza as senhas das contas), gera as miniaturas que faltam, sobe API, painel e proxy, confere a saúde em `127.0.0.1:8090` e registra `current-release` e `previous-release`. Ele não desfaz migrações: antes de uma migração destrutiva, faça backup.

Para operar a versão ativa, defina um atalho no servidor:

```bash
DEPLOY_DIR=/srv/mycity
mc() {
    local files=(-f "$DEPLOY_DIR/current/compose.yaml")
    [[ -f "$DEPLOY_DIR/compose.override.yaml" ]] && files+=(-f "$DEPLOY_DIR/compose.override.yaml")
    docker compose --env-file "$DEPLOY_DIR/.env.production" --env-file "$DEPLOY_DIR/current/images.env" "${files[@]}" "$@"
}
```

## O `.env.production`

O instalador cria `<deploy-dir>/.env.production` com permissão `0600` se o arquivo estiver ausente. Em instalações novas, ele deriva o nome do projeto Compose do diretório de deploy para isolar seus volumes. Preserve `COMPOSE_PROJECT_NAME` nas atualizações. Ao migrar uma instalação existente para o instalador, mantenha o arquivo original. Na demonstração, o operador pode manter uma cópia privada na raiz do checkout para sincronização.

Para personalizar a primeira instalação, você pode preparar o arquivo antes de rodar o instalador. Escolha um `COMPOSE_PROJECT_NAME` exclusivo no servidor. Configure `WEB_ORIGIN` com a origem HTTPS exata, sem barra final, `PUBLIC_HOST` com o domínio e `EDGE_PORT` com a porta HTTPS (443 por padrão). Defina cinco senhas distintas em `POSTGRES_PASSWORD`, `API_DATABASE_PASSWORD`, `DEMO_CITIZEN_A_PASSWORD`, `DEMO_CITIZEN_B_PASSWORD` e `DEMO_MANAGER_PASSWORD`. Use apenas letras, dígitos, `_` e `-` nas duas senhas do banco. Se preparar o arquivo manualmente e usar o Caddy diretamente, configure também a publicação da porta 80 em `compose.override.yaml`.

A sincronização exige as três contas de demonstração provisionadas. Defina um valor próprio e distinto para cada uma das chaves `DEMO_CITIZEN_A_PASSWORD`, `DEMO_CITIZEN_B_PASSWORD` e `DEMO_MANAGER_PASSWORD`. Uma conta também não pode receber a senha atual de outra.

Nos deploys seguintes ao seed inicial, o script aplica ao banco as senhas das contas habilitadas e revoga as sessões das contas cuja senha mudou. Para trocar as três de uma vez, inclusive contas legadas desabilitadas, atualize o arquivo no servidor e execute:

```bash
mc --profile tools run --rm seed npm run db:rotate-demo-passwords -w @mycity/api
```

Para trocar a senha do banco da API, atualize `API_DATABASE_PASSWORD` e repita o deploy numa janela de manutenção. A senha do proprietário (`POSTGRES_PASSWORD`) precisa continuar igual à do volume existente.

## Backup

No servidor, com o atalho `mc` definido, escolha um diretório novo de backup. O procedimento para a API temporariamente, mantém o banco ativo e guarda os arquivos da release necessários para a restauração.

```bash
set -e
umask 077
MYCITY_BACKUP_DIR="/caminho/privado/mycity-$(date +%Y%m%d-%H%M%S)"
mkdir -- "$MYCITY_BACKUP_DIR"
mc stop api
mc exec -T db pg_dump -U mycity -d mycity -Fc > "$MYCITY_BACKUP_DIR/database.dump"
mc --profile tools run --rm --no-deps -T --entrypoint tar seed -C /app/uploads -cf - . > "$MYCITY_BACKUP_DIR/photos.tar"
cp "$DEPLOY_DIR/current/"{images.env,compose.yaml,provision-api.sql} "$MYCITY_BACKUP_DIR/"
(cd "$MYCITY_BACKUP_DIR" && sha256sum database.dump photos.tar images.env compose.yaml provision-api.sql > SHA256SUMS)
cat "$DEPLOY_DIR/current-release" > "$MYCITY_BACKUP_DIR/release"
mc up -d --wait api
```

## Restaurar

Ensaie a restauração em um projeto Compose isolado, com volumes vazios e sem tráfego público. Use Compose 2.24.4 ou superior para o `!override`. Defina `MYCITY_RESTORE_RELEASE_DIR` com o caminho dos arquivos da release do backup. Para backups anteriores à retenção, use os arquivos da versão de destino que implementa a regra. Crie `restore.env` com senhas novas e distintas para `POSTGRES_PASSWORD` e `API_DATABASE_PASSWORD`, `WEB_ORIGIN=http://localhost:18090` e `PUBLIC_HOST=localhost`. Crie `restore.override.yaml` para desativar o `edge` e publicar o painel em loopback.

```yaml
services:
    edge:
        profiles: [disabled]
    web:
        ports: !override
            - 127.0.0.1:18090:80
```

```bash
set -e
r() { docker compose -p mycity-restore --env-file restore.env --env-file "$MYCITY_RESTORE_RELEASE_DIR/images.env" -f "$MYCITY_RESTORE_RELEASE_DIR/compose.yaml" -f ./restore.override.yaml "$@"; }
(cd "$MYCITY_BACKUP_DIR" && sha256sum --check SHA256SUMS)
r up -d --wait db
r exec -T db psql -U mycity -d mycity -v ON_ERROR_STOP=1 -c 'CREATE ROLE mycity_api NOLOGIN;'
r exec -T db pg_restore --exit-on-error -U mycity -d mycity < "$MYCITY_BACKUP_DIR/database.dump"
r --profile tools run --rm --no-deps -T --entrypoint tar seed --no-same-owner -C /app/uploads -xf - < "$MYCITY_BACKUP_DIR/photos.tar"
r --profile tools run --rm -T migrate
r --profile tools run --rm -T provision
r --profile tools run --rm -T thumbnails npm run photos:purge-expired -w @mycity/api
r up -d --wait api web
curl --fail --silent --show-error http://localhost:18090/api/v1/health/ready
```

Os backups têm ciclo de guarda próprio. Antes de liberar tráfego, execute a limpeza com a versão que implementa a retenção e confirme sua conclusão. Se faltar a pasta de uma denúncia vencida, confira a montagem do volume restaurado e repita a limpeza. Entre como gestor, confira uma foto vigente e verifique que uma denúncia com prazo vencido exibe “Fotos expiradas” e preserva o histórico. Depois, `r down` encerra o ensaio sem tocar na instância original.

## Miniaturas das fotos

A API grava no envio uma miniatura de até 320 px (`<photoId>.thumb.jpg`) ao lado de cada foto, e as listas do painel usam a rota `/thumb`. O `deploy.sh` roda o serviço `thumbnails` (com o papel restrito `mycity_api`, como a API) a cada implantação, depois das migrações e antes de subir a API: ele gera só as miniaturas que faltam e informa `{"created":N,"missingOriginals":M}`. Enquanto uma miniatura não existe, a rota serve a original. No ambiente local, gere as que faltam com `npm run photos:backfill-thumbnails -w @mycity/api`; ele lê o `.env` da raiz e usa a mesma pasta de uploads da API.

## Reconciliar fotos órfãs

Uma interrupção entre gravar as fotos e confirmar a denúncia pode deixar um diretório sem registro no banco. Com backup feito e a API parada:

```bash
mc stop api
mc --profile tools run --rm seed npm exec -w @mycity/api -- tsx prisma/reconcile-report-files.ts
```

O inventário lista só diretórios gerados pelo servidor, com mais de 24 horas, apenas com nomes de foto esperados e sem denúncia no banco. Remova cada ID conferido acrescentando `--remove ID`; a ferramenta verifica banco e volume de novo antes de apagar. Depois, `mc up -d --wait api`.

Para conferir arquivos deixados por uma edição interrompida dentro de uma denúncia existente, use o mesmo comando com `--list-files`. A lista contém caminhos relativos na forma `ID/ARQUIVO`. Com a API parada, `--remove-file ID/ARQUIVO` revalida o vínculo e a idade de 24 horas antes de remover apenas o arquivo selecionado.

## Diagnóstico

| Sintoma                  | Verificação inicial                                                      |
| ------------------------ | ------------------------------------------------------------------------ |
| Deploy falha no Verify   | A tag aponta para um commit da `main` com CI aprovada?                   |
| App não conecta          | URL incluída no APK, DNS, certificado, conectividade e readiness da API. |
| Login falha só na web    | `WEB_ORIGIN`, cookie, proxy/HTTPS e proteção CSRF.                       |
| Foto rejeitada           | Quantidade, conteúdo, dimensões, limite da API e do proxy (16 MiB).      |
| Foto some após recriação | Montagem do volume `photos` e correspondência com o banco.               |
| Mapa não aparece         | Chave de Maps restrita ao pacote e ao SHA-1 do certificado usado.        |

Os logs do Nginx e do Caddy registram método, rota e resultado sem query string nem Referer.
