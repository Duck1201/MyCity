# Concerns — problemas conhecidos e decisões pendentes

Atualizado em 18/11/2026. O projeto tem documentação e fundação executável; o fluxo completo do MVP ainda não foi implementado. Evidências locais estão em `docs/evidence/foundation.md`. Este registro reúne lacunas conhecidas, riscos de implementação e diferenças deliberadas em relação às fontes.

**Aberto**: exige definição ou evidência. **Mitigação especificada**: há um tratamento documentado, mas falta implementá-lo e verificá-lo. **Recorte aprovado**: divergência intencional, não um bug. Nenhum item é considerado resolvido apenas por existir documentação.

## Pendências

| ID  | Situação               | Problema e impacto                                                                                                     | Tratamento proposto / condição de encerramento                                                                                                                                                            |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 | Em refinamento         | Conceitos próprios foram gerados; o responsável considerou a versão 2 do gestor uma direção válida, mas ainda simples. | Usar `mycity-gestor-v2.png` como direção, não layout final; refinar composição, tipografia e estados no frontend. Não depender de novas referências externas.                                             |
| C02 | Aberto                 | Mapas e seleção manual dependem de biblioteca, provedor, chave e compatibilidade com APK.                              | Escolher integração e validar mapa, marcador e permissões em Android real; requisito bloqueia a fatia de localização.                                                                                     |
| C03 | Aberto                 | GPS fornece coordenadas; não define bairro/região nem endereço. O filtro regional depende dessa classificação.         | Proposta: geocodificação como fronteira externa e região opcional; falha não impede denúncia válida. Aprovar tratamento de “região não identificada” antes do contrato final.                             |
| C04 | Aberto                 | “Público” não esclarece acesso sem login, exposição do autor e visibilidade de rejeitadas/resolvidas.                  | Aprovar matriz proposta em `docs/flows.md`; canceladas já devem sair do feed/mapa e permanecer para o autor.                                                                                              |
| C05 | Aberto                 | Mecanismo de sessão, expiração e transporte de credenciais não foram escolhidos.                                       | Revisar proposta em `docs/api/contract.md`; confirmar antes de implementar Identidade.                                                                                                                    |
| C06 | Aberto                 | Compressão de 80% não garante limite em bytes; formato original pode ter orientação/metadata.                          | Proposta: JPEG de até 5 MiB cada, até 16 MiB por requisição, maior lado até 1.600 px. Validar qualidade visual, remoção de metadata e limites coordenados cliente/API/proxy. Valores ainda não aprovados. |
| C07 | Aberto                 | Limites de descrição, resposta e justificativa ainda não definidos.                                                    | Propostas: descrição até 1.000 caracteres; resposta/justificativa até 2.000; não aceitar texto apenas em branco. Revisar antes de congelar schemas.                                                       |
| C08 | Aberto                 | Retirada de confirmação e publicação de respostas depois do encerramento não têm regra aprovada.                       | Proposta: encerrar ambas as ações nos estados finais, preservando histórico e confirmações existentes; discutir antes da implementação correspondente.                                                    |
| C09 | Aberto                 | Domínio, proxy, HTTPS, arquitetura e recursos do servidor desconhecidos.                                               | Responsável informa ambiente; validar HTTPS e conectividade pelo celular fora da rede local antes da entrega.                                                                                             |
| C10 | Aberto                 | Build/assinatura do APK e credenciais necessárias não configurados.                                                    | Definir build local ou serviço Expo, guardar chave fora do repositório e testar APK independente do servidor de desenvolvimento.                                                                          |
| C11 | Resolvido na fundação  | Workspace, lockfile e ferramentas agora existem.                                                                       | npm workspaces, Node 24, TypeScript 6, Prisma 7 estável, Vitest e Jest/Expo configurados. Typecheck, builds e 30 testes passaram; ver evidência da fundação.                                              |
| C12 | Aberto                 | Fotos/GPS reais podem conter dados pessoais apesar de contas fictícias.                                                | Definir conteúdo permitido na demonstração, visibilidade, descarte e retenção. Não registrar senhas/tokens/fotos em logs. Isso não equivale a auditoria ou declaração de conformidade legal.              |
| C13 | Mitigação especificada | Banco e sistema de arquivos não compartilham transação; falha pode deixar fotos órfãs ou denúncia incompleta.          | Protocolo de staging e compensação em `docs/architecture.md`; provar falhas com testes de integração e verificar limpeza após interrupção.                                                                |
| C14 | Mitigação especificada | Gestor pode avançar o status simultaneamente ao cancelamento; confirmações podem duplicar sob concorrência.            | Atualização condicional/versionada, transação e unicidade no banco; testes concorrentes por HTTP.                                                                                                         |
| C15 | Mitigação especificada | Reenvio após resposta perdida pode duplicar denúncia ou mudança.                                                       | Contrato proposto de idempotência e versão em `docs/api/contract.md`; verificar resposta perdida e repetição com payload diferente.                                                                       |
| C16 | Mitigação especificada | Polling pode continuar em segundo plano, sobrepor consultas ou aplicar resposta obsoleta.                              | Pausar com tela/app inativos, uma requisição por consulta, descartar respostas ultrapassadas e testar ciclo de vida. Intervalo não é SLA de entrega.                                                      |
| C17 | Mitigação especificada | Seed/reset ou recriação indevida de volumes pode apagar dados de demonstração.                                         | Seed idempotente e explícito, sem reset no startup; backup consistente de banco+fotos e restauração verificada.                                                                                           |
| C18 | Parcial                | Fundação executável verificada; jornadas do MVP ainda não implementadas.                                               | Continuar TDD por fatias; 30 testes atuais não representam a cobertura integral de T01–T29.                                                                                                               |

| ID  | Situação | Problema e impacto                                                                                  | Tratamento proposto / condição de encerramento                                                                                                                         |
| --- | -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C25 | Aberto   | Auditoria npm encontrou 22 ocorrências moderadas transitivas de glob/minimatch na cadeia Expo/Jest. | Acompanhar versões compatíveis e revalidar; não aplicar downgrade ou override incompatível apenas para zerar auditoria. Nenhuma alta/crítica na última execução local. |

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
