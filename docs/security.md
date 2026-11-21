# Acesso restrito e uploads

O ambiente de demonstração aceita apenas as contas previamente provisionadas e autorizadas. O repositório é público e a aplicação exige autenticação.

Para entrar em contato sobre uma vulnerabilidade, siga o [procedimento de relato privado](../SECURITY.md).

## Acesso à aplicação

- A página de entrada/login pode ser pública. Dados e operações do painel exigem sessão válida e papel de gestor no backend; uma conta de cidadão não permite acessar a gestão.
- Denúncias, fotos, mapa e histórico exigem autenticação. As restrições de propriedade e de visibilidade por status são verificadas em cada operação.
- Adotar negação por padrão nas rotas de negócio. Rotas públicas são exceções explícitas, como login e saúde genérica do serviço.
- Papel e identidade vêm da sessão validada no servidor. Não confiar em campos enviados pelo cliente, URL, estado da interface ou ocultação de botões.
- Sessões expiram em 24 horas sem renovação automática. O logout revoga a sessão atual e pede ao navegador, com `Clear-Site-Data: "cache"`, que apague o cache HTTP do domínio; um 401 para uma sessão apresentada e inválida faz o mesmo. Leituras da API só ficam no cache do navegador para revalidação (`private, no-cache` com ETag), e o painel guarda as últimas leituras apenas em memória, durante a sessão do gestor, sem `localStorage` nem IndexedDB. A web usa cookie `HttpOnly`, `Secure` e `SameSite=Lax`. O Android usa Bearer salvo no armazenamento seguro do dispositivo. As fotos das denúncias ficam no cache de disco do `expo-image` (sandbox do app) e são apagadas, com o cache de memória, ao sair e quando a sessão expira. As leituras do próprio cidadão (os próprios registros, o detalhe e o histórico das próprias denúncias, notificações, alertas e categorias) ficam em arquivo no diretório de cache do app, por até 7 dias e separadas por usuário, para a tela abrir com conteúdo; feed, mapa, resolvidas da cidade e denúncias de outras pessoas não são gravados. O arquivo é apagado ao sair, quando a sessão expira e quando a API responde 403 ou 404.
- Senhas das contas de demonstração são fornecidas por configuração protegida, nunca pelo código público ou por exemplos de teste. O seed preserva credenciais existentes.
- Proteger o login contra tentativas repetidas e operações por cookie contra CSRF. Os limites da janela de 15 minutos e o cabeçalho de proteção da web estão no [contrato HTTP](api/contract.md).

A API aplica cotas por IP antes da leitura do corpo do login, da consulta de prontidão e da entrega da documentação habilitada. As cotas são independentes por processo. A implantação hospedada usa uma instância da API e dois proxies (Caddy e Nginx). Os limites e a resposta HTTP 429 estão no [contrato HTTP](api/contract.md).

Os diagnósticos do Caddy preservam o método e o caminho da requisição. O log de acesso do Nginx também registra os status e a duração. Ambos omitem os parâmetros de consulta e o cabeçalho `Referer`. Em `/api/`, o status do proxy no registro de acesso permite identificar falhas de encaminhamento sem registrar o diagnóstico bruto do Nginx que contém a URL original.

## Recebimento e leitura de fotos

- Autenticar e autorizar o cidadão antes de processar multipart, decodificar imagens ou escrever arquivos de upload/staging. Uma tentativa sem permissão não pode deixar arquivos no servidor.
- Validar quantidade, tamanho, conteúdo real e dimensões no servidor, independentemente da compressão e das validações do app. A API exige de um a três JPEGs, até 5 MiB por foto, 1.600 px no maior lado e 16 MiB para o multipart completo.
- Gerar nomes e caminhos no servidor; não usar caminhos fornecidos pelo cliente nem executar arquivos recebidos.
- Armazenar fotos fora do diretório estático da web. Nginx não deve publicar livremente o volume de uploads.
- Servir fotos por uma rota que valide sessão, permissão e vínculo entre foto e denúncia. Conhecer ou adivinhar uma URL não concede acesso.
- Foto e miniatura saem com `Cache-Control: private, max-age=31536000, immutable`: o navegador guarda a imagem depois que a autorização foi conferida, e nenhum cache compartilhado pode armazená-la. O ID de uma foto nunca muda de conteúdo. O logout limpa esse cache com `Clear-Site-Data` (C40). O Safari só cumpre isso em parte, mas o painel não é usado em Safari nem iPad (confirmado pelo responsável em 20/11/2026). Requisições do app (`Bearer`) recebem `no-store` em leituras e fotos, porque o cache HTTP do Android não atende `Clear-Site-Data`: o app guarda os próprios ETags, e as fotos ficam só no cache do `expo-image`, apagado ao sair.
- A API limita cada cidadão a 30 tentativas de upload por janela de 15 minutos. Compartilha quatro vagas simultâneas por processo e exige 320 MiB disponíveis antes de gravar um novo conjunto de fotos. O valor inclui 256 MiB de reserva e até 16 MiB para cada vaga.

## Verificação obrigatória antes de publicar essas funcionalidades

Testar pela API e pelas interfaces dos clientes:

1. Sem sessão ou com sessão inválida/expirada/revogada: nenhum acesso a dados protegidos ou upload persistido.
2. Cidadão tentando acessar listagem administrativa, publicar resposta do gestor ou alterar status: acesso negado, sem efeitos.
3. Alteração de IDs e acesso direto à URL de foto: permissões continuam aplicadas.
4. Upload com quantidade, tipo ou tamanho inválido: rejeição sem denúncia parcial ou arquivo acessível.
5. Dados, senhas e tokens não aparecem em respostas indevidas, bundles, logs ou mensagens de erro.

Os cenários são detalhados em `docs/testing.md`. Não considerar a proteção entregue apenas por existirem telas de login, documentação ou bloqueios no frontend.

## Estado atual

Sessão, criação de denúncia, consulta do gestor e leitura de fotos foram verificadas localmente. A validação inclui origem e cabeçalho para mutações com cookie, papel antes do multipart no backend e leitura da foto por vínculo com a denúncia.

O login usa CPF e senha próprios. Nome e foto de perfil aparecem quando o autor mantém “Quero mostrar minha cara” marcado. Se desmarcar, os DTOs omitem os dados do autor, inclusive para o gestor. O backend mantém o vínculo interno para permissões e notificações. Swagger e OpenAPI são habilitados somente em desenvolvimento com `API_DOCS_ENABLED=true`, quando a API escuta em loopback. [Contrato e configuração do Swagger](api/contract.md#swagger-gerado)

## Revisão antes de uma versão

Rode `npm run security:check` e as verificações funcionais aplicáveis. O workflow de release refaz a varredura de segredos e a auditoria antes de publicar imagens: segredos no histórico ou no conteúdo e vulnerabilidades altas ou críticas bloqueiam a versão; as demais ficam visíveis para triagem.

Antes de criar a tag, o revisor `security-reviewer` avalia as fronteiras alteradas, independentemente do autor da mudança, e o `regression-reviewer` repete as jornadas das personas. Achados bloqueantes são corrigidos e reavaliados antes da tag.
