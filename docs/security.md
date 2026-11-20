# Acesso restrito e uploads

O ambiente de demonstração aceita apenas as contas previamente provisionadas e autorizadas. O repositório é público e a aplicação exige autenticação.

Para entrar em contato sobre uma vulnerabilidade, siga o [procedimento de relato privado](../SECURITY.md).

## Acesso à aplicação

- A página de entrada/login pode ser pública. Dados e operações do painel exigem sessão válida e papel de gestor no backend; uma conta de cidadão não permite acessar a gestão.
- Denúncias, fotos, mapa e histórico exigem autenticação. As restrições de propriedade e de visibilidade por status são verificadas em cada operação.
- Adotar negação por padrão nas rotas de negócio. Rotas públicas são exceções explícitas, como login e saúde genérica do serviço.
- Papel e identidade vêm da sessão validada no servidor. Não confiar em campos enviados pelo cliente, URL, estado da interface ou ocultação de botões.
- Sessões expiram em 24 horas sem renovação automática. O logout revoga a sessão atual. A web usa cookie `HttpOnly`, `Secure` e `SameSite=Lax`. O Android usa Bearer salvo no armazenamento seguro do dispositivo.
- Senhas das contas de demonstração são fornecidas por configuração protegida, nunca pelo código público ou por exemplos de teste. O seed preserva credenciais existentes.
- Proteger o login contra tentativas repetidas e operações por cookie contra CSRF. Os limites da janela de 15 minutos e o cabeçalho de proteção da web estão no [contrato HTTP](api/contract.md).

A API aplica cotas por IP antes da leitura do corpo do login, da consulta de prontidão e da entrega da documentação habilitada. As cotas são independentes por processo. A implantação hospedada usa uma instância da API e dois proxies (Caddy e Nginx). Os limites e a resposta HTTP 429 estão no [contrato HTTP](api/contract.md).

## Recebimento e leitura de fotos

- Autenticar e autorizar o cidadão antes de processar multipart, decodificar imagens ou escrever arquivos de upload/staging. Uma tentativa sem permissão não pode deixar arquivos no servidor.
- Validar quantidade, tamanho, conteúdo real e dimensões no servidor, independentemente da compressão e das validações do app. A API exige de um a três JPEGs, até 5 MiB por foto, 1.600 px no maior lado e 16 MiB para o multipart completo.
- Gerar nomes e caminhos no servidor; não usar caminhos fornecidos pelo cliente nem executar arquivos recebidos.
- Armazenar fotos fora do diretório estático da web. Nginx não deve publicar livremente o volume de uploads.
- Servir fotos por uma rota que valide sessão, permissão e vínculo entre foto e denúncia. Conhecer ou adivinhar uma URL não concede acesso.
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

## Gate após cada fase

Rodar `npm run security:check` e as verificações funcionais aplicáveis, depois executar os agentes de `agents/readme.md`. A CI bloqueia publicação de imagens se o job `Security checks` falhar. O job verifica segredos no histórico/conteúdo e dependências; vulnerabilidades altas/críticas causam falha, enquanto as demais permanecem visíveis e precisam de triagem.

O Pentest Sol deve avaliar as fronteiras efetivamente implementadas, independentemente do autor da mudança. Luna e os QAs usam as personas fornecidas. Resultados bloqueantes devem ser corrigidos e reavaliados antes de avançar.
