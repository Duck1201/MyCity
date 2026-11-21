# Operação e roteiro de demonstração

Para executar o MyCity no seu computador, siga o [README](../README.md#executar-localmente). Este guia cobre os ajustes do [ambiente local](#ambiente-local), os roteiros de demonstração e o [Android](#configuração-do-android). Publicação, backup e recuperação estão em [deploy.md](deploy.md).

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

Para liberar a porta do painel antes de voltar ao Vite, use `docker compose stop web api`. Para publicar em HTTPS, siga o [guia de publicação](deploy.md#preparar-um-servidor).

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
- Servidor: veja [o `.env.production`](deploy.md#o-envproduction).

Para uma instalação vazia, use o seed normal. Se faltar uma conta em uma instalação anterior, o seed cria a conta ausente e preserva as demais. Depois execute a rotação para substituir as credenciais antigas.

## Prévia do cidadão no navegador

Com a API e o painel iniciados por `npm run dev`, rode `npm run dev:mobile:web` em outro terminal e abra <http://localhost:8093>. Entre com uma conta de cidadão do banco de desenvolvimento. A prévia encaminha as chamadas para a mesma API local do painel e mantém a sessão do cidadão em memória. Recarregar a página exige novo login.

A galeria usa o seletor de arquivos do navegador, e o GPS depende da permissão de localização dele. Para testar um endereço específico, escolha o ponto no mapa. A prévia usa uma base local de ruas do centro de Viçosa e consulta os marcadores da API para a área visível. A validação de Google Maps, câmera nativa, armazenamento offline e permissões do sistema continua no Android.

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

Execute na raiz do checkout de desenvolvimento existente, com as [dependências do início rápido](../README.md#executar-localmente) instaladas. A CI usa JDK 21, SDK Android 37, build-tools 37.0.0, NDK 27.1.12297006 e CMake 3.22.1. Use o ADB para testar via USB. O prebuild carrega a chave de mapas do arquivo privado na raiz e gera ou atualiza `apps/mobile/android/`, que fica fora do Git. Para distribuir uma versão com a API da demonstração, use o APK publicado no GitHub Release, conforme a seção seguinte. [Workflow de release](../.github/workflows/release.yml)

Defina `ANDROID_BUILD_TOOLS` como o diretório dos build-tools instalados, `RELEASE_KEYSTORE` como o caminho absoluto do keystore com alias `mycity-release`, `RELEASE_PASSWORD_FILE` como o arquivo privado com sua senha e `SIGNED_APK` como o caminho absoluto do APK final fora do Git. Guarde o keystore e uma cópia recuperável sob controle do responsável. O exemplo usa a API da demonstração. Para sua própria instalação, substitua o endereço por uma URL HTTPS acessível ao celular, terminada em `/api/v1`, e provisione as contas nessa instalação.

```bash
set -eu
umask 077
export EXPO_PUBLIC_API_URL=https://mycity.private-gateway.site:8080/api/v1
export NODE_ENV=production EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1
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

### Baixar o APK publicado

Cada versão publicada por tag traz `mycity.apk` e `mycity.apk.sha256` na página **Releases** do GitHub. Baixe os dois e rode `sha256sum --check mycity.apk.sha256` antes de instalar. O [fluxo de entrega](deploy.md#fluxo-de-entrega) explica como o APK é gerado e assinado.

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
