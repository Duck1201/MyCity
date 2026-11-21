# Acesso restrito e uploads

O ambiente de demonstração aceita apenas as contas previamente provisionadas e autorizadas. O repositório é público e a aplicação exige autenticação.

Para entrar em contato sobre uma vulnerabilidade, siga o [procedimento de relato privado](../SECURITY.md).

## Acesso à aplicação

- A página de entrada/login pode ser pública. Dados e operações do painel exigem sessão válida e papel de gestor no backend; uma conta de cidadão não permite acessar a gestão.
- Denúncias, fotos, mapa e histórico exigem autenticação. As restrições de propriedade e de visibilidade por status são verificadas em cada operação.
- Adotar negação por padrão nas rotas de negócio. Rotas públicas são exceções explícitas, como login e saúde genérica do serviço.
- Papel e identidade vêm da sessão validada no servidor. Não confiar em campos enviados pelo cliente, URL, estado da interface ou ocultação de botões.
- Sessões expiram em 24 horas sem renovação automática. O logout revoga a sessão e envia `Clear-Site-Data: "cache"` para o navegador apagar o cache HTTP do domínio. Um 401 para uma sessão apresentada e inválida faz o mesmo. As leituras de negócio do painel ficam no cache HTTP para revalidação (`private, no-cache` com ETag). O cache mantido pelo painel fica em memória durante a sessão do gestor. O painel usa cookie `HttpOnly`, `Secure` e `SameSite=Lax`. O Android usa Bearer em armazenamento seguro, enquanto a prévia web do cidadão guarda a sessão em memória.
- No Android, fotos de denúncias usam o cache do `expo-image`. A saída e a expiração da sessão acionam a limpeza desse cache em disco e em memória. O app restaura do diretório de cache, por usuário, as leituras com até sete dias dos próprios registros, detalhes, históricos e das listas de notificações, alertas e categorias. Feed, mapa, resolvidas da cidade e registros de outros cidadãos ficam fora desse arquivo. O app solicita sua remoção ao sair, quando a sessão expira ou quando a API responde 403 ou 404.
- Senhas das contas de demonstração são fornecidas por configuração protegida, nunca pelo código público ou por exemplos de teste. O seed preserva credenciais existentes.
- Proteger o login contra tentativas repetidas e operações por cookie contra CSRF. Os limites da janela de 15 minutos e o cabeçalho de proteção da web estão no [contrato HTTP](api/contract.md).

A API aplica cotas por IP antes da leitura do corpo do login, da consulta de prontidão e da entrega da documentação habilitada. As cotas são independentes por processo. A implantação hospedada usa uma instância da API e dois proxies (Caddy e Nginx). Os limites e a resposta HTTP 429 estão no [contrato HTTP](api/contract.md).

Na implantação, a API usa o papel PostgreSQL restrito `mycity_api`. Na edição, esse papel pode substituir as linhas de `report_photos` dentro da mesma transação que atualiza a denúncia. A autorização continua sendo verificada pelo servidor antes de alterar os vínculos.

O Nginx aplica ao painel uma CSP que carrega scripts e fontes da mesma origem e permite imagens da mesma origem ou incorporadas como dados. Estilos inline atendem à galeria e ao redimensionamento da navegação. A política bloqueia objetos, alteração de URL base e incorporação em frames. Também envia `X-Frame-Options: DENY` e `Referrer-Policy: strict-origin-when-cross-origin`, inclusive nas respostas de erro.

Os diagnósticos do Caddy preservam o método e o caminho da requisição. O log de acesso do Nginx também registra os status e a duração. Ambos omitem os parâmetros de consulta e o cabeçalho `Referer`. Em `/api/`, o status do proxy no registro de acesso permite identificar falhas de encaminhamento sem registrar o diagnóstico bruto do Nginx que contém a URL original.

## Recebimento e leitura de fotos

- Autenticar e autorizar o cidadão antes de processar multipart, decodificar imagens ou escrever arquivos de upload/staging. Na edição, validar autoria e ausência de atendimento antes do upload e novamente sob bloqueio da denúncia antes de gravar. Uma tentativa sem permissão não pode deixar arquivos no servidor.
- Validar quantidade, tamanho, conteúdo real e dimensões no servidor, independentemente da compressão e das validações do app. O resultado da publicação ou edição exige de um a três JPEGs, até 5 MiB por foto, 1.600 px no maior lado e 16 MiB para o multipart completo.
- Gerar nomes e caminhos no servidor; não usar caminhos fornecidos pelo cliente nem executar arquivos recebidos.
- Armazenar fotos fora do diretório estático da web. Nginx não deve publicar livremente o volume de uploads.
- Servir fotos por uma rota que valide sessão, permissão e vínculo entre foto e denúncia. Conhecer ou adivinhar uma URL não concede acesso.
- Foto e miniatura usam `Cache-Control: private, no-cache` no navegador para revalidar a autorização e o prazo de retenção antes do reúso. O logout limpa esse cache com `Clear-Site-Data` (C40). O Safari só cumpre isso em parte, mas o painel não é usado em Safari nem iPad (confirmado pelo responsável em 20/11/2026). Requisições do app (`Bearer`) recebem `no-store` em leituras e fotos, porque o cache HTTP do Android não atende `Clear-Site-Data`: o app guarda os próprios ETags, e as fotos ficam só no cache do `expo-image`, apagado ao sair.
- A API limita cada cidadão a 30 tentativas de upload por janela de 15 minutos. Compartilha quatro vagas simultâneas por processo e exige 320 MiB disponíveis antes de gravar um novo conjunto de fotos. O valor inclui 256 MiB de reserva e até 16 MiB para cada vaga.

## Verificação obrigatória antes de publicar essas funcionalidades

Testar pela API e pelas interfaces dos clientes:

1. Sem sessão ou com sessão inválida/expirada/revogada: nenhum acesso a dados protegidos ou upload persistido.
2. Cidadão tentando acessar listagem administrativa, publicar resposta do gestor ou alterar status: acesso negado, sem efeitos.
3. Alteração de IDs e acesso direto à URL de foto: permissões continuam aplicadas.
4. Upload com quantidade, tipo ou tamanho inválido: rejeição sem denúncia parcial ou arquivo acessível.
5. Dados, senhas e tokens não aparecem em respostas indevidas, bundles, logs ou mensagens de erro.

Os cenários são detalhados na [estratégia de testes](testing.md). Não considerar a proteção entregue apenas por existirem telas de login, documentação ou bloqueios no frontend.

## Estado atual

Sessão, criação de denúncia, consulta do gestor e leitura de fotos foram verificadas localmente. A validação inclui origem e cabeçalho para mutações com cookie, papel antes do multipart no backend e leitura da foto por vínculo com a denúncia.

O login usa CPF e senha próprios. Nome e foto de perfil aparecem quando o autor mantém “Quero mostrar minha cara” marcado. Se desmarcar, os DTOs omitem os dados do autor, inclusive para o gestor. O backend mantém o vínculo interno para permissões e notificações. Swagger e OpenAPI são habilitados somente em desenvolvimento com `API_DOCS_ENABLED=true`, quando a API escuta em loopback. [Contrato e configuração do Swagger](api/contract.md#swagger-gerado)

## Revisão antes de uma versão

Rode `npm run security:check` e as verificações funcionais aplicáveis. O workflow de release refaz a varredura de segredos e a auditoria antes de publicar imagens: segredos no histórico ou no conteúdo e vulnerabilidades altas ou críticas bloqueiam a versão; as demais ficam visíveis para triagem.

Antes de criar a tag, use os revisores indicados no [AGENTS.md](../AGENTS.md#fluxo-de-uma-mudança). O revisor de segurança avalia as fronteiras alteradas independentemente do autor da mudança, e o de regressão repete as jornadas das personas. Achados bloqueantes são corrigidos e reavaliados antes da tag.
