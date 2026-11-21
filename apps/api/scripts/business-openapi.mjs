// Paths below share the health document's site-root server URL.
const prefix = '/api/v1';
const json = (schema) => ({ 'application/json': { schema } });
const string = { type: 'string' };
const boolean = { type: 'boolean' };
const timestamp = { type: 'string', format: 'date-time' };
const count = { type: 'integer', minimum: 0 };
const positiveInteger = { type: 'integer', minimum: 1 };
const latitude = { type: 'number', minimum: -90, maximum: 90 };
const longitude = { type: 'number', minimum: -180, maximum: 180 };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', required, properties });
const ref = (name) => ({ $ref: '#/components/schemas/' + name });
const array = (items) => ({ type: 'array', items });
const dataContent = (data) => json(object({ data }));
const cursorContent = (items) => json(object({ data: array(items), page: object({ nextCursor: { ...string, nullable: true } }) }));
const secured = [{ WebSession: [] }, { AndroidSession: [] }];
const unauthorized = { description: 'Sessão ausente, expirada ou revogada.' };
const forbidden = { description: 'Operação não permitida.' };
const invalidQuery = { description: 'Parâmetros de consulta inválidos.' };
const invalidPage = { description: 'Parâmetros de consulta inválidos ou cursor fora dos resultados.' };
const id = (name) => ({ name, in: 'path', required: true, schema: string });
const lookup = (summary, parameters, content) => ({ summary, security: secured, parameters, responses: { 200: { description: 'Consulta autorizada.', ...content }, 401: unauthorized, 404: { description: 'Recurso não encontrado.' } } });
const pagination = [
    { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
    { name: 'cursor', in: 'query', schema: string },
];
const publicText = { type: 'string', minLength: 1, maxLength: 2000 };
const reportWrite = (summary, required, properties, responses) => ({
    summary,
    security: secured,
    parameters: [id('id')],
    requestBody: { required: true, content: json({ type: 'object', additionalProperties: false, required, properties }) },
    responses: { 401: unauthorized, 403: forbidden, 404: { description: 'Denúncia não encontrada.' }, 422: { description: 'Campos inválidos.' }, ...responses },
});
const statusFilter = { name: 'status', in: 'query', schema: { type: 'string', enum: ['SENT', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELED'] } };
const categoryFilter = { name: 'category', in: 'query', schema: string, description: 'Identificador retornado por GET /categories.' };
const queueFilters = [categoryFilter, { name: 'status', in: 'query', schema: { type: 'string', enum: [...statusFilter.schema.enum, 'pending'] } }, { name: 'q', in: 'query', schema: { type: 'string', maxLength: 160 } }, ...['de', 'ate'].map((name) => ({ name, in: 'query', schema: { type: 'string', format: 'date' }, description: 'Dia inclusivo em America/Sao_Paulo.' })), { name: 'ordem', in: 'query', schema: { type: 'string', enum: ['prioridade', 'antigas', 'recentes'] } }];
const participation = (summary, confirmed) => ({ summary, security: secured, parameters: [id('id')], responses: { 200: { description: 'Estado de confirmação pelo cidadão e total da denúncia.', content: dataContent(object({ confirmed: { ...boolean, enum: [confirmed] }, confirmationCount: count })) }, 401: unauthorized, 403: forbidden, 404: { description: 'Denúncia não encontrada.' }, 409: { description: 'Alteração indisponível neste estado.' } } });
const reports = prefix + '/reports';
export function addBusinessPaths(doc) {
    const limited = {
        description: 'Cota por origem atingida. Aguarde o intervalo indicado em segundos.',
        headers: { 'Retry-After': { schema: { type: 'integer', minimum: 1 } } },
        content: json({ type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string', enum: ['TOO_MANY_REQUESTS'] }, message: string } } } }),
    };
    for (const route of ['/health/live', '/health/ready']) doc.paths[prefix + route].get.responses[429] = limited;
    doc.components.securitySchemes = { WebSession: { type: 'apiKey', in: 'cookie', name: '__Host-mycity' }, AndroidSession: { type: 'http', scheme: 'bearer' } };
    const alertProperties = {
        id: string,
        level: { type: 'string', enum: ['ATTENTION', 'ALERT', 'EMERGENCY'] },
        title: string,
        message: string,
        regionLabel: string,
        issuedAt: { type: 'string', format: 'date-time' },
        expiresAt: { type: 'string', format: 'date-time' },
        simulated: { type: 'boolean', enum: [true] },
    };
    doc.components.schemas.WeatherAlert = { type: 'object', required: Object.keys(alertProperties), properties: alertProperties };
    const notification = { $ref: '#/components/schemas/ReportNotification' };
    doc.components.schemas.ReportNotification = {
        type: 'object',
        required: ['id', 'reportId', 'reportEventId', 'type', 'status', 'createdAt', 'readAt'],
        properties: { id: string, reportId: string, reportEventId: string, type: { type: 'string', enum: ['STATUS_CHANGED'] }, fromStatus: statusFilter.schema, status: statusFilter.schema, createdAt: { type: 'string', format: 'date-time' }, readAt: { type: 'string', format: 'date-time', nullable: true } },
    };
    const icon = { type: 'string', enum: ['road', 'lighting', 'waste', 'water', 'debris', 'trees', 'access', 'cycling', 'transit', 'works', 'walkway', 'signs', 'drainage', 'energy'] };
    const category = { type: 'object', required: ['id', 'name', 'archived'], properties: { id: string, name: string, icon, reportCount: { type: 'integer', minimum: 0, description: 'Contagem no catálogo do gestor.' }, archived: { type: 'boolean' } } };
    const categoryName = { type: 'object', required: ['name'], additionalProperties: false, properties: { icon, name: { type: 'string', minLength: 1, maxLength: 80 } } };
    const archiveCategory = { type: 'object', required: ['archived'], additionalProperties: false, properties: { archived: { type: 'boolean' } } };
    const location = object({ latitude, longitude, source: { ...string, enum: ['GPS', 'MANUAL'] } });
    const reportFields = { id: string, category: string, categoryName: string, status: statusFilter.schema, confirmationCount: count };
    const summaryFields = {
        ...reportFields,
        description: string,
        location,
        createdAt: timestamp,
        updatedAt: timestamp,
        confirmedByMe: boolean,
        isMine: boolean,
        showIdentity: boolean,
    };
    const queueFields = { ...reportFields, description: string, latitude, longitude, createdAt: timestamp, coverPhotoId: { ...string, nullable: true } };
    Object.assign(doc.components.schemas, {
        ReportPhoto: object({ id: string, position: count, width: positiveInteger, height: positiveInteger, byteSize: positiveInteger, contentPath: string, thumbnailPath: string }),
        ReportSummary: object({ ...summaryFields, photosExpireAt: timestamp, coverPhoto: ref('ReportPhoto'), author: object({ name: string, photoUrl: string }) }, Object.keys(summaryFields)),
        ReportDetail: { allOf: [ref('ReportSummary'), object({ version: positiveInteger, photos: { ...array(ref('ReportPhoto')), minItems: 0, maxItems: 3 }, allowedActions: array(string) }), { type: 'object', properties: { rejectionReason: { ...string, description: 'Justificativa da rejeição em vigor; presente só quando o status é REJECTED.' } } }] },
        ReportMarker: object({ ...reportFields, latitude, longitude }),
        ReportEvent: object({ id: string, type: { ...string, enum: ['CREATED', 'STATUS_CHANGED', 'REPLY'] }, actorRole: { ...string, enum: ['CITIZEN', 'MANAGER'] }, fromStatus: statusFilter.schema, toStatus: statusFilter.schema, text: publicText, createdAt: timestamp }, ['id', 'type', 'actorRole', 'createdAt']),
        ReportStatusCounts: object(Object.fromEntries(statusFilter.schema.enum.map((status) => [status, count]))),
        ManagementQueueRow: object({ ...queueFields, photosExpireAt: timestamp }, Object.keys(queueFields)),
    });
    const reportDetailContent = dataContent(ref('ReportDetail'));
    const reportEventContent = dataContent(ref('ReportEvent'));
    const queuePage = object({ data: array(ref('ManagementQueueRow')), total: count, counts: ref('ReportStatusCounts'), page: positiveInteger });
    const overview = {
        type: 'object',
        required: ['counts', 'oldest', 'categories', 'priorities'],
        properties: {
            counts: ref('ReportStatusCounts'),
            oldest: { type: 'object', nullable: true, required: ['id', 'createdAt'], properties: { id: string, createdAt: { type: 'string', format: 'date-time' } } },
            categories: { type: 'array', items: { ...category, required: [...category.required, 'count'], properties: { ...category.properties, icon: string, count } } },
            priorities: { type: 'array', maxItems: 3, items: { type: 'object', required: ['id', 'category', 'description', 'status', 'confirmationCount', 'createdAt'], properties: { id: string, category: string, description: string, status: statusFilter.schema, confirmationCount: count, createdAt: { type: 'string', format: 'date-time' }, photoPath: string } } },
        },
    };
    const alert = { $ref: '#/components/schemas/WeatherAlert' };
    Object.assign(doc.paths, {
        [prefix + '/sessions']: { post: { summary: 'Iniciar sessão por CPF e senha', requestBody: { required: true, content: json({ type: 'object', required: ['cpf', 'password', 'transport'], properties: { cpf: string, password: { type: 'string', format: 'password' }, transport: { type: 'string', enum: ['cookie', 'bearer'] } } }) }, responses: { 201: { description: 'Identidade e expiresAt. O transporte bearer também retorna token.' }, 400: { description: 'Entrada inválida.' }, 401: unauthorized, 403: forbidden, 429: limited } } },
        [prefix + '/me']: { get: { summary: 'Consultar identidade da sessão', security: secured, responses: { 200: { description: 'Identidade da sessão.', headers: { 'X-Session-Expires-At': { description: 'Fim da validade original da sessão, em UTC.', schema: { type: 'string', format: 'date-time' } } } }, 401: unauthorized } } },
        [prefix + '/sessions/current']: { delete: { summary: 'Revogar a sessão atual', security: secured, responses: { 204: { description: 'Sessão revogada.' }, 401: unauthorized, 403: forbidden } } },
        [reports]: {
            get: {
                ...lookup('Consultar feed, denúncias próprias, resolvidas ou fila de gestão', [{ name: 'scope', in: 'query', required: true, schema: { type: 'string', enum: ['management', 'mine', 'resolved', 'feed'] } }, statusFilter, categoryFilter, { name: 'sort', in: 'query', schema: { type: 'string', enum: ['priority', 'newest'] } }, ...pagination], {}),
                responses: { 200: { description: 'Lista paginada com page.nextCursor.', content: cursorContent(ref('ReportSummary')) }, 400: invalidPage, 401: unauthorized, 403: forbidden },
            },
            post: { summary: 'Publicar denúncia como cidadão', security: secured, requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['metadata', 'photos'], properties: { metadata: { type: 'string', description: 'JSON com category, description, location, clientRequestId e showIdentity.' }, photos: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', format: 'binary' } } } } } } }, responses: { 201: { description: 'Denúncia criada.', content: reportDetailContent }, 200: { description: 'Reenvio da mesma denúncia.', content: reportDetailContent }, 401: unauthorized, 403: forbidden, 409: { description: 'Chave reutilizada com outro conteúdo, perfil indisponível ou categoria arquivada (CATEGORY_ARCHIVED).' }, 413: { description: 'Limite de tamanho excedido.' }, 415: { description: 'Tipo de mídia inválido.' }, 422: { description: 'Dados inválidos.' }, 429: { description: 'Limite de envio atingido.' }, 507: { description: 'Espaço insuficiente para armazenar as fotos.' } } },
        },
        [reports + '/{id}']: {
            get: lookup('Consultar detalhes da denúncia', [id('id')], { content: reportDetailContent }),
            patch: {
                summary: 'Editar denúncia própria antes do primeiro atendimento; se cancelada, salvar e reabrir em Enviado',
                security: secured,
                parameters: [id('id')],
                requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['metadata'], properties: { metadata: { type: 'string', description: 'JSON com expectedVersion, category, description, location, showIdentity e retainedPhotoIds em ordem. O conjunto final exige uma a três fotos.' }, photos: { type: 'array', maxItems: 3, items: { type: 'string', format: 'binary' }, description: 'Novas fotos JPEG após as mantidas.' } } } } } },
                responses: { 200: { description: 'Detalhe com a edição aplicada.', content: reportDetailContent }, 401: unauthorized, 403: forbidden, 404: { description: 'Denúncia não encontrada.' }, 409: { description: 'Conflito de versão, atendimento iniciado ou edição indisponível.' }, 413: { description: 'Limite de tamanho excedido.' }, 415: { description: 'Tipo de mídia inválido.' }, 422: { description: 'Campos ou fotos inválidos.' }, 429: limited, 507: { description: 'Espaço insuficiente.' } },
            },
        },
        [reports + '/{id}/photos/{photoId}']: { get: lookup('Ler foto vinculada à denúncia', [id('id'), id('photoId')], { content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } } } }) },
        [reports + '/{id}/photos/{photoId}/thumb']: { get: lookup('Ler miniatura (maior lado até 320 px) da foto vinculada à denúncia', [id('id'), id('photoId')], { content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } } } }) },
        [reports + '/{id}/history']: { get: { ...lookup('Consultar histórico da denúncia', [id('id'), ...pagination, { name: 'order', in: 'query', schema: { type: 'string', enum: ['oldest', 'newest'], default: 'oldest' } }], {}), responses: { 200: { description: 'Eventos paginados com page.nextCursor.', content: cursorContent(ref('ReportEvent')) }, 400: invalidPage, 401: unauthorized, 404: { description: 'Denúncia não encontrada.' } } } },
        [reports + '/{id}/transitions']: {
            post: reportWrite(
                'Alterar o status da denúncia',
                ['targetStatus', 'expectedVersion'],
                {
                    targetStatus: { type: 'string', enum: ['SENT', 'UNDER_REVIEW', 'IN_PROGRESS', 'REJECTED', 'RESOLVED'], description: 'Destino permitido em allowedActions: avançar, desfazer o último avanço comprovado no histórico ou reabrir em análise.' },
                    expectedVersion: { type: 'integer', minimum: 1 },
                    reason: { ...publicText, description: 'Obrigatória para rejeição.' },
                },
                { 200: { description: 'Detalhe atualizado, evento e aviso persistidos.', content: reportDetailContent }, 409: { description: 'Versão desatualizada ou transição inválida.' } },
            ),
        },
        [reports + '/{id}/replies']: { post: reportWrite('Publicar resposta no histórico, inclusive após encerramento', ['text', 'clientRequestId'], { text: publicText, clientRequestId: { type: 'string', minLength: 1, maxLength: 128 } }, { 201: { description: 'Resposta registrada.', content: reportEventContent }, 200: { description: 'Mesmo evento em reenvio idêntico.', content: reportEventContent }, 409: { description: 'A chave já foi usada com outro texto.' } }) },
        [prefix + '/notifications']: { get: { ...lookup('Consultar avisos do cidadão', [{ name: 'unreadOnly', in: 'query', schema: { type: 'boolean', default: false } }, ...pagination], {}), responses: { 200: { description: 'Avisos pessoais em ordem decrescente.', content: json({ type: 'object', required: ['data', 'page'], properties: { data: { type: 'array', items: notification }, page: { type: 'object', required: ['nextCursor'], properties: { nextCursor: { type: 'string', nullable: true } } } } }) }, 400: { description: 'Filtro ou cursor inválido.' }, 401: unauthorized, 403: forbidden } } },
        [prefix + '/notifications/{id}/read']: { put: { summary: 'Marcar aviso próprio como lido', security: secured, parameters: [id('id')], responses: { 200: { description: 'Aviso com a data da primeira leitura.', content: json({ type: 'object', required: ['data'], properties: { data: notification } }) }, 401: unauthorized, 403: forbidden, 404: { description: 'Aviso não encontrado.' } } } },
        [reports + '/map']: { get: { ...lookup('Consultar marcadores na área do mapa', [{ name: 'bbox', in: 'query', schema: string, description: 'west,south,east,north' }, statusFilter, categoryFilter, ...pagination], {}), responses: { 200: { description: 'Marcadores paginados com page.nextCursor.', content: cursorContent(ref('ReportMarker')) }, 400: invalidPage, 401: unauthorized } } },
        [reports + '/overview']: { get: { summary: 'Consultar a visão geral de atendimento', security: secured, responses: { 200: { description: 'Indicadores e prioridades da mesma leitura do banco.', content: json({ type: 'object', required: ['data'], properties: { data: overview } }) }, 400: { description: 'Parâmetros de consulta não aceitos.' }, 401: unauthorized, 403: forbidden } } },
        [reports + '/queue']: { get: { summary: 'Consultar a fila filtrada do gestor', security: secured, parameters: [...queueFilters, { name: 'pagina', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 2147483647, default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 5 } }], responses: { 200: { description: 'Contagens antes do filtro de situação, total filtrado e página efetiva.', content: json(queuePage) }, 400: { description: 'Consulta inválida.' }, 401: unauthorized, 403: forbidden } } },
        [reports + '/queue.csv']: { get: { summary: 'Exportar a fila completa no formato CSV', security: secured, parameters: queueFilters, responses: { 200: { description: 'Mesma consulta e ordenação sem paginação.', content: { 'text/csv': { schema: { type: 'string' } } } }, 400: { description: 'Consulta inválida.' }, 401: unauthorized, 403: forbidden } } },
        [reports + '/summary']: { get: { ...lookup('Contar denúncias por estado em todas as páginas', [categoryFilter], {}), responses: { 200: { description: 'Objeto com contagem para cada um dos seis estados.', content: dataContent(ref('ReportStatusCounts')) }, 400: invalidQuery, 401: unauthorized, 403: forbidden } } },
        [reports + '/{id}/confirmation']: { put: participation('Confirmar uma ocorrência', true), delete: participation('Retirar a própria confirmação', false) },
        [reports + '/{id}/cancellation']: { post: reportWrite('Cancelar denúncia própria', ['expectedVersion'], { expectedVersion: { type: 'integer', minimum: 1 } }, { 200: { description: 'Detalhe cancelado, histórico e aviso persistidos.', content: reportDetailContent }, 409: { description: 'Versão desatualizada ou estado incompatível.' } }) },
        [reports + '/{id}/reopening']: { post: reportWrite('Reabrir denúncia própria cancelada e devolvê-la à fila como Enviado', ['expectedVersion'], { expectedVersion: { type: 'integer', minimum: 1 } }, { 200: { description: 'Detalhe reaberto, histórico e aviso persistidos.', content: reportDetailContent }, 409: { description: 'Versão desatualizada ou estado incompatível.' } }) },
        [prefix + '/weather-alerts']: {
            get: {
                summary: 'Listar cenários climáticos simulados',
                security: secured,
                parameters: pagination,
                responses: {
                    200: { description: 'Cenários em ordem de gravidade para a data fictícia da demonstração.', content: json({ type: 'object', required: ['data', 'page'], properties: { data: { type: 'array', items: alert }, page: { type: 'object', required: ['nextCursor'], properties: { nextCursor: { type: 'string', nullable: true } } } } }) },
                    400: { description: 'Parâmetros ou cursor inválidos.' },
                    401: unauthorized,
                },
            },
        },
        [prefix + '/weather-alerts/{id}']: { get: lookup('Consultar um cenário climático simulado', [id('id')], { content: json({ type: 'object', required: ['data'], properties: { data: alert } }) }) },
        [prefix + '/categories']: {
            get: { summary: 'Consultar as categorias disponíveis', security: secured, responses: { 200: { description: 'Catálogo completo, incluindo categorias arquivadas e categorias sem denúncias.', content: json({ type: 'object', properties: { data: { type: 'array', items: category } } }) }, 401: unauthorized } },
            post: { summary: 'Cadastrar categoria como gestor', security: secured, requestBody: { required: true, content: json(categoryName) }, responses: { 201: { description: 'Categoria cadastrada e ativa.', content: json({ type: 'object', required: ['data'], properties: { data: category } }) }, 401: unauthorized, 403: forbidden, 409: { description: 'Nome já cadastrado.' }, 422: { description: 'Nome inválido.' } } },
        },
        [prefix + '/categories/{id}']: {
            patch: {
                summary: 'Renomear, arquivar ou reativar categoria como gestor',
                security: secured,
                parameters: [id('id'), { in: 'header', name: 'Origin', schema: string, description: 'Origem do painel, obrigatória com sessão por cookie.' }, { in: 'header', name: 'X-MyCity-Client', schema: { type: 'string', enum: ['web'] }, description: 'Obrigatório com sessão por cookie.' }],
                requestBody: { required: true, content: json({ oneOf: [categoryName, archiveCategory] }) },
                responses: {
                    200: { description: 'Categoria atualizada com o mesmo identificador.', content: json({ type: 'object', required: ['data'], properties: { data: category } }) },
                    401: unauthorized,
                    403: forbidden,
                    404: { description: 'Categoria não encontrada.' },
                    409: { description: 'Nome já cadastrado.' },
                    422: { description: 'Nome inválido.' },
                },
            },
        },
    });
    const clockHeader = { 'X-MyCity-Server-Time': { description: 'Instante de recebimento da consulta em milissegundos Unix.', schema: { type: 'integer', format: 'int64' } } };
    for (const { get } of Object.values(doc.paths)) {
        if (!get?.security || !get.responses[200]) continue;
        get.responses[200].headers = { ...get.responses[200].headers, ...clockHeader };
        get.responses[304] = { description: 'Conteúdo inalterado após revalidação.', headers: clockHeader };
    }
    return doc;
}
