# Requisitos e critérios de aceitação

Status: requisitos do recorte confirmados; decisões ainda propostas apontam para [concerns](../concerns.md). IDs `ACxx` identificam critérios; `Txx` apontam para o catálogo em [testing.md](testing.md). A fundação possui 30 testes executados; o catálogo T01–T29 do MVP permanece planejado até cada jornada ser implementada. Consulte [evidência da fundação](evidence/foundation.md).

## Rastreabilidade funcional

| Fonte | Tratamento no MVP                                                 | Casos de uso     | Critério / teste           |
| ----- | ----------------------------------------------------------------- | ---------------- | -------------------------- |
| RF01  | Login real; cadastro removido do recorte                          | UC01             | AC01 / T01                 |
| RF02  | Criação real com 1–3 fotos                                        | UC02             | AC02 / T02–T04             |
| RF03  | GPS ou ponto manual obrigatório                                   | UC03             | AC03 / T05–T06             |
| RF04  | Feed com consulta por categoria/região                            | UC04             | AC04 / T07                 |
| RF05  | Confirmação única e retirada                                      | UC05             | AC05 / T08–T10             |
| RF06  | Contagem decrescente, empate por mais antiga                      | UC06             | AC06 / T11                 |
| RF07  | Transições, respostas e rejeição                                  | UC11, UC19, UC20 | AC07 / T12–T15             |
| RF08  | Mapa com marcadores e seleção                                     | UC07             | AC08 / T06–T07             |
| RF09  | Histórico de resolvidas                                           | UC12             | AC09 / T16                 |
| RF10  | Dados climáticos simulados; sem consulta periódica externa        | UC14             | AC10 / T17                 |
| RF11  | Apresentação de alertas simulados, sem distribuição real por área | UC13, UC18       | AC10 / T17                 |
| RF12  | Autorização real de cidadão e gestor                              | UC01, UC11       | AC11 / T18                 |
| RF13  | Emissão manual fora do recorte                                    | UC16             | Sem implementação prevista |
| RF14  | Cancelamento pelo autor em Enviado/Em análise                     | UC08             | AC12 / T19–T20             |
| RF15  | Avisos internos persistidos e acompanhamento                      | UC09, UC15       | AC13 / T21–T23             |
| RF16  | Avaliação fora do recorte                                         | UC10             | Sem implementação prevista |
| RF17  | Substituído por acesso do gestor a todas as regiões               | UC17             | AC14 / T24                 |

## Critérios verificáveis

- **AC01:** credenciais válidas retornam usuário/papel; inválidas produzem erro genérico sem sessão. Logout invalida imediatamente a sessão; ela expira em 24 horas sem renovação automática e exige novo login (C05 aprovado). Não existe cadastro público.
- **AC02:** denúncia válida é criada em Enviado com autor autenticado. Ausência de categoria, descrição, coordenadas ou foto impede publicação. Quatro fotos são rejeitadas. Upload inválido não deixa denúncia parcialmente publicada.
- **AC03:** com permissão e coordenadas válidas, preencher a localização; com negativa/indisponibilidade, permitir ponto manual. Sem um ponto, não enviar. Coordenadas fora de latitude [-90,90] e longitude [-180,180] são rejeitadas.
- **AC04:** a ocorrência criada torna-se consultável pelo feed correspondente; filtros não misturam categorias/regiões. Regras de visibilidade pendentes em C04/C03.
- **AC05:** B confirma denúncia de A uma vez; repetição não aumenta contagem; A não pode confirmar a própria; B pode retirar enquanto a ação estiver permitida. Estados finais não aceitam novas confirmações; retirada nesses estados depende de C08.
- **AC06:** denúncias pendentes com três confirmações precedem aquelas com duas; entre duas com mesma contagem, a criada antes vem primeiro. Ordenação não cria níveis de prioridade.
- **AC07:** apenas gestor realiza transições aprovadas. Enviado → Resolvido falha sem efeitos. Rejeição exige justificativa não vazia em Em análise. Resposta pública aparece no histórico com ator/data. Respostas após estado final dependem de C08.
- **AC08:** selecionar marcador abre a denúncia correspondente; canceladas nunca aparecem no mapa público. Captura manual preserva exatamente o ponto confirmado. Outros estados dependem de C04.
- **AC09:** após resolução, a denúncia pode ser encontrada no histórico de resolvidas e suas mudanças continuam consultáveis. A consulta exige login, conforme C04 aprovado para controle de acesso.
- **AC10:** tela mostra Atenção, Alerta e Emergência com indicação de simulação; nenhuma integração meteorológica ou entrega real é necessária ou anunciada.
- **AC11:** alterar IDs na requisição não permite agir em nome de outro autor, ler notificações alheias ou atualizar status como cidadão. Ocultar botão não substitui autorização na API.
- **AC12:** autor cancela em Enviado/Em análise; denúncia passa a Cancelado, sai do feed/mapa e permanece para ele. Outro cidadão não cancela. Em andamento e estados finais rejeitam a ação.
- **AC13:** cada mudança efetiva de status gera exatamente um registro de histórico e um aviso ao autor, na mesma transação. Repetição não multiplica eventos. Leitura de aviso persiste e só o destinatário a altera.
- **AC14:** gestor consulta e atende denúncias de regiões diferentes sem restrição territorial. Filtro é recurso de consulta, não permissão.
- **AC15:** com tela ativa, polling inicia novas consultas em intervalos de cinco segundos sem sobreposição; ao voltar, consulta novamente; em segundo plano, pausa. Falha mantém dados existentes e informa a condição.
- **AC16:** dados e fotos permanecem após recriar containers usando os mesmos volumes. Seed repetido não duplica contas/cenários nem remove registros criados na demonstração.
- **AC17:** JPEG enviado mantém proporção, maior lado até 1.600 px e é legível no destino. Testar orientação e arquivos pequenos/grandes; limites em bytes dependem de C06.
- **AC18:** APK instalado acessa a API HTTPS do servidor sem depender do bundler de desenvolvimento. Web e APK observam o mesmo fluxo real.
- **AC19:** somente contas provisionadas podem autenticar; não existe cadastro público. Sem sessão válida, dados protegidos e uploads são negados. Conta de cidadão não acessa operações administrativas, mesmo chamando a API diretamente. Autenticação e autorização antecedem o processamento de multipart; tentativas não autorizadas não gravam arquivos. Fotos não são expostas diretamente pelo servidor estático. Detalhes em [segurança de acesso](security.md), cenários T30–T32.

## Requisitos não funcionais conciliados

| Fonte | Especificação do MVP                                                                                                 | Evidência planejada                        |
| ----- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| RNF01 | Hash seguro, nunca senha em texto puro ou respostas/logs; algoritmo/parâmetros definidos com C05                     | Revisão de configuração e T01/T18          |
| RNF02 | HTTPS no ambiente hospedado; nenhum segredo em bundle ou repositório                                                 | T29 e inspeção do deploy                   |
| RNF03 | Sem SLA emergencial; polling não é garantia de entrega em um minuto                                                  | Limitação explícita; AC15                  |
| RNF04 | Processo hospedado e reinicializável; sem promessa 24/7                                                              | T27/T29                                    |
| RNF05 | Fluxos simples no Android e painel web; iOS não homologado                                                           | T28/T29; revisão visual                    |
| RNF06 | Minimização de dados, autorização para fotos e coordenadas conforme C04/C12; sem declaração jurídica de conformidade | Revisão de exposição, logs, retenção e T18 |
| RNF07 | Dados fictícios e alertas simulados, com ações reais no ambiente demonstrativo                                       | T17/T27/T29                                |

## Regras adicionais de integridade

Uma alteração concorrente não pode violar a máquina de estados. Registro de status, histórico e notificação é indivisível no banco. Falhas de foto exigem compensação no armazenamento, não uma promessa de rollback de arquivo. Os testes T20, T25 e T26 devem observar essas condições pelas interfaces públicas.
