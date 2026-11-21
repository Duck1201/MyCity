# Publicação, operação e recuperação

Este guia cobre o caminho do código até o servidor: como o GitHub valida e publica, como preparar um servidor, como lançar e desfazer uma versão e como fazer backup. Para rodar no seu computador, use o [README](../README.md#executar-localmente).

## Fluxo de entrega

| Evento                   | O que acontece                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR para `main`           | [CI](../.github/workflows/ci.yml): commits convencionais, segredos, auditoria, formatação, lint, tipos, testes com PostgreSQL, build.                                                                                                                                                                                                                            |
| Merge na `main` (squash) | A mesma CI roda no commit da `main`. Nada é publicado.                                                                                                                                                                                                                                                                                                           |
| Tag `vX.Y.Z` na `main`   | [Release](../.github/workflows/release.yml): publica as imagens, implanta no servidor e anexa o APK assinado ao GitHub Release.                                                                                                                                                                                                                                  |
| Rollback                 | Na VM, `deploy.sh <deploy-dir> --rollback` volta para a release anterior com as imagens já baixadas (receita na skill `prod-vm`). Pelo GitHub, **Actions → Release** → execução da versão anterior → **Re-run jobs → Deploy**. As migrações só avançam: volte apenas para uma versão compatível com o schema atual ou restaure o backup feito antes da migração. |

Para lançar uma versão depois do merge:

```bash
git switch main && git pull
git tag -a v1.0.0 -m "MyCity 1.0.0"
git push origin v1.0.0
```

O job **Verify tag** recusa tags fora da `main` ou sem CI aprovada. As imagens `ghcr.io/duck1201/mycity-{api,tools,web}` recebem a tag da versão, e o servidor usa sempre o digest produzido na mesma execução. O APK é gerado e assinado em runners separados. O job de assinatura não faz checkout do código.

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

Use Linux x86-64 com Docker e Compose 2.24 ou superior. Aponte um nome DNS para o servidor e escolha um diretório de deploy, como `/srv/mycity`, acessível ao usuário de deploy.

1. Crie `<deploy-dir>/.env.production` com permissão `0600`:

    ```dotenv
    WEB_ORIGIN=https://mycity.example.org
    PUBLIC_HOST=mycity.example.org
    EDGE_PORT=443
    POSTGRES_PASSWORD=<openssl rand -hex 32>
    API_DATABASE_PASSWORD=<outro openssl rand -hex 32>
    DEMO_CITIZEN_A_PASSWORD=<senha>
    DEMO_CITIZEN_B_PASSWORD=<senha>
    DEMO_MANAGER_PASSWORD=<senha>
    ```

    `WEB_ORIGIN` é a origem exata do painel, sem barra final e com a porta quando ela não for 443. As cinco senhas devem ser distintas. As duas do banco aceitam letras, dígitos, `_` e `-`.

2. Se o servidor já tiver outro proxy ou regras próprias, coloque-as em `<deploy-dir>/compose.override.yaml`. Esse arquivo nunca vai para o repositório. Exemplos:

    ```yaml
    # Caddy do MyCity sozinho no servidor: libere a porta 80 para o desafio ACME HTTP-01.
    services:
        edge:
            ports:
                - 80:80
                - 443:443
    ```

    ```yaml
    # Atrás de um proxy existente que encaminha a porta 80 do domínio para "mycity-edge".
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

3. Faça a primeira implantação com uma tag (seção anterior) ou manualmente, a partir de um checkout da versão:

    ```bash
    release=v1.0.0-1
    mkdir -p "$DEPLOY_DIR/releases/$release"
    cp deploy/compose.yaml deploy/Caddyfile deploy/provision-api.sql deploy/deploy.sh "$DEPLOY_DIR/releases/$release/"
    for image in api tools web; do
        printf '%s_DIGEST=%s\n' "${image^^}" "$(docker buildx imagetools inspect "ghcr.io/duck1201/mycity-$image:${release%-*}" --format '{{json .Manifest.Digest}}' | tr -d '"')"
    done > "$DEPLOY_DIR/releases/$release/images.env"
    echo "$GHCR_READ_TOKEN" | bash "$DEPLOY_DIR/releases/$release/deploy.sh" "$DEPLOY_DIR" "$release" "$GHCR_USER"
    ```

O [`deploy.sh`](../deploy/deploy.sh) trava contra deploys simultâneos, valida os três digests, baixa as imagens, sobe o banco, aplica as migrações, provisiona o papel restrito `mycity_api`, roda o seed na primeira vez (e depois só sincroniza as senhas das contas), gera as miniaturas que faltam, sobe API, painel e proxy, confere a saúde em `127.0.0.1:8090` e registra `current-release` e `previous-release`. Ele não desfaz migrações: antes de uma migração destrutiva, faça backup.

Para operar a versão ativa, defina um atalho no servidor:

```bash
mc() {
    local files=(-f "$DEPLOY_DIR/current/compose.yaml")
    [[ -f "$DEPLOY_DIR/compose.override.yaml" ]] && files+=(-f "$DEPLOY_DIR/compose.override.yaml")
    docker compose --env-file "$DEPLOY_DIR/.env.production" --env-file "$DEPLOY_DIR/current/images.env" "${files[@]}" "$@"
}
```

## O `.env.production`

Existe um único `.env.production`: o do servidor, em `<deploy-dir>/.env.production`, espelhado na raiz do checkout do operador (ignorado pelo Git, permissão `0600`). A cópia local é onde você edita; o servidor é o que vale. A skill `prod-vm` traz as receitas para comparar as duas cópias sem exibir valores, enviar a local para o servidor e aplicar a mudança.

Cada deploy aplica ao banco as senhas das contas já habilitadas e revoga somente as sessões das contas cuja senha mudou. Para trocar as três de uma vez, inclusive contas legadas desabilitadas, envie o arquivo novo e execute:

```bash
mc --profile tools run --rm seed npm run db:rotate-demo-passwords -w @mycity/api
```

Para trocar a senha do banco da API, atualize `API_DATABASE_PASSWORD` e repita o deploy numa janela de manutenção. A senha do proprietário (`POSTGRES_PASSWORD`) precisa continuar igual à do volume existente.

## Backup

Pare a API, mantenha o banco ativo e grave os arquivos num diretório novo e privado:

```bash
set -e
umask 077
mkdir -- "$MYCITY_BACKUP_DIR"
mc stop api
mc exec -T db pg_dump -U mycity -d mycity -Fc > "$MYCITY_BACKUP_DIR/database.dump"
mc --profile tools run --rm --no-deps -T --entrypoint tar seed -C /app/uploads -cf - . > "$MYCITY_BACKUP_DIR/photos.tar"
(cd "$MYCITY_BACKUP_DIR" && sha256sum database.dump photos.tar > SHA256SUMS)
cat "$DEPLOY_DIR/current-release" > "$MYCITY_BACKUP_DIR/release"
mc up -d --wait api
```

## Restaurar

Ensaie a restauração num projeto Compose isolado, sem tráfego público, com o `images.env` da versão do backup (para backups anteriores à retenção, use o da versão de destino que implementa a regra) e um `.env` próprio (novas senhas de banco, `WEB_ORIGIN=http://localhost:18090`). O override precisa remover o `edge` e publicar o painel na porta do ensaio:

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
r() { docker compose -p mycity-restore --env-file restore.env --env-file "$MYCITY_BACKUP_IMAGES" -f deploy/compose.yaml -f restore.override.yaml "$@"; }
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
mc --profile tools run --rm -e UPLOAD_DIR=/app/uploads -v mycity_photos:/app/uploads migrate npm exec -w @mycity/api -- tsx prisma/reconcile-report-files.ts
```

O inventário lista só diretórios gerados pelo servidor, com mais de 24 horas, apenas com nomes de foto esperados e sem denúncia no banco. Remova cada ID conferido acrescentando `--remove ID`; a ferramenta verifica banco e volume de novo antes de apagar. Depois, `mc up -d --wait api`.

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
