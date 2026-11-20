# Contrato HTTP proposto

Implementados na etapa 2: saúde, sessão, publicação multipart, detalhes, leitura de fotos e lista paginada com `scope=management`. Na etapa 3 foram acrescentados `scope=mine`, histórico paginado, transições, respostas e consulta e leitura de avisos. A etapa 4 implementa feed, histórico de resolvidas, marcadores, contadores, confirmações e cancelamento. Na etapa 5, o módulo de alertas disponibiliza um catálogo autenticado de cenários climáticos fictícios. A classificação regional das denúncias segue adiada. O contrato executável local consta do OpenAPI.

## Convenções

- Prefixo proposto: `/api/v1`. HTTPS no ambiente hospedado.
- JSON com campos camelCase; upload usa multipart. IDs opacos em string, timestamps ISO 8601 UTC, coordenadas numéricas.
- Resposta de entidade: `{ "data": ... }`. Listas: `{ "data": [...], "page": { "nextCursor": null } }`.
- Erros: `{ "error": { "code": "...", "message": "...", "fields": {} }, "requestId": "..." }`. `fields` é opcional. Mensagens visíveis em pt-BR; códigos estáveis em inglês.
- Paginação proposta: `limit` padrão 20, máximo 100; `cursor` opaco. Ordenações sempre incluem ID como desempate. Em listas mutáveis, não há snapshot entre páginas; invalidar/recomeçar após ações e deduplicar IDs no cliente.
- Coleções de fotos e eventos retornam ordem explícita. Não depender da ordem natural do banco.
- Consulta de denúncias, fotos, mapa e histórico exige sessão, conforme decisão aprovada em C04. As operações de escrita também exigem autenticação. Credenciais, hashes e caminhos internos jamais aparecem nos DTOs.

## Sessão aprovada — C05

Sessões opacas revogáveis com validade de 24 horas a partir do login, sem renovação automática nesta entrega. Após expiração, exigir novo login; logout invalida imediatamente a sessão atual. Guardar apenas hash do segredo no servidor. Web usa cookie HttpOnly, Secure, SameSite=Lax; app usa Bearer com armazenamento seguro do sistema operacional. Não persistir segredo em armazenamento web acessível por JavaScript.

Web e API usam a mesma origem. Para login web e mutações por cookie, envie a origem configurada e `X-MyCity-Client: web`. O processo limita login a cinco falhas por origem de rede e CPF e 60 tentativas por origem em janela de 15 minutos. A origem IPv6 é agrupada por /64, com até quatro verificações simultâneas no processo. Uma recusa por limite responde 429 e Retry-After.

A instância da API mantém cotas independentes por origem de rede (IPv4 ou /64 IPv6) em janelas de um minuto. O login permite 30 requisições, inclusive com JSON inválido. Liveness permite 60 e readiness permite 30, antes da consulta ao banco. Quando habilitados, Swagger, seus assets e OpenAPI compartilham 120 requisições. Cada grupo admite 4.096 origens ativas. Ao esgotar a capacidade do grupo, novas origens aguardam a primeira expiração. O IP vem do Express conforme os proxies confiáveis configurados. O excesso retorna 429 com `TOO_MANY_REQUESTS` e `Retry-After` em segundos.

| Método e caminho           | Entrada                                       | Sucesso                                                            | Efeito                                                            |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| POST `/sessions`           | `{cpf,password,transport:"cookie"\|"bearer"}` | 201: usuário, expiresAt; token apenas para bearer; cookie para web | Cria sessão após validar credenciais. Transport não altera papel. |
| GET `/me`                  | Sessão                                        | 200: `{id,role}`                                                   | Consulta identidade mínima.                                       |
| DELETE `/sessions/current` | Sessão                                        | 204                                                                | Revoga sessão e limpa cookie quando aplicável.                    |

A consulta `GET /me` comunica a expiração original no cabeçalho `X-Session-Expires-At` (ISO 8601 UTC). O painel usa esse prazo para encerrar a exibição local após recarregar a página, inclusive se perder a conexão.

CPF e senha nunca entram em URL, logs ou dados públicos de denúncias. A autenticação será própria do MyCity, com CPF fictício normalizado em 11 dígitos na demonstração, sem integração gov.br e sem campo de e-mail. O servidor valida o CPF normalizado e a senha da conta habilitada. Papel vem do banco, não do corpo. Sessão ausente/expirada/revogada retorna 401. Sessão válida sem permissão retorna 403. Login não cria usuários.

Ao reiniciar a API pelos comandos locais de desenvolvimento, uma alteração de senha de demonstração revoga as sessões daquela conta. O próximo login exige a senha atualizada. Sessões das demais contas habilitadas conservam sua expiração original.

## Catálogo de categorias

| Operação                 | Quem pode usar | Contrato                                                                                                                                                                                                                                                                    |
| ------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/categories`        | Sessão válida  | 200, `{data:[{id,name,archived}]}`. Inclui as seis iniciais e as adicionadas pelo gestor, inclusive arquivadas e sem ocorrências.                                                                                                                                           |
| POST `/categories`       | Gestor         | Recebe `{name}` e retorna 201 com `{data:{id,name,archived}}`. Categorias novas começam ativas. O nome aceita de 1 a 80 caracteres após normalizar espaços. Nome equivalente sem distinção de caixa ou acentos retorna 409 `CATEGORY_EXISTS`. Entrada inválida retorna 422. |
| PATCH `/categories/{id}` | Gestor         | Recebe `{name}` com as regras do cadastro ou `{archived:boolean}`. Preserva o ID e retorna 200 com `{data:{id,name,archived}}`. Nome duplicado retorna 409, ID inexistente 404 e entrada inválida 422.                                                                      |

O cadastro e a edição aceitam também `icon`, escolhido entre os símbolos do catálogo. O GET inclui o símbolo persistido quando definido e fornece `reportCount` somente ao gestor. O painel usa o ID para manter os vínculos, o símbolo original das categorias iniciais e o acesso à fila filtrada.

O campo de CPF nos clientes aplica pontuação durante a edição e envia os 11 dígitos como string, preservando zeros iniciais. A API continua aceitando o CPF completo pontuado ou sem separadores.

## Operações de denúncia

| Método e caminho                     | Ator                       | Entrada                                                    | Sucesso / efeito                                                                                              |
| ------------------------------------ | -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| POST `/reports`                      | Cidadão                    | Multipart descrito abaixo                                  | 201: ReportDetail; cria denúncia, fotos e evento inicial. Replay idempotente retorna 200 com o mesmo recurso. |
| GET `/reports`                       | Autenticado                | scope, status, category, sort, limit, cursor               | 200: ReportSummary[]; visibilidade filtrada no servidor.                                                      |
| GET `/reports/map`                   | Autenticado                | bbox?, status, category, limit, cursor                     | 200: ReportMarker[]; mesma política de visibilidade. Paginar até completar a área consultada.                 |
| GET `/reports/overview`              | Gestor                     | Sem parâmetros                                             | 200: contagens por situação, categorias com totais pendentes, pendência mais antiga e até três prioridades.   |
| GET `/reports/queue`                 | Gestor                     | q?, category?, status?, de?, ate?, ordem?, pagina?, limit? | 200: data, total filtrado, counts por situação e page efetiva.                                                |
| GET `/reports/queue.csv`             | Gestor                     | mesmos filtros e ordenação, sem paginação                  | 200: CSV UTF-8 com todas as linhas correspondentes.                                                           |
| GET `/reports/summary`               | Gestor                     | category?                                                  | 200: objeto com os seis estados e suas contagens no universo filtrado por categoria, sem paginação.           |
| GET `/reports/{id}`                  | Leitor autorizado          | ID                                                         | 200: ReportDetail, incluindo versão e ações permitidas.                                                       |
| GET `/reports/{id}/history`          | Leitor autorizado          | limit, cursor, order                                       | 200: ReportEvent[] por createdAt e id, crescentes (oldest, padrão) ou decrescentes (newest).                  |
| GET `/reports/{id}/photos/{photoId}` | Leitor autorizado          | IDs                                                        | 200 image/jpeg; sem caminho do disco no contrato.                                                             |
| PUT `/reports/{id}/confirmation`     | Cidadão diferente do autor | Sem corpo                                                  | 200: `{confirmed:true,confirmationCount}`; repetição não duplica.                                             |
| DELETE `/reports/{id}/confirmation`  | Cidadão da confirmação     | Sem corpo                                                  | 200: `{confirmed:false,confirmationCount}`; ausência já retirada é sucesso enquanto ação permitida.           |
| POST `/reports/{id}/transitions`     | Gestor                     | `{targetStatus,expectedVersion,reason?}`                   | 200: ReportDetail; atualiza estado+histórico+notificação atomicamente.                                        |
| POST `/reports/{id}/cancellation`    | Autor                      | `{expectedVersion}`                                        | 200: ReportDetail; cancela+registra histórico+notifica.                                                       |
| POST `/reports/{id}/replies`         | Gestor                     | `{text,clientRequestId}`                                   | 201: ReportEvent; resposta pública sem mudança de estado. Replay igual retorna 200.                           |
| GET `/regions`                       | Autenticado                | limit, cursor                                              | Adiado em C03. Nesta fase o backend aceita filtros de categoria e status.                                     |

`scope`: `feed`, `mine`, `resolved` ou `management`. `mine` é do usuário autenticado, sem aceitar authorId arbitrário; `management` é exclusivo de gestor. A gestão prioriza ativos por confirmações decrescentes, criação crescente e ID, seguidos dos encerrados. O feed ativo usa criação decrescente; histórico de resolvidas por data de resolução desc, ID desc. Aplicar filtro de status antes da ordenação. A ordenação por prioridade em estados finais não possui significado de atendimento.

Uma publicação nova em categoria arquivada retorna 409 `CATEGORY_ARCHIVED`, inclusive se o arquivamento ocorrer durante o preenchimento. O reenvio idêntico de uma publicação já concluída retorna 200 com o registro existente. Reativar o grupo permite novas publicações.

A Visão geral lê os dados em uma única transação com snapshot consistente. `counts` contém as seis situações, incluindo zeros. `oldest` traz ID e data de criação da pendência mais antiga ou nulo. `categories` inclui ID, nome, ícone, arquivamento e contagem de pendências de cada grupo, inclusive os vazios. `priorities` contém as três primeiras pendências pela ordenação da fila, com ID, categoria, descrição, situação, contagem de confirmações e caminho autenticado da capa quando disponível.

Na fila, `q` aceita até 160 caracteres e localiza termos no protocolo, relato e coordenadas. `de` e `ate` são dias inclusivos em America/Sao_Paulo. `status=pending` reúne Enviado, Em análise e Em andamento. `ordem` aceita prioridade (padrão), antigas e recentes. A primeira página é 1 e cada página contém por padrão até 5 ocorrências (máximo 100). As contagens por situação aplicam a busca, categoria e período antes do filtro de situação. Uma página além do resultado retorna a última. O CSV usa os mesmos critérios e inclui protocolo, categoria, relato, latitude, longitude, situação, data e confirmações. Textos com risco de fórmula recebem proteção.

Categorias vêm do catálogo persistido (incluindo grupos sem denúncias). Os seis identificadores originais continuam válidos. Uma categoria cadastrada pelo gestor recebe um UUID e pode ser usada imediatamente nos mesmos endpoints. Listas, detalhes e marcadores incluem `category` e `categoryName`. As respostas e justificativas têm limite de 2.000 caracteres após trim (C07). A resposta pública usa uma chave de repetição vinculada à denúncia e ao ator. Mesma chave com texto diferente retorna 409, sem criar outro evento.

Para o mapa, use `bbox=west,south,east,north`, com coordenadas válidas e west < east, south < north; cruzamento do antimeridiano requer duas consultas, uma de cada lado. Se a área exigir várias páginas, não mostrar a primeira como se fosse o total. O filtro regional segue adiado.

### Criação multipart

- Parte `metadata`: JSON UTF-8 com `clientRequestId`, `category`, `description`, `location` e `showIdentity` (booleano obrigatório).
- De uma a três partes `photos`, em ordem de exibição, com conteúdo JPEG já comprimido.
- `location`: `{latitude,longitude,source:"GPS"|"MANUAL"}`. `addressLabel` e `regionId` vêm da política de geocodificação a definir; o cliente não ganha permissão por declarar uma região.
- Identidade do autor vem da sessão. Status inicial é SENT. Ignorar ou rejeitar campos de privilégio não previstos, nunca aceitar authorId/status arbitrários.
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

| DTO           | Campos públicos propostos                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ReportSummary | id, category, description, status, location, region?, createdAt, updatedAt, confirmationCount, confirmedByMe, isMine, coverPhoto?, showIdentity, author? |
| ReportDetail  | Campos do resumo + version, photos[], allowedActions[]; histórico paginado em rota própria                                                               |
| Photo         | id, position, width, height, byteSize, contentPath; nenhum storageKey                                                                                    |
| ReportMarker  | id, latitude, longitude, category, status, confirmationCount                                                                                             |
| ReportEvent   | id, type, actorRole, fromStatus?, toStatus?, text?, createdAt; identidade pública respeita showIdentity; CPF e autor interno nunca são expostos          |
| Notification  | id, reportId, reportEventId, type, status, fromStatus?, createdAt, readAt; sem dados de outros destinatários                                             |
| WeatherAlert  | id, level, title, message, regionLabel, issuedAt, expiresAt, simulated:true                                                                              |

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

| Método e caminho               | Ator         | Entrada                    | Saída                                                                     |
| ------------------------------ | ------------ | -------------------------- | ------------------------------------------------------------------------- |
| GET `/notifications`           | Cidadão      | unreadOnly?, limit, cursor | 200: avisos somente do destinatário autenticado, mais recentes primeiro.  |
| PUT `/notifications/{id}/read` | Destinatário | Sem corpo                  | 200: Notification; marcar novamente não altera a data inicial de leitura. |
| GET `/weather-alerts`          | Autenticado  | limit, cursor              | 200: alertas fictícios com simulated:true.                                |
| GET `/weather-alerts/{id}`     | Autenticado  | ID                         | 200: detalhes do cenário simulado.                                        |

O catálogo da demonstração usa como referência 25 de novembro de 2026 às 12h de Brasília. Cada cenário tem uma janela ilustrativa nessa data. A lista apresenta Emergência (alagamento), Alerta (vento forte) e Atenção (chuva moderada), nessa ordem, com áreas fictícias. As duas rotas exigem sessão e retornam `simulated: true` em cada item. O app identifica a simulação na lista e nos detalhes. As datas se referem ao cenário, independentemente do relógio do aparelho. O catálogo é somente leitura, compartilhado entre contas, sem consulta meteorológica, localização do leitor ou criação de notificação.

Não existe rota de envio real de alerta nem cadastro de Defesa Civil. Não há endpoint de avaliação ou exclusão física de denúncia. A reabertura usa a rota de transições existente.

## Erros e repetição

| HTTP    | Código representativo                                        | Comportamento do cliente                                                                           |
| ------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 400     | INVALID_REQUEST                                              | Corrigir formato/parâmetro, não repetir automaticamente.                                           |
| 401     | UNAUTHENTICATED                                              | Encerrar estado de sessão e solicitar login.                                                       |
| 403     | FORBIDDEN                                                    | Informar ação não permitida; não mudar estado local como sucesso.                                  |
| 404     | NOT_FOUND                                                    | Recurso ausente ou oculto ao solicitante; evitar revelar existência privada.                       |
| 409     | INVALID_TRANSITION / VERSION_CONFLICT / IDEMPOTENCY_CONFLICT | Consultar estado ou corrigir intenção; não repetir cegamente.                                      |
| 413     | PAYLOAD_TOO_LARGE                                            | Reduzir anexos; preservar formulário.                                                              |
| 415     | UNSUPPORTED_MEDIA_TYPE                                       | Selecionar/converter imagem válida.                                                                |
| 422     | VALIDATION_ERROR                                             | Apresentar campos inválidos; nenhuma gravação parcial.                                             |
| 429     | TOO_MANY_REQUESTS                                            | Respeitar Retry-After, em segundos.                                                                |
| 500/503 | INTERNAL_ERROR / UNAVAILABLE                                 | Informar falha sem detalhes internos; repetir leitura ou operação idempotente de forma controlada. |

```json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Informe a justificativa da rejeição.",
        "fields": { "reason": "Campo obrigatório." }
    },
    "requestId": "demo-request-002"
}
```

Rotas concretas `/reports/map` e `/reports/summary` não devem ser capturadas como `{id}`. Novos endpoints só entram com requisito e critério de aceitação correspondente. Após aprovar este contrato, representá-lo em formato executável e validar exemplos, sem inferir suporte por existir apenas documentação.

## Rotas operacionais implementadas

- `GET /api/v1/health/live`: 200 `{ "data": { "status": "alive" } }`, independente do banco.
- `GET /api/v1/health/ready`: 200 `{ "data": { "status": "ready" } }` quando PostgreSQL e tabela de usuários estão disponíveis; caso contrário, 503 com `UNAVAILABLE` e mensagem genérica.
- Rotas ausentes: 404 JSON com `NOT_FOUND`. A criação de sessão aceita credenciais de contas provisionadas.

As rotas de saúde não exigem sessão nem retornam configurações, credenciais ou estado detalhado do banco. A configuração do proxy público poderá restringir seu acesso. Validação local adicional pode usar `postman request http://localhost:8090/api/v1/health/ready --script-post-request @scripts/health-check.cjs --no-report-events`.

## Swagger gerado

`npm run docs:generate -w @mycity/api` usa `swagger-autogen` nas rotas implementadas e os refinamentos de schemas/respostas. `npm run docs:check -w @mycity/api`, incluído em `npm run check`, detecta drift. Não editar o JSON gerado manualmente.

A UI usa `swagger-ui-express` em `/api/docs/`, com schema em `/api/openapi.json`, somente com `NODE_ENV=development` e `API_DOCS_ENABLED=true`. Nesse modo o listener fica em `127.0.0.1`. Em produção, schema, UI e assets retornam 404 mesmo se a flag for true, até existir uma política administrativa explícita. Validador remoto e persistência de credenciais ficam desativados. O documento inclui as rotas implementadas de saúde, identidade e denúncias.
