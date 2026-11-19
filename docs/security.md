# Acesso restrito e uploads

Diretriz confirmada pelo responsável: o repositório público não torna a aplicação de acesso livre. O ambiente de demonstração aceita apenas as contas previamente provisionadas e autorizadas; não há cadastro público.

## Acesso à aplicação

- A página de entrada/login pode ser pública. Dados e operações do painel exigem sessão válida e papel de gestor no backend; uma conta de cidadão não permite acessar a gestão.
- Denúncias, fotos, mapa e histórico exigem autenticação. As restrições de propriedade e de visibilidade por status são verificadas em cada operação.
- Adotar negação por padrão nas rotas de negócio. Rotas públicas são exceções explícitas, como login e saúde genérica do serviço.
- Papel e identidade vêm da sessão validada no servidor. Não confiar em campos enviados pelo cliente, URL, estado da interface ou ocultação de botões.
- Sessões expiram em 24 horas sem renovação automática; logout revoga imediatamente. Token ausente, inválido, expirado ou revogado não autoriza operações.
- Senhas das contas de demonstração são fornecidas por configuração protegida, nunca pelo código público ou por exemplos de teste. O seed preserva credenciais existentes.
- Proteger o login contra tentativas repetidas e operações por cookie contra CSRF. Os parâmetros concretos serão especificados antes da implementação correspondente.

## Recebimento e leitura de fotos

- Autenticar e autorizar o cidadão antes de processar multipart, decodificar imagens ou escrever arquivos de upload/staging. Uma tentativa sem permissão não pode deixar arquivos no servidor.
- Validar quantidade, tamanho, conteúdo real e dimensões no servidor, independentemente da compressão e das validações do app. Os limites ainda pendentes em C06 devem ser fechados antes do endpoint.
- Gerar nomes e caminhos no servidor; não usar caminhos fornecidos pelo cliente nem executar arquivos recebidos.
- Armazenar fotos fora do diretório estático da web. Nginx não deve publicar livremente o volume de uploads.
- Servir fotos por uma rota que valide sessão, permissão e vínculo entre foto e denúncia. Conhecer ou adivinhar uma URL não concede acesso.
- Definir limites de frequência e consumo para uploads de contas válidas, além do limite por requisição. Esses parâmetros permanecem pendentes; autenticação não substitui controle de armazenamento.

## Verificação obrigatória antes de publicar essas funcionalidades

Testar pela API e pelas interfaces dos clientes:

1. Sem sessão ou com sessão inválida/expirada/revogada: nenhum acesso a dados protegidos ou upload persistido.
2. Cidadão tentando acessar listagem administrativa, publicar resposta do gestor ou alterar status: acesso negado, sem efeitos.
3. Alteração de IDs e acesso direto à URL de foto: permissões continuam aplicadas.
4. Upload com quantidade, tipo ou tamanho inválido: rejeição sem denúncia parcial ou arquivo acessível.
5. Dados, senhas e tokens não aparecem em respostas indevidas, bundles, logs ou mensagens de erro.

Os cenários são detalhados em `docs/testing.md`. Não considerar a proteção entregue apenas por existirem telas de login, documentação ou bloqueios no frontend.

## Estado atual

A implementação atual da API contém apenas rotas de saúde e resposta para rota inexistente. Ainda não há endpoints de upload, sessão ou gestão. As regras acima são requisitos para a próxima implementação, não uma declaração de que a autorização já foi concluída.

Identidade aprovada: CPF e senha próprios, sem gov.br e sem e-mail. Nome/foto só aparecem quando o autor mantém “Quero mostrar minha cara” marcado. Desmarcado, os DTOs omitem identidade e identificadores inclusive ao gestor; o backend ainda conhece o autor para permissões. Swagger fica indisponível em produção até haver acesso administrativo próprio.

## Gate após cada fase

Rodar `npm run security:check` e as verificações funcionais aplicáveis, depois executar os agentes de `agents/readme.md`. A CI bloqueia publicação de imagens se o job `Security checks` falhar. O job verifica segredos no histórico/conteúdo e dependências; vulnerabilidades altas/críticas causam falha, enquanto as demais permanecem visíveis e precisam de triagem.

O Pentest Sol deve avaliar as fronteiras efetivamente implementadas, independentemente do autor da mudança. Luna e os QAs usam as personas fornecidas. Resultados bloqueantes devem ser corrigidos e reavaliados antes de avançar. A primeira revisão está em `docs/evidence/qa/foundation-security-review.md`.
