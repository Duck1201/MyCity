# Operação e roteiro de demonstração

Para executar o MyCity no seu computador, siga o [README](../README.md#executar-localmente). Este guia cobre os ajustes do [ambiente local](#ambiente-local), o [Android](#configuração-do-android), a [instalação própria](#hospedar-uma-instância-própria) e a [recuperação](#persistência-backup-e-recuperação). O [CI/CD da demonstração](ci-cd.md) descreve a publicação no servidor do projeto.

## Ambiente local

- **Portas.** No `.env` da raiz, `WEB_PORT` define a porta do painel (padrão 8090) e `PORT` a porta da API (padrão 3000). Reinicie `npm run dev` ou os dois processos `dev:api` e `dev:web`. Variáveis exportadas no terminal têm precedência sobre as respectivas chaves do arquivo.
- **Senhas.** No banco de desenvolvimento acessado em loopback, edite a variável da conta e reinicie a API para atualizar a senha da conta habilitada e revogar suas sessões. As senhas podem coincidir nesse ambiente. Bancos em outros destinos e contas legadas exigem [rotação explícita](#rotação-das-senhas-de-demonstração).
- **Dados.** `npm run db:seed` cria contas e denúncias fictícias ausentes e preserva registros, fotos e senhas existentes. Se você quiser zerar o banco local `mycity`, encerre o desenvolvimento e as outras conexões, confira host, porta e banco em `DATABASE_URL` e só então use `npm run db:reset`. O reset apaga os dados locais e reaplica as migrações. Execute o seed depois para repor os exemplos. Reserve `mycity_test` para a [suíte automatizada](testing.md#desenvolvimento-e-ciclo-do-banco).
- **Contratos.** Após editar `packages/contracts` durante a sessão, execute `npm run build:contracts` para atualizar o pacote consumido pela API.

### Executar com Docker Compose

Para executar as versões compiladas da API e do painel em containers, encerre o Vite e use o Compose da raiz com o `.env` preparado no início rápido. O seed no Compose exige três senhas de demonstração distintas.

```bash
docker compose up -d --wait db
docker compose --profile tools run --rm --build migrate
docker compose --profile tools run --rm --build seed
docker compose up -d --build --wait api web
```

Abra o painel em `http://localhost:8090` (ou na porta `WEB_PORT`). Confira a API pelo painel em `/api/v1/health/ready`. O Compose guarda banco e anexos nos volumes `database` e `photos`. Os processos de desenvolvimento usam arquivos de upload no host. Use a receita com um banco vazio ou já preparado nesse mesmo modo. Se quiser reaproveitar registros de um modo no outro, preserve também o armazenamento de fotos correspondente. O seed preserva a foto de uma denúncia já criada.

Para liberar a porta do painel antes de voltar ao Vite, use `docker compose stop web api`. Para publicar em HTTPS, siga a [instalação própria](#hospedar-uma-instância-própria).

## Demonstrar os alertas simulados

Entrar no app com uma conta de cidadão e abrir **Alertas**. Conferir os três níveis e selecionar um cenário para consultar a região ilustrativa e o período no horário de Brasília. **Voltar aos alertas** retorna à lista. A data de referência é 25/11/2026 às 12h de Brasília e permanece fixa em qualquer dia de apresentação. Os avisos de atendimento continuam em **Notificações**.

## Cadastrar uma categoria

No painel, abra **Categorias**, preencha **Nome da categoria** e clique em **Adicionar categoria**. O novo nome já pode ser escolhido no filtro da fila e na criação de denúncias pelo app atualizado. O cadastro independe de já existirem ocorrências do grupo. Nomes que diferem apenas em maiúsculas, acentos ou espaços repetidos são tratados como duplicados.

### Atualizar uma instalação anterior ao catálogo

Antes da migração `20261119110000_report_category_catalog`, construa as imagens novas, preserve o arquivo de ambiente e faça backup do PostgreSQL e das fotos. Interrompa a API antiga antes de converter o enum em chave estrangeira, aplique `db:migrate` e inicie API e web atualizadas sobre os mesmos volumes. As seis categorias originais são criadas pela migração. Em caso de reversão para o binário antigo após a migração, recupere também o backup compatível do banco.

## Demonstrar participação

No app, crie uma denúncia com o cidadão A. Entre como cidadão B, abra a ocorrência no Feed ou no Mapa e toque em “Também vi isso”. A fila de gestão prioriza os casos ativos com mais confirmações; os filtros de categoria e status permitem acompanhar o mesmo registro. O cidadão B pode retirar sua confirmação enquanto o caso estiver ativo. Em Minhas denúncias, A pode cancelar em Enviado ou Em análise. O caso cancelado permanece para A e para o gestor e deixa as consultas públicas autenticadas.

## Rotação das senhas de demonstração

Em um ambiente que usava `DEMO_PASSWORD`, configure três novos segredos aleatórios e independentes no arquivo protegido do ambiente. Use `DEMO_CITIZEN_A_PASSWORD` para o CPF com final 01, `DEMO_CITIZEN_B_PASSWORD` para o final 02 e `DEMO_MANAGER_PASSWORD` para o final 03. O setup preserva um arquivo existente.

Confira o banco de destino e execute **uma** das opções abaixo, conforme o ambiente. A rotação exige as três contas já provisionadas e troca as senhas em uma única transação. Entregue cada nova senha apenas ao responsável pela conta e retire a variável legada após a troca. Faça isso antes de habilitar o login HTTP nesse ambiente.

- Execução local: `npm run db:rotate-demo-passwords -w @mycity/api`.
- Compose local: `docker compose --profile tools run --rm --build seed npm run db:rotate-demo-passwords -w @mycity/api`.
- Compose de implantação, a partir do diretório da release com a imagem atualizada e o ambiente carregado: `docker compose --env-file /opt/mycity/.env --env-file /opt/mycity/current/images.env -f /opt/mycity/current/compose.deploy.yaml --profile tools run --rm seed npm run db:rotate-demo-passwords -w @mycity/api`.

Para atualizar a demonstração hospedada que ainda usa as contas legadas, prepare as três novas senhas no ambiente protegido e execute `touch /opt/mycity/.rotate-before-activation` antes do merge. Durante o deploy, após baixar as imagens, o script fecha o acesso à API, aplica as migrações e executa a rotação. O marcador recebe o sufixo `.done` após o sucesso, antes de a API voltar ao ar. Uma falha durante a rotação mantém o acesso fechado e o pedido pendente. Corrija a causa e repita a implantação com as mesmas senhas.

Para uma instalação vazia, use o seed normal. Se faltar uma conta em uma instalação anterior, o seed cria a conta ausente e preserva as demais. Depois execute a rotação para substituir as credenciais antigas.

## Configuração do Android

Para usar um endereço explícito no app, defina `EXPO_PUBLIC_API_URL` terminando em `/api/v1`. No emulador, `10.0.2.2` aponta para a máquina de desenvolvimento. Para usar o mapa em um build, restrinja `GOOGLE_MAPS_ANDROID_API_KEY` ao pacote `br.edu.mycity.app` e ao SHA-1 do certificado da variante.

### Testar com a API local

Inicie a API no computador conforme o [início rápido](../README.md#executar-localmente). Em outro terminal, execute `npm run dev:mobile` para iniciar o Metro. Com o SDK Android e um dispositivo ou emulador disponíveis, use `npm run android -w @mycity/mobile -- --no-bundler` para compilar e instalar a variante de desenvolvimento com esse Metro. O app usa a porta da API configurada em `PORT`, ou `EXPO_PUBLIC_API_PORT` quando definida. Reinicie o Metro ao mudar a configuração.

Para um aparelho físico, mantenha computador e celular na mesma rede confiável. Se precisar indicar a API manualmente, use o IP do computador na LAN em `EXPO_PUBLIC_API_URL`, com a porta e o sufixo `/api/v1`. Se o Swagger estiver habilitado com `API_DOCS_ENABLED=true` no ambiente de desenvolvimento, a API escuta só em loopback. Desabilite-o e reinicie a API para permitir teste pela LAN.

### Obter a chave do Google Maps

Quem distribui o APK configura o mapa para seu pacote e certificado. Use um projeto Google Cloud com faturamento habilitado e consulte os preços e quotas da sua conta. [Tabela de preços](https://developers.google.com/maps/billing-and-pricing/pricing) · [Guia de credenciais](https://developers.google.com/maps/documentation/android-sdk/get-api-key?hl=pt-br)

1. Entre no [Google Cloud Console](https://console.cloud.google.com/) com sua conta Google. No seletor do topo, crie ou selecione o projeto que administrará a chave. Vincule uma conta em [Faturamento](https://console.cloud.google.com/billing).
2. Abra o [Maps SDK for Android](https://console.cloud.google.com/apis/library/maps-android-backend.googleapis.com) no mesmo projeto e clique em **Ativar**. Ao ver **API ativada**, vá direto à página de credenciais.
3. Em [APIs e serviços → Credenciais](https://console.cloud.google.com/apis/credentials), escolha **Criar credenciais → Chave de API**. Abra a chave criada para editá-la.
4. Em **Restrições de aplicativo → Apps Android**, adicione o pacote `br.edu.mycity.app` e o SHA-1 do certificado que assinará seu APK. Em **Restrições da API**, escolha **Restringir chave → Maps SDK for Android** e salve.
5. Guarde a chave na variável `GOOGLE_MAPS_ANDROID_API_KEY` no `.env` privado da raiz. A configuração entra no APK durante o build. Ao alterar a chave, gere e instale um novo APK.

**Como obter o SHA-1.** Use o keystore de release que você controla. Na primeira distribuição, crie-o com `keytool -genkeypair -alias mycity-release -keyalg RSA -keysize 3072 -validity 10000 -storetype PKCS12 -keystore /caminho/privado/release.keystore` e guarde uma cópia recuperável. Para consultar a impressão digital, execute `keytool -list -v -alias mycity-release -keystore /caminho/privado/release.keystore` e informe a senha quando solicitado. Copie o campo **SHA1**. Após assinar, confira a mesma impressão digital no APK com `apksigner verify --print-certs`.

### Gerar o APK assinado localmente

Execute na raiz do checkout de desenvolvimento existente, com as [dependências do início rápido](../README.md#executar-localmente) instaladas. A CI usa JDK 21, SDK Android 37, build-tools 37.0.0, NDK 27.1.12297006 e CMake 3.22.1. Use o ADB para testar via USB. O prebuild carrega a chave de mapas do arquivo privado na raiz e gera ou atualiza `apps/mobile/android/`, que fica fora do Git. Para distribuir a revisão aprovada com a API da demonstração, use o APK da CI conforme a seção seguinte. [Workflow Android release](../.github/workflows/android-release.yml)

Defina `ANDROID_BUILD_TOOLS` como o diretório dos build-tools instalados, `RELEASE_KEYSTORE` como o caminho absoluto do keystore com alias `mycity-release`, `RELEASE_PASSWORD_FILE` como o arquivo privado com sua senha e `SIGNED_APK` como o caminho absoluto do APK final fora do Git. Guarde o keystore e uma cópia recuperável sob controle do responsável. O exemplo usa a API da demonstração. Para sua própria instalação, substitua o endereço por uma URL HTTPS acessível ao celular, terminada em `/api/v1`, e provisione as contas nessa instalação.

```bash
set -eu
umask 077
export EXPO_PUBLIC_API_URL=https://mycity.private-gateway.site:8080/api/v1
export NODE_ENV=production EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1
unset EXPO_PUBLIC_MY_CITY_PROTOTYPE
npm run build:contracts
cd apps/mobile
node --env-file=../../.env ../../node_modules/.bin/expo prebuild --platform android --no-install --no-clean --template ../../node_modules/expo/template.tgz
cd android
./gradlew :app:assembleRelease
"$ANDROID_BUILD_TOOLS/apksigner" sign --ks "$RELEASE_KEYSTORE" --ks-key-alias mycity-release --ks-pass "file:$RELEASE_PASSWORD_FILE" --out "$SIGNED_APK" app/build/outputs/apk/release/app-release.apk
"$ANDROID_BUILD_TOOLS/apksigner" verify --verbose --print-certs "$SIGNED_APK"
"$ANDROID_BUILD_TOOLS/zipalign" -c -P 16 4 "$SIGNED_APK"
"$ANDROID_BUILD_TOOLS/aapt" dump badging "$SIGNED_APK" | sed -n '1p'
sha256sum "$SIGNED_APK"
```

Confira o pacote `br.edu.mycity.app` e o SHA-1 do signatário contra a restrição do Maps. Instale o arquivo referenciado por `SIGNED_APK` no Android físico desbloqueado. Na raiz, execute `bash apps/mobile/tests/launch-release.sh` para verificar a abertura do app instalado e percorra a jornada com o Metro desligado. Guarde com o resultado o commit, o SHA-256 do APK e o modelo do aparelho.

### Baixar o APK da CI

No GitHub do projeto, abra **Actions → Android release** e escolha a execução do SHA desejado. Após a CI aprovar um push na `main`, o workflow gera o APK da revisão testada e o assina em um runner separado. Em **Artifacts**, baixe `mycity-android-<sha>-<tentativa>`, extraia os arquivos e rode `sha256sum --check mycity.apk.sha256` antes de instalar `mycity.apk`. O download de artefatos no GitHub exige login.

O environment `demonstration` permite a branch `main` e guarda `GOOGLE_MAPS_ANDROID_API_KEY`, `ANDROID_RELEASE_KEYSTORE_BASE64` e `ANDROID_RELEASE_STORE_PASSWORD`. O build recebe a chave restrita de Maps no prebuild. A etapa de assinatura lê o keystore PKCS12 com alias `mycity-release` e verifica o pacote e o SHA-256 do certificado. O APK de transferência é removido no fim da execução. Se precisar repetir após a limpeza, use **Re-run all jobs** para gerar um novo APK de transferência.

## Hospedar uma instância própria

Use um servidor Linux x86-64 com Docker, Docker Compose e Caddy no host. Aponte um domínio para o servidor, libere as portas TCP 80 e 443 para o Caddy e reserve a porta 8090 em loopback para o painel. O Caddy recebe HTTPS e encaminha painel e API ao Nginx do serviço `web`. O PostgreSQL e a API ficam na rede do Compose. A API confia nos dois proxies dessa topologia.

1. Obtenha o código no SHA de uma CI aprovada da `main`. Na mesma execução do GitHub Actions, baixe `digest-<tentativa>-api`, `digest-<tentativa>-tools` e `digest-<tentativa>-web`. Confira que os arquivos `*.digest` trazem o mesmo SHA, número da CI e tentativa. Guarde o último campo de cada arquivo, incluindo `sha256:`, nas chaves `API_DIGEST`, `TOOLS_DIGEST` e `WEB_DIGEST` de `images.env`. Para imagens com acesso restrito, autentique o Docker no GHCR com uma credencial de leitura antes do pull.
2. Em `~/.config/mycity/`, com acesso restrito ao operador, crie `images.env` e `runtime.env`. Use permissões `0600` para `runtime.env`. Preencha `WEB_ORIGIN` com a origem HTTPS exata do painel, sem barra final. Configure senhas aleatórias distintas em `POSTGRES_PASSWORD` e `API_DATABASE_PASSWORD` (duas saídas independentes de `openssl rand -hex 32` funcionam) e nas três variáveis `DEMO_CITIZEN_A_PASSWORD`, `DEMO_CITIZEN_B_PASSWORD` e `DEMO_MANAGER_PASSWORD`. O proprietário do banco é usado para migração e provisionamento. O backend usa o papel restrito `mycity_api`.
3. Crie `~/.config/mycity/compose.override.yaml` com o perfil abaixo. Ele reserva o `edge` e a rede da demonstração para ativações explícitas. A instalação própria usa o Caddy do host.

```yaml
services:
    edge:
        profiles: [demo]
    web:
        ports: !override
            - '127.0.0.1:${MYCITY_WEB_PORT:-8090}:80'
```

O override usa Compose 2.24.4 ou superior. A partir da raiz do checkout, em Bash, defina o atalho de operação e prepare a instalação. Mantenha o nome do projeto nas atualizações para usar os mesmos volumes.

```bash
mc() {
    docker compose -p "${MYCITY_COMPOSE_PROJECT:-mycity-selfhost}" \
        --env-file "${MYCITY_RUNTIME_ENV:-$HOME/.config/mycity/runtime.env}" \
        --env-file "$HOME/.config/mycity/images.env" \
        -f infra/compose.deploy.yaml \
        -f "$HOME/.config/mycity/compose.override.yaml" "$@"
}

mc config --quiet
mc --profile tools pull
mc up -d --wait db
mc --profile tools run --rm -T migrate
mc --profile tools run --rm -T provision
mc --profile tools run --rm -T seed
mc up -d --wait api web
curl --fail --silent --show-error http://127.0.0.1:8090/api/v1/health/ready
```

Execute o seed na instalação inicial para criar as três contas e denúncias fictícias. O app exige uma conta provisionada. Distribua cada senha por um canal privado.

No Caddy do host, configure o filtro no logger global e adicione o bloco do seu domínio. Se o arquivo já tiver um bloco global, incorpore o filtro ao logger padrão existente e preserve as demais opções. Se já houver um encoder, mantenha-o em `wrap` dentro do filtro. Substitua o domínio de exemplo no bloco e no comando de verificação. Valide a configuração e recarregue o serviço do Caddy.

```caddyfile
{
    log {
        format filter {
            wrap json
            fields {
                request>uri regexp "[?].*$" ""
                request>headers>Referer delete
            }
        }
    }
}

mycity.exemplo.org {
	reverse_proxy 127.0.0.1:8090
}
```

```bash
curl --fail --silent --show-error https://mycity.exemplo.org/api/v1/health/ready
```

Abra o painel por HTTPS, entre como gestor e abra uma denúncia com foto. Para distribuir o app dessa instalação, use a mesma origem com o sufixo `/api/v1` em `EXPO_PUBLIC_API_URL` e siga o [guia de geração do APK](#gerar-o-apk-assinado-localmente).

### Construir as imagens a partir do código

Se você estiver instalando de um fork ou sem acesso às imagens publicadas, use o mesmo Compose com imagens construídas a partir de um checkout limpo. Na raiz, use o SHA do checkout para identificar as três imagens.

```bash
mycity_tag=$(git rev-parse HEAD)
docker build --target runtime -f apps/api/Dockerfile -t "mycity-selfhost-api:$mycity_tag" .
docker build --target build -f apps/api/Dockerfile -t "mycity-selfhost-tools:$mycity_tag" .
docker build -f apps/web/Dockerfile -t "mycity-selfhost-web:$mycity_tag" .
printf 'MYCITY_IMAGE_TAG=%s\nAPI_DIGEST=local\nTOOLS_DIGEST=local\nWEB_DIGEST=local\n' "$mycity_tag" \
    > "$HOME/.config/mycity/images.env"
```

Acrescente estas entradas sob a chave `services` do override existente. Para `web`, adicione `image` ao lado de `ports` na mesma entrada. As variáveis de digest acima preenchem a interpolação do manifesto base. O Compose usa as imagens locais indicadas pelo override.

```yaml
api:
    image: mycity-selfhost-api:${MYCITY_IMAGE_TAG}
migrate:
    image: mycity-selfhost-tools:${MYCITY_IMAGE_TAG}
seed:
    image: mycity-selfhost-tools:${MYCITY_IMAGE_TAG}
web:
    image: mycity-selfhost-web:${MYCITY_IMAGE_TAG}
```

Siga a sequência de instalação a partir de `mc config --quiet`, pulando o pull. Guarde as três imagens usadas em cada backup, junto da revisão, para recuperar a mesma instalação.

### Atualizar a instância

1. Confirme a revisão nova e baixe ou construa as imagens antes da janela de manutenção pelo mesmo procedimento da instalação inicial. Guarde a revisão e os digests ou imagens atuais para recuperação.
2. Pause os escritores e faça o [backup consistente](#persistência-backup-e-recuperação). Mantenha a API parada.
3. Com o checkout e os digests novos, mantenha o projeto Compose, o `runtime.env` e os volumes. Execute `migrate` e `provision` na ordem da instalação inicial, então suba API e web.
4. Verifique readiness no endereço HTTPS, autenticação e leitura de foto. Se falhar após migrar, confira se a versão anterior é compatível com o schema antes de reativá-la. Se precisar desfazer a migração, recupere banco e fotos juntos com a revisão que gerou o backup.

## Publicação no servidor

Este roteiro se aplica à demonstração do projeto. Para outra infraestrutura, siga o [guia de instalação própria](#hospedar-uma-instância-própria).

1. Conferir o alvo e preservar aplicações/proxy já existentes.
2. Preparar configuração e volumes para banco e imagens, mantendo a porta do banco na rede privada. No arquivo protegido de ambiente do servidor, manter `POSTGRES_PASSWORD` para administração e definir `API_DATABASE_PASSWORD` com valor aleatório exclusivo, como 32 bytes gerados em hexadecimal. São aceitos letras, dígitos, sublinhado e hífen. Reservar o nome de papel `mycity_api` para o serviço.
3. Atualizar o secret `EC2_RUNTIME_ENV` a partir do arquivo local privado conforme [CI/CD](ci-cd.md#configuração-protegida). No push aprovado da main, o deploy valida a lista de variáveis e a sequência da release, preserva as configurações locais restantes e substitui atomicamente o ambiente sob o lock. A senha proprietária deve coincidir com a do volume existente. Cada deploy reconcilia as senhas das contas provisionadas habilitadas; mudar a senha de uma conta revoga suas sessões. Configuração idêntica preserva as sessões. Construir imagens e configurar proxy/HTTPS para web e API.
4. Fazer backup do banco e das fotos se já existirem dados. O deploy aplica as migrações com o proprietário e executa `provision` em seguida. Tanto no primeiro deploy quanto em volume existente, esse serviço configura a senha e concede ao papel `mycity_api` as operações necessárias nas tabelas do aplicativo. Ao mudar o schema, revisar as concessões em `infra/provision-api.sql`. Para rotacionar a senha da API, atualizar o segredo no destino e reaplicar a release em janela de manutenção.
5. Executar seed idempotente apenas para preparar os dados necessários.
6. Iniciar serviços, conferir liveness/readiness e logs sem segredos.
7. Testar login, upload, leitura das fotos e transição de status pelo domínio público.
8. Gerar APK com essa URL; instalar em Android físico e repetir o fluxo fora da rede do servidor quando possível.

Compose sobe web/API/banco; não instala o aplicativo no celular. APK final não deve depender do bundler, IP de desenvolvimento ou nomes internos como `api`/`postgres`.

## Roteiro da apresentação

| Passo | Ação                                                | Evidência esperada                                         |
| ----- | --------------------------------------------------- | ---------------------------------------------------------- |
| 1     | Entrar como cidadão A                               | Identidade correta e nenhuma tela de cadastro.             |
| 2     | Criar denúncia com categoria, descrição e 1–3 fotos | Prévia, compressão e envio reais.                          |
| 3     | Capturar GPS ou selecionar ponto manual             | Coordenadas reais do ponto confirmado.                     |
| 4     | Abrir painel do gestor                              | Nova denúncia aparece por polling com fotos e localização. |
| 5     | Entrar como cidadão B e confirmar                   | Uma confirmação; repetição não aumenta contador.           |
| 6     | Gestor avança para Em análise e responde            | Histórico e resposta consultáveis.                         |
| 7     | Gestor avança Em andamento → Resolvido              | Sem salto; autor recebe avisos e vê estado final.          |
| 8     | Consultar e ler notificações como A                 | Leitura persiste e avisos não aparecem para B.             |
| 9     | Usar outra denúncia para cancelar                   | Some do feed/mapa e permanece para o autor.                |
| 10    | Usar outra denúncia para rejeitar                   | Exige justificativa em Em análise.                         |
| 11    | Abrir alertas climáticos                            | Três níveis claramente simulados, sem afirmar envio real.  |

Para demonstrar a correção, use **Voltar para análise** após iniciar um atendimento. O gestor só pode desfazer o último avanço. Em uma encerrada, **Reabrir solicitação** retorna a Em análise e mantém o encerramento no histórico. Preparar fotos apropriadas sem expor terceiros.

### Descartar os dados da homologação

1. Prepare um inventário privado. Durante o ensaio, anote os IDs dos registros fictícios criados exclusivamente para ele e os anexos correspondentes. Use fotos sem pessoas identificáveis. Se a rotina de backup do ambiente puder capturar esses dados, execute o ensaio em um projeto Compose isolado com banco e uploads próprios, fora dessa rotina.
2. Após o aceite, o operador remove os registros e anexos fictícios do inventário sem criar ou guardar backup deles. Em ambiente compartilhado, confirme o alvo e a lista com o responsável antes de remover. Preserve as contas e denúncias permanentes do seed, os dados preexistentes e os backups operacionais da instalação.
3. Confira no destino que os registros e anexos do ensaio foram removidos e que os dados preexistentes continuam acessíveis. Guarde apenas as evidências sanitizadas de execução e aceite.

## Persistência, backup e recuperação

Os volumes `database` e `photos` guardam o PostgreSQL e os arquivos de upload. Reutilize os dois ao recriar os serviços. Os exemplos usam o atalho `mc` da [instalação própria](#hospedar-uma-instância-própria). Na demonstração, use os parâmetros Compose da [release ativa](ci-cd.md#operação).

### Fazer um backup

Reserve uma janela de manutenção. Pare a API e pause qualquer outro escritor, incluindo deploy, seed e tarefas de manutenção. O banco deve continuar disponível. Escolha um diretório privado e novo fora do checkout e defina seu caminho absoluto em `MYCITY_BACKUP_DIR`. Execute a sequência em Bash com `set -e` para parar em caso de erro.

```bash
umask 077
mkdir -- "$MYCITY_BACKUP_DIR"
mc stop api
mc exec -T db pg_dump -U mycity -d mycity -Fc > "$MYCITY_BACKUP_DIR/database.dump"
mc --profile tools run --rm --no-deps -T --entrypoint tar seed \
    -C /app/uploads -cf - . > "$MYCITY_BACKUP_DIR/photos.tar"
(
    cd "$MYCITY_BACKUP_DIR"
    sha256sum database.dump photos.tar > SHA256SUMS
)
```

Guarde os arquivos juntos, com acesso restrito, e registre a revisão e os digests ou imagens correspondentes. Se a operação era só o backup, reative a API com `mc up -d --wait api web` após a cópia e confira a saúde. Para atualização, prossiga com a API parada.

### Validar a restauração

Use a revisão e as imagens do backup. Em um ambiente isolado e sem acesso público, aponte `MYCITY_RUNTIME_ENV` para um arquivo privado de recuperação com novas senhas de banco e `WEB_ORIGIN=http://localhost:18090`. Use um nome de projeto Compose ainda inexistente e uma porta livre, como no exemplo. As senhas das contas existentes vêm do banco restaurado. Execute a sequência em Bash com `set -e`.

```bash
export MYCITY_COMPOSE_PROJECT=mycity-restore
export MYCITY_WEB_PORT=18090
export MYCITY_RUNTIME_ENV="$HOME/.config/mycity/restore.env"

(cd "$MYCITY_BACKUP_DIR" && sha256sum --check SHA256SUMS)
mc up -d --wait db
mc exec -T db psql -U mycity -d mycity -v ON_ERROR_STOP=1 \
    -c 'CREATE ROLE mycity_api NOLOGIN;'
mc exec -T db pg_restore --exit-on-error -U mycity -d mycity < "$MYCITY_BACKUP_DIR/database.dump"
mc --profile tools run --rm --no-deps -T --entrypoint tar seed \
    --no-same-owner -C /app/uploads -xf - < "$MYCITY_BACKUP_DIR/photos.tar"
mc --profile tools run --rm -T provision
mc up -d --wait api web
curl --fail --silent --show-error http://localhost:18090/api/v1/health/ready
```

Abra `http://localhost:18090`, entre com a conta do gestor do backup e confira uma denúncia conhecida, seu histórico e a abertura de uma foto. Valide a recuperação antes de encaminhar tráfego real para a instância. Ao terminar o ensaio, pare os serviços da restauração e encerre a sessão Bash ou limpe as três variáveis `MYCITY_*` da restauração antes de voltar a operar a instância original.

## Diagnóstico operacional

| Sintoma                  | Verificação inicial                                                      |
| ------------------------ | ------------------------------------------------------------------------ |
| App não conecta          | URL incluída no APK, DNS, certificado, conectividade e readiness da API. |
| Login falha só na web    | Origem, cookie, proxy/HTTPS e proteção CSRF; nunca registrar senha.      |
| Foto rejeitada           | Quantidade, conteúdo, dimensões, limite da API e limite do proxy.        |
| Foto some após recriação | Montagem do volume e correspondência com metadados.                      |
| Status não atualiza      | Tela ativa, sessão válida, polling e eventual conflito de versão.        |
| Mapa não aparece         | Provedor, chave/configuração de build, rede e erros do mapa.             |

## Reconciliação offline das fotos

Uma interrupção entre a escrita das fotos e a confirmação da denúncia pode deixar um diretório privado no volume. Para inventariar resíduos, faça backup consistente de banco e fotos, interrompa a API em uma janela de manutenção e mantenha o PostgreSQL disponível. Confira que `DATABASE_URL` e o volume montado pertencem à mesma instalação. O serviço de ferramentas `migrate` acessa o mesmo banco do backend com a credencial de migração na hospedagem. Substitua o nome do volume abaixo pelo nome verificado na instalação. Na hospedagem, acrescente `--env-file /opt/mycity/.env --env-file /opt/mycity/current/images.env -f /opt/mycity/current/compose.deploy.yaml` a cada invocação de `docker compose` deste procedimento.

```bash
docker compose stop api
docker compose --profile tools run --rm -v mycity_photos:/app/uploads -e UPLOAD_DIR=/app/uploads migrate npm exec -w @mycity/api -- tsx prisma/reconcile-report-files.ts
```

O inventário lista diretórios com nomes gerados pelo servidor, modificados há pelo menos 24 horas, que contêm somente nomes de fotos esperados e cujo ID está ausente do banco. Após conferir o inventário e o backup, remova individualmente cada ID autorizado acrescentando `--remove ID` ao comando de inventário. A ferramenta verifica novamente o banco e o volume antes de remover. Repita o inventário, reinicie a API com `docker compose up -d --wait api` e confira a leitura de fotos pelo painel.
