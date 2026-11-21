# Contrato HTTP

Esta referência descreve a API implementada. O [OpenAPI gerado](../../apps/api/src/openapi.json) traz as rotas e os schemas das respostas de sucesso de denúncias, incluindo as paginações da fila e por cursor. Para executar a API localmente, siga o [início rápido](../../README.md#executar-localmente).

## Convenções

- Prefixo `/api/v1`. Use HTTPS no ambiente hospedado.
- JSON com campos camelCase; upload usa multipart. IDs opacos em string, timestamps ISO 8601 UTC, coordenadas numéricas.
- Resposta de entidade: `{ "data": ... }`. Listas: `{ "data": [...], "page": { "nextCursor": null } }`.
- Erros: `{ "error": { "code": "...", "message": "..." }, "requestId": "..." }`. `requestId` pode estar ausente, por exemplo em rotas inexistentes e erros das rotas de saúde. Mensagens em pt-BR e códigos em inglês.
- Na paginação por cursor, `limit` vai de 1 a 100 e o padrão é 20. Envie o `page.nextCursor` recebido mantendo os mesmos filtros e a mesma ordenação. Um cursor inválido para a consulta retorna 400 `INVALID_CURSOR`. Reinicie a paginação após mutações que alterem o conjunto ou a ordem dos resultados.
- Cache: leituras (`GET`) bem-sucedidas saem com `Cache-Control: private, no-cache` e `ETag`; repita a consulta com `If-None-Match` e receba `304` sem corpo quando nada mudou. Escritas e respostas de erro saem com `no-store`. Fotos usam `private, max-age=31536000, immutable`. O logout e um 401 para uma sessão apresentada que não vale mais incluem `Clear-Site-Data: "cache"`.
- Coleções de fotos e eventos retornam ordem explícita. Não depender da ordem natural do banco.
- Consulta de denúncias, fotos, mapa e histórico exige sessão, conforme decisão aprovada em C04. As operações de escrita também exigem autenticação. Credenciais, hashes e caminhos internos jamais aparecem nos DTOs.

## Sessão aprovada — C05

Sessões opacas revogáveis com validade de 24 horas a partir do login, sem renovação automática nesta entrega. Após expiração, exigir novo login; logout invalida imediatamente a sessão atual. Guardar apenas hash do segredo no servidor. Web usa cookie HttpOnly, Secure, SameSite=Lax; app usa Bearer com armazenamento seguro do sistema operacional. Não persistir segredo em armazenamento web acessível por JavaScript.

Web e API usam a mesma origem. Para login com `transport: "cookie"` e mutações com sessão por cookie, os cabeçalhos são `Origin` com a origem configurada e `X-MyCity-Client: web`. Para chamadas por Bearer, envie `Authorization: Bearer <token>`. Cada requisição usa um único transporte. O processo limita login a cinco falhas por origem de rede e CPF e 60 tentativas por origem em janela de 15 minutos. A origem IPv6 é agrupada por /64, com até quatro verificações simultâneas no processo. Uma recusa por limite responde 429 e `Retry-After`.

A instância da API mantém cotas independentes por origem de rede (IPv4 ou /64 IPv6) em janelas de um minuto. O login permite 30 requisições, inclusive com JSON inválido. Liveness permite 60 e readiness permite 30, antes da consulta ao banco. Quando habilitados, Swagger, seus assets e OpenAPI compartilham 120 requisições. Cada grupo admite 4.096 origens ativas. Ao esgotar a capacidade do grupo, novas origens aguardam a primeira expiração. O IP vem do Express conforme os proxies confiáveis configurados. O excesso retorna 429 com `TOO_MANY_REQUESTS` e `Retry-After` em segundos.

| Método e caminho           | Entrada                                       | Sucesso                                                            | Efeito                                                            |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| POST `/sessions`           | `{cpf,password,transport:"cookie"\|"bearer"}` | 201: usuário, expiresAt; token apenas para bearer; cookie para web | Cria sessão após validar credenciais. Transport não altera papel. |
| GET `/me`                  | Sessão                                        | 200: `{id,role}`                                                   | Consulta identidade mínima.                                       |
| DELETE `/sessions/current` | Sessão                                        | 204                                                                | Revoga sessão e limpa cookie quando aplicável.                    |

A consulta `GET /me` comunica a expiração original no cabeçalho `X-Session-Expires-At` (ISO 8601 UTC). O painel usa esse prazo para encerrar a exibição local após recarregar a página, inclusive se perder a conexão.

CPF e senha nunca entram em URL, logs ou dados públicos de denúncias. A autenticação é própria do MyCity e usa CPF normalizado em 11 dígitos e a senha da conta habilitada. Envie CPF como string para manter os zeros iniciais. A API aceita CPF completo pontuado ou sem separadores. O papel vem do banco. Sessão ausente, expirada ou revogada retorna 401. Sessão válida sem permissão retorna 403. O login exige conta provisionada.

Com o banco de desenvolvimento em loopback, reiniciar a API pelos comandos de desenvolvimento aplica alterações de senha das contas de demonstração habilitadas e revoga suas sessões. Sessões de contas sem alteração conservam a expiração original. Consulte o [guia de ambiente local](../runbook.md#ambiente-local) para outros destinos.

## Catálogo de categorias

| Operação                 | Quem pode usar | Contrato                                                                                                                                                                                                                                                                                                              |
| ------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/categories`        | Sessão válida  | 200, `{data:[{id,name,archived,icon?,reportCount?}]}`. Inclui as categorias iniciais e as cadastradas, inclusive arquivadas e sem ocorrências. `reportCount` aparece na consulta do gestor.                                                                                                                           |
| POST `/categories`       | Gestor         | Recebe `{name,icon?}` e retorna 201 com `{data:{id,name,archived,icon?}}`. Categorias novas começam ativas. O nome aceita de 1 a 80 caracteres após normalizar espaços e deve conter letra ou número. Nome equivalente sem distinção de caixa ou acentos retorna 409 `CATEGORY_EXISTS`. Entrada inválida retorna 422. |
| PATCH `/categories/{id}` | Gestor         | Recebe `{name,icon?}` com as regras do cadastro ou `{archived:boolean}`. Preserva o ID e retorna 200 com `{data:{id,name,archived,icon?}}`. Nome duplicado retorna 409, ID inexistente 404 e entrada inválida 422.                                                                                                    |

Escolha `icon` entre os [símbolos do contrato compartilhado](../../packages/contracts/src/index.ts). Se a edição omitir o ícone, o atual é preservado. O GET inclui o ícone quando definido e fornece `reportCount` somente ao gestor.

## Operações de denúncia

| Método e caminho                           | Ator                       | Entrada                                                    | Sucesso / efeito                                                                                                         |
| ------------------------------------------ | -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| POST `/reports`                            | Cidadão                    | Multipart descrito abaixo                                  | 201: ReportDetail; cria denúncia, fotos e evento inicial. Replay idempotente retorna 200 com o mesmo recurso.            |
| GET `/reports`                             | Autenticado                | scope, status, category, sort, limit, cursor               | 200: ReportSummary[]; visibilidade filtrada no servidor.                                                                 |
| GET `/reports/map`                         | Autenticado                | bbox?, status, category, limit, cursor                     | 200: ReportMarker[]; mesma política de visibilidade. Paginar até completar a área consultada.                            |
| GET `/reports/overview`                    | Gestor                     | Sem parâmetros                                             | 200: contagens por situação, categorias com totais pendentes, pendência mais antiga e até três prioridades.              |
| GET `/reports/queue`                       | Gestor                     | q?, category?, status?, de?, ate?, ordem?, pagina?, limit? | 200: data, total filtrado, counts por situação e page efetiva.                                                           |
| GET `/reports/queue.csv`                   | Gestor                     | mesmos filtros e ordenação, sem paginação                  | 200: CSV UTF-8 com todas as linhas correspondentes.                                                                      |
| GET `/reports/summary`                     | Gestor                     | category?                                                  | 200: objeto com os seis estados e suas contagens no universo filtrado por categoria, sem paginação.                      |
| GET `/reports/{id}`                        | Leitor autorizado          | ID                                                         | 200: ReportDetail, incluindo versão e ações permitidas.                                                                  |
| GET `/reports/{id}/history`                | Leitor autorizado          | limit, cursor, order                                       | 200: ReportEvent[] por createdAt e id, crescentes (oldest, padrão) ou decrescentes (newest).                             |
| GET `/reports/{id}/photos/{photoId}`       | Leitor autorizado          | IDs                                                        | 200 image/jpeg; sem caminho do disco no contrato. `Cache-Control: private, max-age=31536000, immutable`.                 |
| GET `/reports/{id}/photos/{photoId}/thumb` | Leitor autorizado          | IDs                                                        | 200 image/jpeg com maior lado até 320 px, mesma autorização e cache da original; sem miniatura gerada, serve a original. |
| PUT `/reports/{id}/confirmation`           | Cidadão diferente do autor | Sem corpo                                                  | 200: `{confirmed:true,confirmationCount}`; repetição não duplica.                                                        |
| DELETE `/reports/{id}/confirmation`        | Cidadão diferente do autor | Sem corpo                                                  | 200: `{confirmed:false,confirmationCount}`; ausência já retirada é sucesso enquanto a ação estiver permitida.            |
| POST `/reports/{id}/transitions`           | Gestor                     | `{targetStatus,expectedVersion,reason?}`                   | 200: ReportDetail; atualiza estado+histórico+notificação atomicamente.                                                   |
| POST `/reports/{id}/cancellation`          | Autor                      | `{expectedVersion}`                                        | 200: ReportDetail; cancela+registra histórico+notifica.                                                                  |
| POST `/reports/{id}/replies`               | Gestor                     | `{text,clientRequestId}`                                   | 201: ReportEvent; resposta pública sem mudança de estado. Replay igual retorna 200.                                      |

Em `GET /reports`, informe `scope`: `feed`, `mine`, `resolved` ou `management`. `mine` limita a consulta ao autor autenticado. `management` exige gestor e usa prioridade por padrão, com ativos antes dos encerrados. `sort=priority` só é aceito em `management`. `sort=newest` ordena a gestão por criação decrescente e é recusado em `resolved`, que usa a data de resolução e ID em ordem decrescente. O feed ativo usa criação decrescente. O feed com `status=RESOLVED` também ordena por data de resolução.

Uma publicação nova em categoria arquivada retorna 409 `CATEGORY_ARCHIVED`, inclusive se o arquivamento ocorrer durante o preenchimento. O reenvio idêntico de uma publicação já concluída retorna 200 com o registro existente. Reativar o grupo permite novas publicações. Publicação com `showIdentity: true` exige perfil provisionado, com erro 409 `PROFILE_UNAVAILABLE` caso ele falte.

A Visão geral lê os dados em uma única transação com snapshot consistente. `counts` contém as seis situações, incluindo zeros. `oldest` traz ID e data de criação da pendência mais antiga ou nulo. `categories` inclui ID, nome, ícone, arquivamento e contagem de pendências de cada grupo, inclusive os vazios. `priorities` contém as três primeiras pendências pela ordenação da fila, com ID, categoria, descrição, situação, contagem de confirmações e caminho autenticado da capa quando disponível.

Na fila, `q` aceita até 160 caracteres e localiza termos no protocolo, relato e coordenadas. `de` e `ate` são dias inclusivos em America/Sao_Paulo. `status=pending` reúne Enviado, Em análise e Em andamento. `ordem` aceita `prioridade` (padrão), `antigas` e `recentes`. A primeira página é 1 e cada página contém por padrão até 5 ocorrências (máximo 100). As contagens por situação aplicam a busca, categoria e período antes do filtro de situação. Uma página além do resultado retorna a última. O CSV usa os mesmos critérios e inclui protocolo, categoria, relato, latitude, longitude, situação, data e confirmações. O arquivo tem BOM UTF-8, campos separados por ponto e vírgula e proteção para textos que podem ser interpretados como fórmula.

Categorias vêm do catálogo persistido (incluindo grupos sem denúncias). Os seis identificadores originais continuam válidos. Uma categoria cadastrada pelo gestor recebe um UUID e pode ser usada imediatamente nos mesmos endpoints. Listas, detalhes e marcadores incluem `category` e `categoryName`. As respostas e justificativas têm limite de 2.000 caracteres após trim (C07). A resposta pública usa uma chave de repetição vinculada à denúncia e ao ator. Mesma chave com texto diferente retorna 409, sem criar outro evento.

Para o mapa, use `bbox=west,south,east,north`, com coordenadas válidas e west < east, south < north. O cruzamento do antimeridiano requer duas consultas, uma de cada lado. O app arredonda os limites da área para fora em intervalos de 0,01 grau antes de enviar a consulta. O app filtra os resultados pela área visível para exibir e contar os pontos. Se a área exigir várias páginas, não mostrar a primeira como se fosse o total. O filtro regional segue adiado.

### Criação multipart

- Campo de formulário `metadata`: texto JSON UTF-8 com `clientRequestId` (de 1 a 128 caracteres após trim), `category`, `description`, `location` e `showIdentity` (booleano obrigatório).
- De uma a três partes `photos`, em ordem de exibição, com conteúdo JPEG já comprimido.
- `location`: `{latitude,longitude,source:"GPS"|"MANUAL"}`. Campos fora desse formato são rejeitados. Endereço e classificação regional estão adiados.
- A identidade do autor vem da sessão e o status inicial é `SENT`. Campos extras em `metadata`, inclusive `authorId` e `status`, retornam 422.
- Unicidade de `(authorId,clientRequestId)`, com comparação do payload normalizado e conteúdo das fotos. Reenvio idêntico retorna o mesmo recurso; chave reutilizada com conteúdo diferente retorna 409 `IDEMPOTENCY_CONFLICT`.
- Limites aprovados da criação: 5 MiB por foto, 16 MiB por requisição incluindo multipart, descrição até 1.000 caracteres (C06/C07). O maior lado tem até 1.600 px. A API normaliza a orientação e remove metadados. Se faltar reserva de espaço para a gravação, retorna 507.
- Resposta somente após persistência confirmada. Falha não publica denúncia sem todas as fotos válidas. Arquivos órfãos não são servidos por URL.

Exemplo da parte `metadata` (coordenadas ilustrativas, não destino fixo do app):

```json
{
    "clientRequestId": "demo-create-001",
    "category": "POTHOLE",
    "description": "Buraco na via próximo à esquina.",
    "showIdentity": true,
    "location": { "latitude": -20.75, "longitude": -42.88, "source": "GPS" }
}
```

### Identificação opcional da denúncia — decisão aprovada

No formulário, “Quero mostrar minha cara” começa marcado (`showIdentity: true`). Marcado: leitores autorizados veem nome e foto de perfil. Desmarcado: veem “Anônimo”, sem nome, foto, CPF, e-mail, ID de usuário ou URL de perfil, inclusive no painel do gestor. `showIdentity` ausente é inválido; a API não presume consentimento a partir de campo omitido.

`authorId` permanece interno para propriedade, cancelamento e notificações. A anonimização deve ser aplicada pelo backend em todos os DTOs e eventos, não apenas escondida pela interface. Nome/foto do perfil serão fictícios e pré-provisionados junto das contas; não existe edição/cadastro público de perfil neste recorte. Alterar essa opção após publicar ainda precisa de decisão; não criar endpoint de alteração automaticamente.

### DTOs

| DTO                | Campos públicos                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ReportSummary      | id, category, categoryName, description, status, location, createdAt, updatedAt, confirmationCount, confirmedByMe, isMine, coverPhoto?, showIdentity, author? |
| ReportDetail       | Campos do resumo + version, photos[], allowedActions[]; histórico paginado em rota própria                                                                    |
| Photo              | id, position, width, height, byteSize, contentPath, thumbnailPath; nenhum storageKey                                                                          |
| ReportMarker       | id, latitude, longitude, category, categoryName, status, confirmationCount                                                                                    |
| ReportEvent        | id, type, actorRole, fromStatus?, toStatus?, text?, createdAt. `actorRole` indica o papel, sem dados de perfil.                                               |
| ReportNotification | id, reportId, reportEventId, type, status, fromStatus?, createdAt, readAt. `readAt` é nulo até a primeira leitura.                                            |
| WeatherAlert       | id, level, title, message, regionLabel, issuedAt, expiresAt, simulated:true                                                                                   |

`allowedActions` ajuda a interface; não concede autorização. Uma ação pode tornar-se inválida entre leitura e escrita. IDs de fotos sempre precisam pertencer à denúncia informada.

### Transições e conflitos

Rejeição usa `targetStatus: "REJECTED"` e `reason` obrigatório. Transição Enviado → Resolvido retorna 409 `INVALID_TRANSITION`; versão defasada retorna 409 `VERSION_CONFLICT`. Em qualquer conflito, nenhuma parte da operação é persistida.

Exemplo de requisição após leitura da versão 1 em SENT:

```json
{ "targetStatus": "UNDER_REVIEW", "expectedVersion": 1 }
```

Após sucesso, versão 2 e histórico/notificação correspondentes devem ser observáveis. Se a resposta se perder, o cliente consulta a denúncia e o histórico. Repetir a versão antiga não cria um novo evento.

O gestor pode corrigir `UNDER_REVIEW → SENT` ou `IN_PROGRESS → UNDER_REVIEW` apenas quando desfaz exatamente o último avanço registrado. Respostas intermediárias não alteram essa decisão. Sem avanço comprovado, após um recuo ou após uma reabertura, a ação inversa não é oferecida e uma tentativa de gravação retorna 409. Reabrir `RESOLVED`, `REJECTED` ou `CANCELED` define `targetStatus: "UNDER_REVIEW"`. A operação usa `expectedVersion`, conserva o histórico e gera aviso ao autor. A denúncia volta às consultas e permissões de Em análise, inclusive confirmação por outros cidadãos.

C08: o gestor pode publicar respostas em qualquer estado. Responder após encerramento preserva o status final e acrescenta um evento ao histórico. O limite é de 2.000 caracteres após trim, inclusive para a justificativa de rejeição. Confirmações só podem ser adicionadas ou retiradas em Enviado, Em análise ou Em andamento. Ao encerrar, o total fica congelado. As respostas da gestão continuam permitidas.

## Notificações e alertas

| Método e caminho               | Ator                 | Entrada                    | Saída                                                                         |
| ------------------------------ | -------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| GET `/notifications`           | Cidadão              | unreadOnly?, limit, cursor | 200: avisos somente do destinatário autenticado, mais recentes primeiro.      |
| PUT `/notifications/{id}/read` | Cidadão destinatário | Sem corpo                  | 200: ReportNotification; marcar novamente preserva a data inicial de leitura. |
| GET `/weather-alerts`          | Autenticado          | limit, cursor              | 200: alertas fictícios com simulated:true.                                    |
| GET `/weather-alerts/{id}`     | Autenticado          | ID                         | 200: detalhes do cenário simulado.                                            |

O catálogo da demonstração usa como referência 25 de novembro de 2026 às 12h de Brasília. Cada cenário tem uma janela ilustrativa nessa data. A lista apresenta Emergência (alagamento), Alerta (vento forte) e Atenção (chuva moderada), nessa ordem, com áreas fictícias. As duas rotas exigem sessão e retornam `simulated: true` em cada item. O app identifica a simulação na lista e nos detalhes. As datas se referem ao cenário, independentemente do relógio do aparelho. O catálogo é somente leitura, compartilhado entre contas, sem consulta meteorológica, localização do leitor ou criação de notificação.

Não existe rota de envio real de alerta nem cadastro de Defesa Civil. Não há endpoint de avaliação ou exclusão física de denúncia. A reabertura usa a rota de transições existente.

## Erros e repetição

| HTTP    | Código representativo                                        | Comportamento do cliente                                                                           |
| ------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 400     | INVALID_REQUEST / INVALID_CURSOR                             | Corrigir formato ou parâmetros. Se o cursor deixou de pertencer à consulta, reiniciar a paginação. |
| 401     | UNAUTHENTICATED                                              | Encerrar estado de sessão e solicitar login.                                                       |
| 403     | FORBIDDEN                                                    | Informar ação não permitida; não mudar estado local como sucesso.                                  |
| 404     | NOT_FOUND                                                    | Recurso ausente ou oculto ao solicitante; evitar revelar existência privada.                       |
| 409     | INVALID_TRANSITION / VERSION_CONFLICT / IDEMPOTENCY_CONFLICT | Consultar estado ou corrigir intenção; não repetir cegamente.                                      |
| 413     | PAYLOAD_TOO_LARGE                                            | Reduzir anexos; preservar formulário.                                                              |
| 415     | UNSUPPORTED_MEDIA_TYPE                                       | Selecionar/converter imagem válida.                                                                |
| 422     | VALIDATION_ERROR                                             | Apresentar campos inválidos; nenhuma gravação parcial.                                             |
| 429     | TOO_MANY_REQUESTS                                            | Respeitar Retry-After, em segundos.                                                                |
| 500/503 | INTERNAL_ERROR / UNAVAILABLE                                 | Informar falha sem detalhes internos; repetir leitura ou operação idempotente de forma controlada. |
| 507     | INSUFFICIENT_STORAGE                                         | Preservar o formulário e informar a indisponibilidade de espaço no servidor.                       |

```json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Confira a ação, a versão e a justificativa."
    },
    "requestId": "demo-request-002"
}
```

## Rotas operacionais implementadas

- `GET /api/v1/health/live`: 200 `{ "data": { "status": "alive" } }`, independente do banco.
- `GET /api/v1/health/ready`: 200 `{ "data": { "status": "ready" } }` quando PostgreSQL e tabela de usuários estão disponíveis; caso contrário, 503 com `UNAVAILABLE` e mensagem genérica.
- Rotas ausentes: 404 JSON com `NOT_FOUND`. A criação de sessão aceita credenciais de contas provisionadas.

As rotas de saúde dispensam sessão. Para verificar a API local na porta padrão, execute `curl --fail http://localhost:3000/api/v1/health/ready`.

## Swagger gerado

`npm run docs:generate -w @mycity/api` usa `swagger-autogen` nas rotas implementadas e os refinamentos de schemas/respostas. `npm run docs:check -w @mycity/api`, incluído em `npm run check`, detecta drift. Não editar o JSON gerado manualmente.

A UI usa `swagger-ui-express` em `/api/docs/`, com schema em `/api/openapi.json`, somente com `NODE_ENV=development` e `API_DOCS_ENABLED=true`. Nesse modo o listener fica em `127.0.0.1`. Em produção, schema, UI e assets retornam 404 mesmo se a flag estiver ativa. A UI executa apenas consultas GET, com validador remoto e persistência de credenciais desativados.
