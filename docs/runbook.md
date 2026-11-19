# Operação e roteiro de demonstração

Status: fundação local executável. Comandos verificados estão no [guia da raiz](../README.md) e resultados na [evidência](evidence/foundation.md). O roteiro de demonstração de denúncias abaixo continua planejado; login HTTP, atendimento e APK ainda não existem.

## Comandos disponíveis

```bash
npm ci
npm run setup
docker compose up -d --wait db
npm run db:migrate
npm run db:seed
docker compose up -d --build --wait api web
docker compose --profile test up -d --wait test-db
npm run check
```

A web local usa `http://localhost:8090`; API operacional em `/api/v1/health/live` e `/api/v1/health/ready`. Servidor, domínio e porta foram configurados conforme [CI/CD](ci-cd.md); a homologação do fluxo completo continua pendente. Testes usam `mycity_test` na porta 55433, separado de `mycity` na porta 55432. Os comandos não configuram uma publicação pública nem login com sessão.

## Informações necessárias

- Servidor: sistema/arquitetura, disponibilidade de Docker Compose, portas, recursos e proxy existente (C09).
- Domínio e certificado HTTPS, endereço público da API acessível pelo Android.
- Procedimento de assinatura/build do APK e armazenamento seguro das chaves (C10).
- Provedor de mapas/geocodificação e configuração de chaves, se necessárias (C02/C03).
- Ferramentas já fixadas: npm workspaces, Node 24, Vitest e Jest/Expo; C11 resolvido.

Não pedir nem registrar segredos nos documentos. Exemplos de configuração devem conter placeholders; arquivos locais com credenciais devem ficar fora do controle de versão.

## Configuração prevista

| Configuração                   | Finalidade                        | Visibilidade                                                    |
| ------------------------------ | --------------------------------- | --------------------------------------------------------------- |
| URL do PostgreSQL da aplicação | Conexão usada por Prisma          | Somente API/rotina de migração                                  |
| URL do PostgreSQL de teste     | Banco isolado para integração     | Somente ambiente de teste                                       |
| Origem pública da web          | Origem permitida e encaminhamento | Configuração do servidor                                        |
| URL pública da API             | Destino de requisições            | Pública; incluída no build do app                               |
| Diretório/volume de fotos      | Armazenamento durável             | Servidor                                                        |
| Credenciais de seed            | Contas de demonstração            | Operador e configuração protegida                               |
| Parâmetros de sessão           | Expiração e mecanismos escolhidos | Conforme C05; segredos nunca no bundle                          |
| Configuração de mapas          | Exibição/seleção/geocodificação   | Conforme provedor, com restrições próprias para chaves públicas |

As variáveis já utilizadas estão em `.env.example`; `npm run setup` cria `.env` local sem sobrescrever um existente. Sessão e mapas ainda não têm configuração implementada.

## Primeira execução local

1. Conferir versões e instalar dependências pelo lockfile do monorepo.
2. Preparar configuração local sem incluir credenciais no repositório.
3. Subir PostgreSQL e criar banco de teste separado.
4. Aplicar migrações versionadas; executar seed explicitamente.
5. Iniciar API, web e ambiente de desenvolvimento mobile.
6. Executar verificações de tipo/lint, unitários, integração e interfaces.
7. Validar o fluxo local antes da publicação no servidor.

Use os comandos da seção inicial para a fundação atual. Não usar sincronização destrutiva de schema como substituta de migrações no servidor de demonstração.

## Publicação no servidor

1. Conferir o alvo e preservar aplicações/proxy já existentes.
2. Preparar configuração e volumes para banco e imagens, sem publicar a porta do banco à internet.
3. Construir imagens e configurar proxy/HTTPS para web e API.
4. Fazer backup se já existirem dados; aplicar migrações explicitamente.
5. Executar seed idempotente apenas para preparar os dados necessários.
6. Iniciar serviços, conferir liveness/readiness e logs sem segredos.
7. Testar login, upload, leitura das fotos e transição de status pelo domínio público.
8. Gerar APK com essa URL; instalar em Android físico e repetir o fluxo fora da rede do servidor quando possível.

Compose sobe web/API/banco; não instala o aplicativo no celular. APK final não deve depender do bundler, IP de desenvolvimento ou nomes internos como `api`/`postgres`.

## Roteiro da apresentação

| Passo | Ação                                                | Evidência esperada                                         |
| ----- | --------------------------------------------------- | ---------------------------------------------------------- |
| 1     | Entrar como cidadão A                               | Identidade correta e nenhuma tela de cadastro.             |
| 2     | Criar denúncia com categoria, descrição e 1–3 fotos | Prévia, compressão e envio reais.                          |
| 3     | Capturar GPS ou selecionar ponto manual             | Coordenadas reais do ponto confirmado.                     |
| 4     | Abrir painel do gestor                              | Nova denúncia aparece por polling com fotos e localização. |
| 5     | Entrar como cidadão B e confirmar                   | Uma confirmação; repetição não aumenta contador.           |
| 6     | Gestor avança para Em análise e responde            | Histórico e resposta consultáveis.                         |
| 7     | Gestor avança Em andamento → Resolvido              | Sem salto; autor recebe avisos e vê estado final.          |
| 8     | Consultar e ler notificações como A                 | Leitura persiste e avisos não aparecem para B.             |
| 9     | Usar outra denúncia para cancelar                   | Some do feed/mapa e permanece para o autor.                |
| 10    | Usar outra denúncia para rejeitar                   | Exige justificativa em Em análise.                         |
| 11    | Abrir alertas climáticos                            | Três níveis claramente simulados, sem afirmar envio real.  |

Não tentar reabrir a denúncia resolvida para repetir a demonstração. Criar outra ou usar reset explícito apenas no ambiente correto. Preparar fotos apropriadas sem expor terceiros.

## Persistência, backup e recuperação

- Reiniciar ou recriar containers com os mesmos volumes deve preservar banco/fotos; validar isso antes da apresentação.
- Nunca remover volumes como rotina de atualização. Não incluir reset ou seed destrutivo no startup.
- Backup precisa de banco e volume de fotos em um ponto consistente. Para o MVP, pode ser feito com escritas pausadas durante a captura; registrar o procedimento real após implementação.
- Testar restauração em ambiente separado. Presença de arquivos de backup não comprova recuperação.
- Em falha de deploy, preservar logs e volumes; voltar à versão anterior somente se compatível com as migrações. Não prometer downgrade automático.
- Limpeza de staging/órfãos deve respeitar uploads em andamento. Guardar evidência do comportamento em T25.

## Diagnóstico operacional previsto

| Sintoma                  | Verificação inicial                                                      |
| ------------------------ | ------------------------------------------------------------------------ |
| App não conecta          | URL incluída no APK, DNS, certificado, conectividade e readiness da API. |
| Login falha só na web    | Origem, cookie, proxy/HTTPS e proteção CSRF; nunca registrar senha.      |
| Foto rejeitada           | Quantidade, conteúdo, dimensões, limite da API e limite do proxy.        |
| Foto some após recriação | Montagem do volume e correspondência com metadados.                      |
| Status não atualiza      | Tela ativa, sessão válida, polling e eventual conflito de versão.        |
| Mapa não aparece         | Provedor, chave/configuração de build, rede e erros do mapa.             |

Após existir código, substituir hipóteses pelos comandos e logs efetivos. Consultar [concerns](../concerns.md) e [testes](testing.md) antes de classificar a entrega como pronta.
