# Evidência da fundação

Execução local em 18/11/2026 (America/Sao_Paulo). Este registro distingue a fundação executável do MVP completo, que ainda não está implementado.

## Ambiente e decisões técnicas

- Node 24.22.0, npm 11.19.1 e npm workspaces com um lockfile.
- TypeScript 6.0.3 alinhado ao template Expo utilizado; Expo 58.0.26, React Native 0.88.1 e React 19.3.0.
- Express 5.3.0, Prisma 7.10.1 com adapter PostgreSQL; linha estável 7 escolhida enquanto `latest` apontava para Prisma 8 RC.
- PostgreSQL 17.7 em containers distintos para desenvolvimento e teste.
- Vite 8.3.8, Tailwind 4.3.5 e Button gerado pelo CLI shadcn.
- Vitest para contratos/API/web; Jest com jest-expo e React Native Testing Library para mobile. Runners distintos atendem ambientes distintos, sem duplicar suíte de uma mesma plataforma.
- ESLint limita imports entre módulos à interface pública e bloqueia infraestrutura de servidor nos clientes/contratos.

Referências técnicas consultadas: [monorepos Expo](https://docs.expo.dev/guides/monorepos/), [seeding Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding), [Vite](https://vite.dev/guide/). Versões efetivamente instaladas são registradas no lockfile, não inferidas das páginas.

## TDD observado

| Comportamento          | Falha inicial observada                                       | Resultado após implementação                                 |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| Localização            | 5 casos inválidos eram aceitos                                | 6 testes passam                                              |
| Transições             | 6 transições permitidas eram bloqueadas                       | 15 testes passam, incluindo proibições                       |
| Saúde HTTP             | Rotas retornavam 404                                          | 4 testes passam com banco real e conexão real indisponível   |
| Contas de demonstração | Verificação de credenciais retornava null para conta esperada | 3 testes passam, incluindo seed repetido sem trocar senha/ID |
| Botão web pendente     | Ausência de aria-busy e bloqueio                              | 1 teste passa, verificando bloqueio e liberação              |
| Botão mobile pendente  | Controle não ficava desabilitado                              | 1 teste passa, verificando bloqueio e liberação              |

O primeiro ensaio do teste mobile também revelou que a versão instalada da Testing Library exige `await render/rerender`; o uso da API foi corrigido mantendo as mesmas asserções. Em seguida foi observada a falha funcional do botão antes da implementação.

## Resultados

- `npm run check`: aprovado; lint, typecheck, 30 testes atuais e builds de contratos/API/web.
- `expo install --check`: dependências compatíveis.
- `npm run export:android -w @mycity/mobile`: bundle Android gerado.
- Migração de Identidade aplicada em PostgreSQL de desenvolvimento e no banco de teste.
- Imagens Docker de API, web, migração e seed construídas. API usa runtime separado das ferramentas de desenvolvimento.
- Migração e seed executados por Compose; seed executado duas vezes, sem duplicar as três contas.
- Containers de banco/API/web recriados sem remover volumes; os mesmos IDs/e-mails/papéis sobreviveram. Um marcador no volume de fotos sobreviveu e foi removido após o teste. Isso comprova o volume, não upload de fotos ainda inexistente.
- `postman request` contra `http://localhost:8090/api/v1/health/ready`: HTTP 200, uma asserção aprovada, com envio de eventos desativado. Repetido após recriação, também aprovado.
- O CLI Postman instalado não reconhece `postman status`; isso não impediu a requisição local, e nenhum workspace foi criado/publicado.
- Web aberta com Playwright/Chrome e inspecionada visualmente: [captura da tela inicial](foundation-web.png). Ainda não é o painel do gestor.
- Git inicializado em `main`, sem commit. `.env`, dependências e arquivos gerados estão ignorados.

## Limitações

- Não há sessão/login HTTP, upload, cadastro de denúncia, atendimento persistido ou notificações ainda.
- `canTransition` é uma regra pura; seu teste não comprova autorização nem transação de uma rota futura.
- `verifyCredentials` valida senha na interface interna de Identidade, sem emitir sessão.
- O seed atual provisiona somente contas. Dados de denúncia serão adicionados junto das respectivas operações e testes.
- Bundle Android não equivale a APK instalado. GPS/câmera/mapa ainda não foram implementados nem testados em dispositivo.
- Interface web atual é apenas a tela inicial de marca; o conceito do gestor ainda não foi implementado.
- Auditoria npm do workspace identificou 22 ocorrências moderadas transitivas de glob/minimatch na cadeia Expo/Jest; nenhuma alta/crítica nessa execução. Não foi usado `audit fix --force` nem downgrade incompatível. Acompanhar C25.

## Fechamento da etapa

- Runtime final da API verificado como usuário não root (uid 1000), sem Expo, Jest ou CLI Prisma instalados nessa imagem. Migração/seed usam a etapa de ferramentas separada.
- Padrão Prettier confirmado pelo responsável: printWidth 9999, tabWidth 4, singleQuote true, semi true, trailingComma all e endOfLine auto. Corrigida apenas a sintaxe JSON durante a edição; preferências preservadas.
- Após aplicar o padrão, `npm run check` passou novamente (30 testes, lint, typecheck e builds), assim como `npm run format:check`.
- Serviços locais permaneceram disponíveis em `http://localhost:8090`. Nenhum commit, push ou deploy público foi realizado.
