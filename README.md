# MyCity

O MyCity ajuda cidadãos a registrar problemas urbanos com fotos e localização. Quem registra acompanha o atendimento pelo app Android. No painel web, a equipe de gestão organiza a fila, responde aos relatos e atualiza a situação de cada denúncia.

[Executar localmente](#executar-localmente) · [Usar no Android](#usar-o-app-android) · [Hospedar e manter](docs/runbook.md#hospedar-uma-instância-própria) · [Contribuir](#contribuir)

## Veja como funciona

### Painel do gestor

Em **Atendimento**, o gestor encontra os relatos, filtra por categoria e situação e abre cada ocorrência para consultar fotos, localização e histórico. A captura mostra as denúncias fictícias carregadas pelo seed no banco local.

![Fila de atendimento do gestor com denúncias, filtros e situações](docs/images/manager-dashboard.png)

### App do cidadão

Em **Início**, o cidadão acompanha os próprios registros e pode abrir uma nova denúncia. No **Feed**, consulta ocorrências da cidade e pode confirmar que viu o mesmo problema.

<p align="center">
  <img src="docs/images/citizen-app.png" width="280" alt="Tela Início, com resumo da cidade e registros do cidadão">
  <img src="docs/images/citizen-feed.png" width="280" alt="Tela Feed, com ocorrências ativas e seus estados">
</p>

No Android, o app e o painel compartilham a API e o PostgreSQL. Os alertas climáticos são simulados.

## Executar localmente

Você precisa de **Git, Node.js 24.11 ou superior na linha 24, npm 11 e Docker com Compose**. Use um terminal em Linux, macOS ou WSL com acesso ao Docker. A versão de Node usada na CI está em [`.nvmrc`](.nvmrc). Se já tem o checkout, comece em `npm ci` na raiz.

```bash
git clone https://github.com/Duck1201/MyCity.git
cd MyCity
npm ci
npm run setup
```

O setup gera o cliente Prisma, compila os contratos e cria um `.env` com senhas locais aleatórias. Se o arquivo já existe, ele é preservado. Confira se `DATABASE_URL` aponta para o banco de desenvolvimento que você pretende usar antes de migrar e semear.

```bash
docker compose up -d --wait db
npm run db:migrate
npm run db:seed
npm run dev
```

Abra **<http://localhost:8090>** e entre como gestor com o CPF **`00000000003`** e a senha de `DEMO_MANAGER_PASSWORD` no seu `.env`. O seed prepara também os cidadãos `00000000001` e `00000000002`, com senhas em `DEMO_CITIZEN_A_PASSWORD` e `DEMO_CITIZEN_B_PASSWORD`. São contas fictícias provisionadas na instalação.

Abra **Atendimento** para explorar os exemplos. A API atende em **<http://localhost:3000/api/v1/health/ready>** para a verificação de saúde. Ctrl+C encerra o painel e a API.

Para mudar portas, configurar a API do celular ou executar a versão compilada em containers, consulte o [guia de ambiente local](docs/runbook.md#ambiente-local).

## Usar o app Android

Instale um APK configurado para a API que você pretende usar, em um dispositivo com Android 7.0 (API 24) ou superior. Entre com a conta de cidadão fornecida pelo responsável pela instalação. Autorize a câmera e a localização quando usar esses recursos.

O guia de Android explica como testar com o ambiente local, baixar o artefato da CI e gerar um APK assinado com a URL da sua API e a configuração do mapa. [Configuração do Android](docs/runbook.md#configuração-do-android)

## Guias

| Quero…                                      | Onde começar                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Explorar a demonstração hospedada           | [Painel da demonstração](https://mycity.private-gateway.site:8080), com conta de gestor fornecida pelo responsável |
| Registrar ou atender uma denúncia           | [Primeiros passos por perfil](docs/flows.md#primeiros-passos)                                                      |
| Instalar e operar minha própria instância   | [Hospedagem própria](docs/runbook.md#hospedar-uma-instância-própria)                                               |
| Atualizar uma instalação ou recuperar dados | [Operação e recuperação](docs/runbook.md#persistência-backup-e-recuperação)                                        |
| Integrar ou entender o código               | [Contrato HTTP](docs/api/contract.md) e [arquitetura](docs/architecture.md)                                        |
| Entender o recorte do MVP                   | [Escopo](docs/scope.md) e [decisões pendentes](concerns.md)                                                        |

## Contribuir

Em um fork, crie uma branch curta e abra um PR para `main`. Use Conventional Commits nos commits e no título do PR. O [AGENTS.md](AGENTS.md) indica onde ficam as regras, o código e os testes de cada área. As [regras de colaboração](docs/ci-cd.md#colaboração) detalham o fluxo do GitHub.

Encontrou uma vulnerabilidade? Use o [canal privado de segurança](SECURITY.md).

### Testes e qualidade

Em uma instalação local já preparada, inicie o PostgreSQL de testes e rode as verificações:

```bash
docker compose --profile test up -d --wait test-db
npm run format:check
npm run check
```

O check valida OpenAPI, lint, tipos, testes e build. A integração automatizada usa o banco dedicado `mycity_test`. Consulte a [estratégia de testes](docs/testing.md) para os ensaios manuais, as verificações do Android e a atualização das capturas deste README.

## Licença

O código do MyCity usa [Apache 2.0](LICENSE). Autores, fontes e licenças das fotos fictícias estão nos [créditos das ocorrências](apps/api/prisma/report-images/credits.json) e nos [créditos das imagens do app](apps/mobile/src/assets/creditos.txt).
