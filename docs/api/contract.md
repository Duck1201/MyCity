# Contrato HTTP proposto

Status: proposta dos endpoints de negócio. O servidor já implementa apenas as rotas de saúde descritas ao final. Operações refletem o escopo aprovado; nomes de rotas, schemas, limites e políticas C03/C04/C06–C08 precisam de revisão antes de congelar a interface. A política de sessão C05 foi aprovada. Este arquivo é a fonte da proposta HTTP nesta etapa; não há coleção Postman publicada. As rotas implementadas possuem OpenAPI gerado por swagger-autogen em `apps/api/src/openapi.json`; as operações de negócio abaixo continuam planejadas.

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

Propor web e API na mesma origem via proxy. Em operações autenticadas por cookie, verificar origem e proteção CSRF, incluindo login/logout; definir mecanismo exato na implementação de Identidade. CORS não substitui autorização nem defesa CSRF. Configurar limite de tentativas de login e resposta genérica para credenciais inválidas; parâmetros ainda devem ser definidos.

| Método e caminho           | Entrada                                       | Sucesso                                                            | Efeito                                                            |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| POST `/sessions`           | `{cpf,password,transport:"cookie"\|"bearer"}` | 201: usuário, expiresAt; token apenas para bearer; cookie para web | Cria sessão após validar credenciais. Transport não altera papel. |
| GET `/me`                  | Sessão                                        | 200: `{id,role}`                                                   | Consulta identidade mínima.                                       |
| DELETE `/sessions/current` | Sessão                                        | 204                                                                | Revoga sessão e limpa cookie quando aplicável.                    |

CPF e senha nunca entram em URL, logs ou dados públicos de denúncias. A autenticação será própria do MyCity, com CPF fictício normalizado em 11 dígitos na demonstração, sem integração gov.br e sem campo de e-mail. O código atual de Identidade ainda usa e-mail e precisa ser migrado antes do login HTTP. Papel vem do banco, não do corpo. Sessão ausente/expirada/revogada retorna 401. Sessão válida sem permissão retorna 403. Login não cria usuários.

## Operações de denúncia

| Método e caminho                     | Ator                       | Entrada                                                | Sucesso / efeito                                                                                              |
| ------------------------------------ | -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| POST `/reports`                      | Cidadão                    | Multipart descrito abaixo                              | 201: ReportDetail; cria denúncia, fotos e evento inicial. Replay idempotente retorna 200 com o mesmo recurso. |
| GET `/reports`                       | Autenticado                | scope, status, category, regionId, sort, limit, cursor | 200: ReportSummary[]; visibilidade filtrada no servidor.                                                      |
| GET `/reports/map`                   | Autenticado                | bbox?, status, category, regionId, limit, cursor       | 200: ReportMarker[]; mesma política de visibilidade. Paginar até completar a área consultada.                 |
| GET `/reports/summary`               | Gestor                     | category?, regionId?                                   | 200: contagens por status no universo filtrado; não limitar à página atual.                                   |
| GET `/reports/{id}`                  | Leitor autorizado          | ID                                                     | 200: ReportDetail, incluindo versão e ações permitidas.                                                       |
| GET `/reports/{id}/history`          | Leitor autorizado          | limit, cursor                                          | 200: ReportEvent[] em createdAt asc, id asc.                                                                  |
| GET `/reports/{id}/photos/{photoId}` | Leitor autorizado          | IDs                                                    | 200 image/jpeg; sem caminho do disco no contrato.                                                             |
| PUT `/reports/{id}/confirmation`     | Cidadão diferente do autor | Sem corpo                                              | 200: `{confirmed:true,confirmationCount}`; repetição não duplica.                                             |
| DELETE `/reports/{id}/confirmation`  | Cidadão da confirmação     | Sem corpo                                              | 200: `{confirmed:false,confirmationCount}`; ausência já retirada é sucesso enquanto ação permitida.           |
| POST `/reports/{id}/transitions`     | Gestor                     | `{targetStatus,expectedVersion,reason?}`               | 200: ReportDetail; atualiza estado+histórico+notificação atomicamente.                                        |
| POST `/reports/{id}/cancellation`    | Autor                      | `{expectedVersion}`                                    | 200: ReportDetail; cancela+registra histórico+notifica.                                                       |
| POST `/reports/{id}/replies`         | Gestor                     | `{text,clientRequestId}`                               | 201: ReportEvent; resposta pública sem mudança de estado. Replay igual retorna 200.                           |
| GET `/regions`                       | Autenticado                | limit, cursor                                          | 200: `{id,name,city?}[]` para filtros; origem/classificação depende de C03.                                   |

`scope`: `feed`, `mine`, `resolved` ou `management`. `mine` é do usuário autenticado, sem aceitar authorId arbitrário; `management` é exclusivo de gestor. Proposta de ordenações: `priority` para pendentes da gestão e `newest` para feed; histórico de resolvidas por data de resolução desc, ID desc. Aplicar filtro de status antes da ordenação. A ordenação por prioridade em estados finais não possui significado de atendimento.

Categorias são o catálogo fechado de seis valores compartilhados em contratos, conforme [modelo de dados](../data-model.md). As respostas textuais propõem limite de 2.000 caracteres após trim (C07), com chave de repetição vinculada à denúncia e ao ator. Mesma chave com texto diferente retorna 409, sem criar outro evento.

Para o mapa, proposta de `bbox=west,south,east,north`, com coordenadas válidas e west < east, south < north; cruzamento do antimeridiano fora da consulta proposta. Se a área exigir várias páginas, não mostrar a primeira como se fosse o total. Comportamento de região depende de C03.

### Criação multipart

- Parte `metadata`: JSON UTF-8 com `clientRequestId`, `category`, `description`, `location` e `showIdentity` (booleano obrigatório).
- De uma a três partes `photos`, em ordem de exibição, com conteúdo JPEG já comprimido.
- `location`: `{latitude,longitude,source:"GPS"|"MANUAL"}`. `addressLabel` e `regionId` vêm da política de geocodificação a definir; o cliente não ganha permissão por declarar uma região.
- Identidade do autor vem da sessão. Status inicial é SENT. Ignorar ou rejeitar campos de privilégio não previstos, nunca aceitar authorId/status arbitrários.
- Unicidade de `(authorId,clientRequestId)`, com comparação do payload normalizado e conteúdo das fotos. Reenvio idêntico retorna o mesmo recurso; chave reutilizada com conteúdo diferente retorna 409 `IDEMPOTENCY_CONFLICT`.
- Propostas de limites: 5 MiB por foto, 16 MiB por requisição incluindo multipart, descrição até 1.000 caracteres (C06/C07). Orientação/dimensões devem ser verificadas após decodificação.
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
| Notification  | id, reportId, reportEventId, type, createdAt, readAt; sem dados de outros destinatários                                                                  |
| WeatherAlert  | id, level, title, message, regionLabel, issuedAt, expiresAt, simulated:true                                                                              |

`allowedActions` ajuda a interface; não concede autorização. Uma ação pode tornar-se inválida entre leitura e escrita. IDs de fotos sempre precisam pertencer à denúncia informada.

### Transições e conflitos

Rejeição usa `targetStatus: "REJECTED"` e `reason` obrigatório. Transição Enviado → Resolvido retorna 409 `INVALID_TRANSITION`; versão defasada retorna 409 `VERSION_CONFLICT`. Em qualquer conflito, nenhuma parte da operação é persistida.

Exemplo de requisição após leitura da versão 1 em SENT:

```json
{ "targetStatus": "UNDER_REVIEW", "expectedVersion": 1 }
```

Após sucesso, versão 2 e histórico/notificação correspondentes devem ser observáveis. Se a resposta se perder, o cliente consulta a denúncia e o histórico. Repetir a versão antiga não cria um novo evento.

Proposta C08: confirmações e respostas ficam fechadas em estados finais, inclusive retirada de confirmação. Não implementar essa parte como confirmada sem alinhar o contrato.

## Notificações e alertas

| Método e caminho               | Ator         | Entrada                    | Saída                                                                     |
| ------------------------------ | ------------ | -------------------------- | ------------------------------------------------------------------------- |
| GET `/notifications`           | Cidadão      | unreadOnly?, limit, cursor | 200: avisos somente do destinatário autenticado, mais recentes primeiro.  |
| PUT `/notifications/{id}/read` | Destinatário | Sem corpo                  | 200: Notification; marcar novamente não altera a data inicial de leitura. |
| GET `/weather-alerts`          | Autenticado  | limit, cursor              | 200: alertas fictícios com simulated:true.                                |
| GET `/weather-alerts/{id}`     | Autenticado  | ID                         | 200: detalhes do cenário simulado.                                        |

Não existe rota de envio real de alerta nem cadastro de Defesa Civil. Não há endpoint de avaliação, reabertura ou exclusão física de denúncia.

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
| 429     | TOO_MANY_REQUESTS                                            | Respeitar Retry-After, se enviado. Limites operacionais ainda a definir.                           |
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
- Rotas ausentes: 404 JSON com `NOT_FOUND`. Não há rotas de negócio públicas implementadas nesta etapa.

As rotas de saúde não exigem sessão nem retornam configurações, credenciais ou estado detalhado do banco. A configuração do proxy público poderá restringir seu acesso. Validação local adicional pode usar `postman request http://localhost:8090/api/v1/health/ready --script-post-request @scripts/health-check.cjs --no-report-events`.

## Swagger gerado

`npm run docs:generate -w @mycity/api` usa `swagger-autogen` nas rotas implementadas e os refinamentos de schemas/respostas. `npm run docs:check -w @mycity/api`, incluído em `npm run check`, detecta drift. Não editar o JSON gerado manualmente.

A UI usa `swagger-ui-express` em `/api/docs/`, com schema em `/api/openapi.json`, somente com `NODE_ENV=development` e `API_DOCS_ENABLED=true`. Nesse modo o listener fica em `127.0.0.1`. Em produção, schema, UI e assets retornam 404 mesmo se a flag for true, até existir uma política administrativa explícita. Validador remoto e persistência de credenciais ficam desativados. A documentação atual contém somente saúde da API; não anuncia login/denúncias como implementados.
