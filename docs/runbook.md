# Operação e roteiro de demonstração

Para configurar o `.env`, preparar o banco e iniciar os serviços, siga o [README](../README.md#executar-localmente). Para publicar uma versão, consulte [CI/CD](ci-cd.md).

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

### Obter a chave do Google Maps

Quem distribui o APK configura o mapa para seu pacote e certificado. O Google exige um projeto com faturamento habilitado. A tabela do Google lista uso gratuito ilimitado para o Maps SDK básico utilizado pelo app. Outros serviços têm tarifas próprias. Consulte a [tabela de preços](https://developers.google.com/maps/billing-and-pricing/pricing) e o [guia de credenciais](https://developers.google.com/maps/documentation/android-sdk/get-api-key?hl=pt-br).

1. Entre no [Google Cloud Console](https://console.cloud.google.com/) com sua conta Google. No seletor do topo, crie ou selecione o projeto que administrará a chave. Vincule uma conta em [Faturamento](https://console.cloud.google.com/billing).
2. Abra o [Maps SDK for Android](https://console.cloud.google.com/apis/library/maps-android-backend.googleapis.com) no mesmo projeto e clique em **Ativar**. Ao ver **API ativada**, vá direto à página de credenciais.
3. Em [APIs e serviços → Credenciais](https://console.cloud.google.com/apis/credentials), escolha **Criar credenciais → Chave de API**. Abra a chave criada para editá-la.
4. Em **Restrições de aplicativo → Apps Android**, adicione o pacote `br.edu.mycity.app` e o SHA-1 do certificado que assinará seu APK. Em **Restrições da API**, escolha **Restringir chave → Maps SDK for Android** e salve.
5. Guarde a chave na variável `GOOGLE_MAPS_ANDROID_API_KEY` no `.env` privado da raiz. A configuração entra no APK durante o build. Ao alterar a chave, gere e instale um novo APK.

**Como obter o SHA-1.** Use o keystore de release que você controla. Na primeira distribuição, crie-o com `keytool -genkeypair -alias mycity-release -keyalg RSA -keysize 3072 -validity 10000 -storetype PKCS12 -keystore /caminho/privado/release.keystore` e guarde uma cópia recuperável. Para consultar a impressão digital, execute `keytool -list -v -alias mycity-release -keystore /caminho/privado/release.keystore` e informe a senha quando solicitado. Copie o campo **SHA1**. Após assinar, confira a mesma impressão digital no APK com `apksigner verify --print-certs`.

### Gerar o APK assinado localmente

Em uma cópia de build da revisão aprovada com as dependências do lockfile instaladas, use Node 24 e npm 11 e configure um JDK compatível com o Gradle, o SDK Android (compile SDK 37), os build-tools e o ADB para testar via USB. O prebuild abaixo carrega a chave de mapas do arquivo privado na raiz. Defina `ANDROID_BUILD_TOOLS` como o diretório dos build-tools instalados, `RELEASE_KEYSTORE` como o caminho absoluto do keystore com alias `mycity-release`, `RELEASE_PASSWORD_FILE` como o arquivo privado com sua senha e `SIGNED_APK` como o caminho absoluto do APK final fora do Git. Guarde o keystore e uma cópia recuperável sob controle do responsável. O exemplo usa a API da demonstração. Para sua própria instalação, substitua o endereço por uma URL HTTPS acessível ao celular, terminada em `/api/v1`, e provisione as contas nessa instalação.

```bash
set -eu
umask 077
export EXPO_PUBLIC_API_URL=https://mycity.private-gateway.site:8080/api/v1
export NODE_ENV=production EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1
unset EXPO_PUBLIC_MY_CITY_PROTOTYPE
npm run build:contracts
cd apps/mobile
node --env-file=../../.env ../../node_modules/.bin/expo prebuild --platform android --no-install --template ../../node_modules/expo/template.tgz
cd android
./gradlew :app:assembleRelease
"$ANDROID_BUILD_TOOLS/apksigner" sign --ks "$RELEASE_KEYSTORE" --ks-key-alias mycity-release --ks-pass "file:$RELEASE_PASSWORD_FILE" --out "$SIGNED_APK" app/build/outputs/apk/release/app-release.apk
"$ANDROID_BUILD_TOOLS/apksigner" verify --verbose --print-certs "$SIGNED_APK"
"$ANDROID_BUILD_TOOLS/aapt" dump badging "$SIGNED_APK" | sed -n '1p'
sha256sum "$SIGNED_APK"
```

Confira o pacote `br.edu.mycity.app` e o SHA-1 do signatário contra a restrição do Maps. Instale o arquivo referenciado por `SIGNED_APK` no Android físico desbloqueado. Na raiz, execute `bash apps/mobile/tests/launch-release.sh` para verificar a abertura do app instalado e percorra a jornada com o Metro desligado. Guarde com o resultado o commit, o SHA-256 do APK e o modelo do aparelho.

## Publicação no servidor

1. Conferir o alvo e preservar aplicações/proxy já existentes.
2. Preparar configuração e volumes para banco e imagens, mantendo a porta do banco na rede privada. No arquivo protegido de ambiente do servidor, manter `POSTGRES_PASSWORD` para administração e definir `API_DATABASE_PASSWORD` com valor aleatório exclusivo, como 32 bytes gerados em hexadecimal. São aceitos letras, dígitos, sublinhado e hífen. Reservar o nome de papel `mycity_api` para o serviço.
3. Construir imagens e configurar proxy/HTTPS para web e API.
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

## Persistência, backup e recuperação

- Reiniciar ou recriar containers com os mesmos volumes deve preservar banco/fotos; validar isso antes da apresentação.
- Nunca remover volumes como rotina de atualização. Não incluir reset ou seed destrutivo no startup.
- Backup precisa de banco e volume de fotos em um ponto consistente. Para o MVP, pode ser feito com escritas pausadas durante a captura; registrar o procedimento real após implementação.
- Testar restauração em ambiente separado. Em cluster novo, criar o papel `mycity_api` com `NOLOGIN` antes de importar o dump com as concessões de acesso. Antes de voltar a servir a API, executar o provisionamento da release para configurar o login restrito. Presença de arquivos de backup não comprova recuperação.
- Em falha de deploy, preservar logs e volumes; voltar à versão anterior somente se compatível com as migrações. Não prometer downgrade automático.
- Limpeza de staging/órfãos deve respeitar uploads em andamento. Guardar evidência do comportamento em T25.

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
