# Concerns — problemas conhecidos e decisões pendentes

Revisado em 19/11/2026 para o aceite local das etapas 0–5. O [plano](plan.md#aceite-da-entrega-hospedada) reúne os itens da entrega hospedada.

## Pendências

| ID  | Situação                            | Problema e impacto                                                                                                                  | Tratamento proposto / condição de encerramento                                                                                                                                   |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 | Refinado e verificado localmente    | O conceito v2 orientou fila e detalhes do gestor, com adaptação a telas estreitas.                                                  | Foco, estados e navegação conferidos na etapa 5.                                                                                                                                 |
| C02 | Parcial, APK pendente               | Google Maps e seleção manual implementados; negativos de GPS e seleção exercitados em componente.                                   | Em aparelho com o APK de entrega, confirmar chave, marcador, permissões e persistência das coordenadas.                                                                          |
| C03 | Adiado pelo responsável             | Coordenadas de GPS ou seleção manual identificam o ponto da ocorrência.                                                             | Nesta fase os filtros usam categoria e status. Região, bairro e geocodificação foram adiados.                                                                                    |
| C04 | Aprovado e implementado             | Visibilidade e identificação por denúncia.                                                                                          | Ativos no feed e mapa; resolvidos por filtro e histórico; rejeitados por link autenticado; cancelados apenas autor e gestor. Autor anônimo permanece oculto inclusive na gestão. |
| C05 | Implementado localmente             | Sessões de 24 horas, revogação e expiração exercitadas em HTTP e nos clientes.                                                      | Conferir cookie Secure e armazenamento seguro no percurso do APK/HTTPS.                                                                                                          |
| C06 | Parcial, legibilidade pendente      | JPEG com maior lado de 1.600 px, até 5 MiB cada e 16 MiB por envio aprovados.                                                       | Registrar orientação e legibilidade após captura real, compressão e exibição no destino.                                                                                         |
| C07 | Aprovado e implementado             | Comprimento dos textos de denúncia e atendimento.                                                                                   | Descrição de até 1.000 caracteres, resposta e justificativa de até 2.000 após trim. Texto vazio é inválido.                                                                      |
| C08 | Aprovado e implementado             | Participação e respostas após encerramento.                                                                                         | Gestor pode responder em qualquer estado. A contagem de confirmações fica congelada após resolução, rejeição ou cancelamento.                                                    |
| C09 | Configurado; verificar cada release | EC2 Debian x86_64, Docker e proxy identificados; domínio `mycity.private-gateway.site`, porta HTTPS 8080 e `/opt/mycity` definidos. | CD usa imagens por SHA e chave exclusiva. Estado da implantação e configuração em `docs/ci-cd.md`; aplicação completa ainda não homologada.                                      |
| C10 | Assinatura decidida                 | APK de release assinado localmente com chave exclusiva do app.                                                                      | Validar certificado, mapa e jornada no Galaxy M32 com a API hospedada.                                                                                                           |
| C11 | Resolvido na fundação               | Workspace, lockfile e ferramentas agora existem.                                                                                    | npm workspaces, Node 24, TypeScript 6, Prisma 7 estável, Vitest e Jest/Expo configurados. Typecheck, builds e 30 testes passaram; ver evidência da fundação.                     |
| C12 | Decidido para homologação           | Contas fictícias, imagens sem pessoas identificáveis e pontos públicos, sob a visibilidade vigente.                                 | Identificar registros e anexos do ensaio e removê-los após o aceite, preservando os dados preexistentes.                                                                         |
| C13 | Verificado localmente               | Staging, compensação e reconciliação offline cobertos pela integração.                                                              | Aplicar o procedimento do runbook ao volume correspondente antes de remover resíduos.                                                                                            |
| C14 | Verificado localmente               | Cancelamento e atendimento podem disputar a mesma versão. Confirmações podem coincidir com encerramento.                            | As operações bloqueiam a mesma denúncia, transições conferem versão e a chave denúncia/cidadão garante unicidade. Testes de concorrência em PostgreSQL verificam os efeitos.     |
| C15 | Verificado localmente               | Criação e atendimento aceitam repetição idempotente e recusam conflito de payload.                                                  | Preservar os testes de reenvio concorrente, resposta perdida e histórico único.                                                                                                  |
| C16 | Verificado nos clientes locais      | Polling a cada cinco segundos, pausa e descarte das respostas obsoletas exercitados nos testes dos clientes.                        | Verificar o ciclo real de segundo plano ao homologar o APK.                                                                                                                      |
| C17 | Verificado em cópia local           | Seed repetido, recriação, backup e restauração preservaram os registros e as fotos.                                                 | Validar o procedimento do destino na etapa 6.                                                                                                                                    |
| C18 | Parcial por ambiente                | Suítes de contratos, clientes, ferramentas e integração com PostgreSQL exercitam as jornadas locais.                                | A matriz por critério em [testing.md](docs/testing.md) identifica o que depende do destino.                                                                                      |

| ID  | Situação | Problema e impacto                                                                                  | Tratamento proposto / condição de encerramento                                                                                                                         |
| --- | -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C25 | Aberto   | Auditoria npm encontrou 22 ocorrências moderadas transitivas de glob/minimatch na cadeia Expo/Jest. | Acompanhar versões compatíveis e revalidar; não aplicar downgrade ou override incompatível apenas para zerar auditoria. Nenhuma alta/crítica na última execução local. |

## Atualização da etapa 2

- C02/C03: Google Maps no Android e confirmação por coordenadas GPS ou manuais. Endereço, bairro e filtro regional ficam para outra entrega.
- C05/C27/C31: sessões e acesso protegido implementados. As contas legadas ficam desabilitadas até a rotação explícita. As três contas do Compose local foram rotacionadas e verificadas em 19/11/2026. A rotação na demonstração hospedada continua pendente.
- C06/C07: aprovados JPEG com maior lado de 1.600 px, 5 MiB por foto, 16 MiB por envio e descrição até 1.000 caracteres. Na etapa 3 foram aprovados até 2.000 caracteres após trim para respostas e justificativas.
- C13/C15: reenvio concorrente e falhas de publicação cobertos por testes. Reconciliação de órfãos disponível no [runbook](docs/runbook.md#reconciliação-offline-das-fotos).
- C04/C08: matriz de visibilidade aprovada na etapa 4. Nos estados finais o gestor pode responder e as confirmações ficam congeladas. O descarte dos dados do ensaio segue C12.

## Diferenças já decididas

| ID  | Situação         | Diferença                                                                                                                         |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| C19 | Recorte aprovado | RF01: só login real, sem cadastro ou recuperação; seed com dois cidadãos e um gestor.                                             |
| C20 | Recorte aprovado | RF10/RF11/RF13: alertas climáticos simulados; sem integração, segmentação emergencial real ou painel operacional da Defesa Civil. |
| C21 | Recorte aprovado | RF17: gestor atende todas as regiões, sem restrição regional.                                                                     |
| C22 | Recorte aprovado | RF16: avaliação do atendimento fica fora da entrega.                                                                              |
| C23 | Recorte aprovado | RNF05: Android é o alvo homologado; React Native não comprova funcionamento em iOS.                                               |
| C24 | Recorte aprovado | RNF03/RNF04: sem promessa de entrega emergencial em um minuto ou disponibilidade 24/7.                                            |

## Inconsistências das fontes

- UC01 tem rastreabilidade diferente no quadro geral e no detalhamento. A especificação do MVP associa autenticação a RF01/RF12 e proteção de credenciais; o original permanece intacto.
- UC02 exigia permissão de GPS e também previa ajuste manual. A decisão aprovada aceita captura automática **ou** seleção manual, inclusive após permissão negada.
- Escopo cita seis categorias; o wireframe mostra três. A implementação deverá oferecer as seis, sem deduzir corte funcional a partir do desenho.
- RF08 diz “todas as denúncias”; UC08 retira canceladas do mapa. O recorte mantém essa retirada e exige uma matriz para os demais estados (C04).
- RF17 restringia o gestor, enquanto UC12 previa histórico público. O recorte de todas as regiões resolve a restrição, mas não define acesso anônimo (C04).
- As personas cobrem cidadãos, não a rotina do gestor. `docs/flows.md` descreve as tarefas aprovadas do gestor sem inventar uma persona pesquisada.

## Manutenção

Ao resolver um item, registrar decisão, documento alterado e evidência de verificação quando houver código. Não remover o histórico de diferenças aprovadas. Revisar este arquivo antes de iniciar cada etapa do [plano](plan.md).

## Auditoria de segredos

**C26 — Mitigação aplicada:** dois artefatos públicos de diagnóstico Docker continham metadados transitórios de autenticação do Docker Hub. Foram removidos. Nenhuma credencial própria do MyCity foi encontrada no histórico, logs, imagens ou artefatos auditados. O upload automático desses diagnósticos foi desativado no workflow e recebeu teste de regressão.

## Acesso restrito à demonstração

**C27 — Acesso restrito implementado e exercitado em ambiente local:** somente contas provisionadas podem usar dados e operações protegidos; apenas gestor acessa a gestão. Autenticar e autorizar antes de processar uploads. Rotas de negócio seguem negação por padrão, fotos não ficam em diretório estático público e a API não confia no papel enviado pelo cliente. Limites implementados no login e no upload estão descritos no contrato. Ver `docs/security.md`, AC19 e T30–T32.

## Revisão independente por fase

**C28 — Segurança da hospedagem.** A preparação local separa os privilégios da API dos de migração (SEC-02) e vincula o deploy aos digests da CI, com bloqueio de execuções antigas (SEC-03). Falta exercitar os dois controles no destino. Conferir a rotação das contas e o tratamento de uploads nos proxies do destino (SEC-01 e SEC-04). O custo da consulta de prontidão segue aberto (SEC-05). Os controles do runner e do contexto de build foram revalidados localmente (SEC-06 e SEC-07).

**C29 — Gate obrigatório:** Sol e Luna são acionados após cada fase; QAs de interface/integração seguem a superfície alterada e as personas fornecidas. O scanner e a auditoria de dependências executam na CI, separados da avaliação dos modelos. Consulte `agents/readme.md`.

**C30 — Firewall aplicado:** UFW e DOCKER-USER restringem novas entradas à lista autorizada pelo responsável; SSH/HTTPS/serviços existentes e reload foram verificados. UDP sem handshake, IPv6 externo e reboot não foram ensaiados.

**C31 — Modelo e autenticação HTTP verificados no ambiente local:** User agora usa CPF, password (hash), modifiedAt e snake_case no banco. A migração preserva IDs/hashes das contas conhecidas e rejeita contas sem mapeamento. O seed agora exige senhas distintas. A rotação explícita foi verificada no banco de testes e aplicada às três contas locais.

**Revisão visual do frontend.** Os percursos demonstrativos foram exercitados no navegador e no Galaxy M32. O responsável aceitou o novo painel, integrado à API em 20/11. A troca de categoria sob latência preservou o total anterior até chegar o novo resultado.

## Pendências para retomada

- **Composição da release da etapa 6.** O checkout de preparação contém migrações novas para arquivamento e ícone da categoria, usadas pela API. Incluir ambas ao fixar a revisão para publicação.

- **Paginação da fila de gestão.** O teste da segunda página espera HTTP 200. Na reprodução em PostgreSQL, a primeira página retornou uma denúncia de outra suíte. O registro foi removido entre as leituras e a segunda página retornou 400 `INVALID_CURSOR`. O cenário passou a usar uma categoria exclusiva, confere os IDs das duas páginas e exige o encerramento da lista.
- **Anexos da demonstração persistente.** A inspeção local encontrou seis anexos antigos: cinco com 74 px de largura e um com 278 px. As prévias já usam as fotografias novas. O seed preserva exemplos publicados e seu histórico. Substituir esses seis arquivos no ambiente existente depende de autorização específica.
- **Android físico.** O percurso integrado no Galaxy M32 cobriu câmera, galeria, GPS, seleção manual, retomada, leitura do atendimento e envio para a API local. O APK independente e a API hospedada pertencem à etapa 6.

- **Volume da exportação hospedada.** O CSV da gestão é produzido integralmente em memória. A revisão defensiva aprovou a demonstração local. Antes de operar com grande volume, medir o custo de exportações simultâneas e definir o limite operacional ou a geração incremental.
