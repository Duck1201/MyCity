---
name: prod-vm
description: Operar o servidor de produção do MyCity via SSH — status, logs, saúde, rollback, .env.production (comparar, enviar, aplicar), disco. Use para investigar um release que falhou, ver logs ou saúde em produção, mexer no .env.production ou fazer manutenção do stack do MyCity no servidor.
---

# prod-vm — operar o servidor do MyCity

O repositório é público: nada de host, IP, usuário ou caminho do servidor entra nele. Tudo vem do alias SSH e das variáveis do GitHub.

## Acesso

- Entre **só** com `ssh mycity-prod` (alias do `~/.ssh/config` do operador). Se o alias não existir ou falhar, **pare e pergunte ao usuário**. Nunca adivinhe host, IP ou usuário.
- Diretório de deploy: leia, não chute.

    ```bash
    D=$(gh api repos/Duck1201/MyCity/environments/demonstration/variables/DEPLOY_DIR --jq .value)
    ```

- O servidor é compartilhado com **outros projetos**. Os containers, redes e volumes deles não são seus: não toque.
- Atalho para o Compose da release ativa (sempre a partir de `$D`, nunca com `-p` chutado):

    ```bash
    ssh mycity-prod "cd $D && docker compose --env-file .env.production --env-file current/images.env -f current/compose.yaml -f compose.override.yaml <subcomando>"
    ```

    Abaixo, `mc` = esse prefixo.

## Níveis de permissão

| Nível             | O que                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 Livre          | `mc ps`, `mc logs`; `docker stats --no-stream`; `df -h`; `free -h`; `cat $D/current-release $D/previous-release`; `curl` em `/api/v1/health/ready`; comparar o `.env.production` por hash (receita abaixo); `gh run list --workflow release.yml`.                                                                                                                     |
| 🟡 Avisa e faz    | Faça e avise **imediatamente**: `mc restart api` ou `mc restart web`; `deploy.sh $D --rollback` quando a saúde falhar logo depois de um release.                                                                                                                                                                                                                      |
| 🟠 Pergunta antes | Mostre o comando exato e espere um "ok" explícito: enviar o `.env.production` local para o servidor; rotacionar senhas; editar `compose.override.yaml`; rollback fora de incidente; restaurar backup; remover imagens deste projeto.                                                                                                                                  |
| 🔴 Nunca          | Mesmo se pedirem na sessão (exige PR alterando esta skill): tocar containers, volumes ou redes de outros projetos; `docker system prune`, `docker volume prune`, `docker image prune -a` ou prune global; `mc down -v`; firewall, sshd e usuários do sistema; imprimir segredos (`cat .env.production`, `docker inspect` completo, `docker compose config` sem `-q`). |

## Receitas

### Status

```bash
ssh mycity-prod "cd $D && cat current-release previous-release 2>/dev/null; docker compose ls; df -h / | tail -1"
mc ps
curl -fsS https://mycity.private-gateway.site:8080/api/v1/health/ready
```

### Logs (`api`, `web`, `edge`, `db`)

```bash
mc logs --tail=200 api
mc logs --since=10m edge
```

Os proxies já tiram query string e Referer dos logs. Mesmo assim, não cole cookies, tokens ou cabeçalhos `Authorization` nos relatórios.

### Rollback (🟡 em incidente logo após um release; senão 🟠)

```bash
ssh mycity-prod "bash $D/current/deploy.sh $D --rollback"
```

Volta para a release em `previous-release` com as imagens já baixadas, sem migrar, e troca `current`/`previous`. As migrações só avançam: se o release novo migrou o schema, confirme a compatibilidade antes. Alternativa sem SSH: **Actions → Release** → execução anterior → **Re-run jobs → Deploy**.

### `.env.production`: comparar local e servidor (🟢)

O operador mantém uma cópia em `.env.production` na raiz do checkout (ignorada pelo Git). Compare por hash, sem exibir valores:

```bash
h='grep -E "^[A-Z_]+=" | while IFS= read -r l; do printf "%s %s\n" "${l%%=*}" "$(printf "%s" "$l" | sha256sum | cut -c1-12)"; done | sort'
t=$(umask 077; mktemp -d)
eval "cat .env.production | $h" > "$t/local"
ssh mycity-prod "cat $D/.env.production | $h" > "$t/server"
join -a1 -a2 -e AUSENTE -o 0,1.2,2.2 "$t/local" "$t/server" | awk '{print $1, ($2==$3?"igual":"DIFERENTE")}'
rm -rf -- "$t"
```

### `.env.production`: enviar a cópia local para o servidor (🟠)

1. Rode a comparação e mostre ao usuário **quais chaves** mudam (nunca os valores).
2. `POSTGRES_PASSWORD` precisa continuar igual à do volume. Se mudou, pare: isso exige manutenção do banco.
3. Após o ok:

    ```bash
    ssh mycity-prod "cp -p $D/.env.production $D/backups/.env.production.\$(date +%Y%m%d%H%M%S)"
    scp -q .env.production mycity-prod:"$D/.env.production.next"
    ssh mycity-prod "chmod 600 $D/.env.production.next && mv -f $D/.env.production.next $D/.env.production"
    mc --profile tools run --rm -T seed npm run db:sync-deployment-passwords -w @mycity/api
    mc up -d --wait api web edge
    ```

4. Confira a saúde e o login do gestor e reporte o que mudou.

### `.env.production`: trazer do servidor para a cópia local (🟢 se a local não existe; senão 🟠)

```bash
(umask 077; ssh mycity-prod "cat $D/.env.production" > .env.production)
```

O conteúdo vai direto para o arquivo; não o exiba.

### Disco e imagens (só deste projeto, 🟠)

```bash
ssh mycity-prod 'docker images --format "{{.Repository}}@{{.Digest}} {{.CreatedSince}}" | grep duck1201/mycity'
```

Nunca remova as imagens das releases em `current-release` e `previous-release`. Nada de prune.

## Configuração única do operador

1. Alias no `~/.ssh/config` (fora do repositório):

    ```text
    Host mycity-prod
      HostName <host do servidor>
      User <usuário>
      IdentityFile "<chave privada>"
      IdentitiesOnly yes
    ```

2. No servidor: `$D/.env.production` (`0600`) e, se houver proxy compartilhado, `$D/compose.override.yaml`. Veja [docs/deploy.md](../../../docs/deploy.md#preparar-um-servidor).
3. Cópia local: traga o `.env.production` do servidor com a receita acima.
