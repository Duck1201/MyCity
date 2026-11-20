# Requisitos e critérios de aceitação

Status: requisitos do recorte confirmados; decisões ainda propostas apontam para [concerns](../concerns.md). IDs `ACxx` identificam critérios; `Txx` apontam para o catálogo em [testing.md](testing.md). Consulte a [matriz de verificação local e no destino](testing.md#aceite-por-critério).

## Rastreabilidade funcional

| Fonte | Tratamento no MVP                                                 | Casos de uso     | Critério / teste           |
| ----- | ----------------------------------------------------------------- | ---------------- | -------------------------- |
| RF01  | Login CPF/senha próprios (sem e-mail); cadastro fora do recorte   | UC01             | AC01 / T01                 |
| RF02  | Criação real com 1–3 fotos                                        | UC02             | AC02 / T02–T04             |
| RF03  | GPS ou ponto manual obrigatório                                   | UC03             | AC03 / T05–T06             |
| RF04  | Feed com filtros de categoria/status; região adiada               | UC04             | AC04 / T07                 |
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

- **AC01:** CPF e senha próprios válidos retornam usuário/papel; credenciais inválidas produzem erro genérico sem sessão. Logout invalida imediatamente a sessão; ela expira em 24 horas sem renovação automática e exige novo login (C05 aprovado). Não existe cadastro público.
- **AC02:** o cidadão escolhe uma categoria do catálogo. O gestor pode cadastrar categorias além das seis iniciais e renomear uma categoria mantendo o ID e os vínculos das denúncias. O gestor pode arquivar e reativar a categoria. Categorias arquivadas continuam disponíveis nos filtros e nos registros anteriores. Um novo envio exige categoria ativa no momento da gravação. Se a categoria for arquivada durante o preenchimento, o cidadão escolhe outra e preserva relato, fotos e localização. O reenvio idêntico de uma publicação concluída recupera o registro original mesmo após o arquivamento. Todos os filtros devem reconhecer o novo grupo e a API deve recusar IDs não cadastrados. Uma denúncia válida é criada em Enviado com autor autenticado. Ausência de categoria, descrição, coordenadas ou foto impede publicação. Quatro fotos são rejeitadas. Upload inválido não deixa denúncia parcialmente publicada.
- **AC03:** com permissão e coordenadas válidas, preencher a localização; com negativa/indisponibilidade, permitir ponto manual. Sem um ponto, não enviar. Coordenadas fora de latitude [-90,90] e longitude [-180,180] são rejeitadas.
- **AC04:** a ocorrência criada torna-se consultável pelo feed correspondente; os filtros de categoria e status respeitam a matriz de visibilidade. O Início permite abrir uma ocorrência ativa do feed e acessar a lista mesmo sem registros pessoais. O filtro regional foi adiado (C03).
- **AC05:** o cidadão pode confirmar ou retirar a confirmação pelo feed e pelo detalhe. O total confirmado pelo servidor é o mesmo consultado pelo gestor. B confirma denúncia de A uma vez; repetição não aumenta contagem; A não pode confirmar a própria; B pode retirar enquanto a ação estiver permitida. Ao resolver, rejeitar ou cancelar, a contagem fica congelada e também bloqueia a retirada.
- **AC06:** denúncias pendentes com três confirmações precedem aquelas com duas; entre duas com mesma contagem, a criada antes vem primeiro. A Visão geral do gestor apresenta a mesma prioridade para as três primeiras pendências, a ocorrência pendente mais antiga, a distribuição por situação e o ranking por categoria. A seleção abre a fila correspondente. Busca, período e ordenação também se aplicam ao CSV completo. A fila aceita busca por protocolo, relato e coordenadas, filtros por categoria, situação e período inclusivo e ordenação por prioridade ou data. Voltar do detalhe preserva a consulta e a página. O CSV inclui todos os resultados dos filtros na ordem selecionada. Durante a troca de filtro, o painel identifica a atualização e mantém o total da lista exibida até receber o novo resultado.
- **AC07:** apenas gestor realiza transições aprovadas. Enviado → Resolvido falha sem efeitos. Rejeição exige justificativa não vazia em Em análise. Para corrigir um início acidental, o gestor pode desfazer apenas o último avanço de situação entre estados abertos. Após a correção ou uma reabertura, outro recuo exige um novo avanço; para reabrir uma resolvida, rejeitada ou cancelada, retorna a Em análise. O histórico preserva ambas as situações e o autor recebe o aviso. Resposta pública aparece no histórico com ator/data. Resposta e justificativa admitem de 1 a 2.000 caracteres após retirar espaços nas pontas. O gestor também pode responder após resolução, rejeição ou cancelamento, preservando o estado final.
- **AC08:** selecionar marcador abre a denúncia correspondente; canceladas nunca aparecem no mapa público. Captura manual preserva exatamente o ponto confirmado. Ativos aparecem por padrão; resolvidos entram no filtro correspondente. Rejeitados ficam fora do mapa e têm detalhe acessível por link autenticado.
- **AC09:** após resolução, a denúncia pode ser encontrada no histórico de resolvidas e suas mudanças continuam consultáveis. A consulta exige login, conforme C04 aprovado para controle de acesso.
- **AC10:** o cidadão autenticado vê Atenção, Alerta e Emergência e pode abrir cada cenário para consultar descrição, região ilustrativa e período fictício. Lista e detalhe identificam a simulação. A consulta não usa GPS, não acessa fonte meteorológica e mantém os avisos pessoais de atendimento separados.
- **AC11:** alterar IDs na requisição não permite agir em nome de outro autor, ler notificações alheias ou atualizar status como cidadão. Ocultar botão não substitui autorização na API.
- **AC12:** autor cancela em Enviado/Em análise; denúncia passa a Cancelado, sai do feed/mapa e permanece para ele. Outro cidadão não cancela. Em andamento e estados finais rejeitam a ação.
- **AC13:** cada mudança efetiva de status gera exatamente um registro de histórico e um aviso ao autor, na mesma transação. Repetição não multiplica eventos. Leitura de aviso persiste e só o destinatário a altera.
- **AC14:** gestor consulta e atende denúncias de regiões diferentes sem restrição territorial. Filtro é recurso de consulta, não permissão.
- **AC15:** com tela ativa, polling inicia novas consultas em intervalos de cinco segundos sem sobreposição; ao voltar, consulta novamente; em segundo plano, pausa. Falha mantém dados existentes e informa a condição.
- **AC16:** dados e fotos permanecem após recriar containers usando os mesmos volumes. Cada conta provisionada usa a senha configurada para seu CPF. No desenvolvimento local, os valores podem coincidir. O provisionamento hospedado e a rotação explícita exigem valores distintos. A rotação explícita substitui as três senhas preservando os usuários. Seed repetido não duplica contas/cenários nem remove registros criados na demonstração. Em desenvolvimento, reiniciar a API aplica em uma transação as senhas alteradas das contas de demonstração habilitadas e revoga somente suas sessões. Contas ausentes dependem do seed, e contas legadas desabilitadas dependem de rotação explícita.
- **AC17:** JPEG enviado mantém proporção, maior lado até 1.600 px e é legível no destino. Testar orientação e arquivos pequenos/grandes; até 5 MiB por JPEG e 16 MiB por requisição multipart.
- **AC18:** APK instalado acessa a API HTTPS do servidor sem depender do bundler de desenvolvimento. Web e APK observam o mesmo fluxo real.
- **AC19:** somente contas provisionadas podem autenticar; não existe cadastro público. Sem sessão válida, dados protegidos e uploads são negados. Conta de cidadão não acessa operações administrativas, mesmo chamando a API diretamente. Autenticação e autorização antecedem o processamento de multipart; tentativas não autorizadas não gravam arquivos. Fotos não são expostas diretamente pelo servidor estático. Login, saúde e documentação habilitada têm cotas por IP. Ao excedê-las, a API retorna HTTP 429 com `Retry-After` antes de processar a operação. Detalhes em [segurança de acesso](security.md), cenários T30–T32 e T37.

Os critérios de criação da etapa 2 incluem descrição de até 1.000 caracteres, coordenadas GPS ou manuais e uma a três fotos JPEG de até 5 MiB e 1.600 px cada. O painel deve mostrar o mesmo protocolo após atualização, com anonimato inclusive para o gestor quando solicitado.

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

## Identificação e documentação

- **AC20:** checkbox “Quero mostrar minha cara” inicialmente marcado. Ao enviar true, nome/foto de perfil aparecem aos leitores autorizados. Ao enviar false, cidadão e gestor veem “Anônimo” sem campos ou links de identidade, enquanto propriedade e notificações seguem funcionando pelo vínculo interno. CPF nunca público; e-mail não existe no modelo aprovado.
- **AC21:** Swagger gerado por swagger-autogen contém apenas rotas implementadas; UI/schema/assets exigem opt-in de desenvolvimento com listener loopback, e não são publicados em produção. O contrato deve ser válido e atualizado.

## Aceite do ambiente de desenvolvimento

Com portas distintas configuradas no `.env` da raiz, `npm run dev` e a combinação de `dev:api` com `dev:web` devem permitir login pelo painel em `WEB_PORT`, usando o proxy para a API em `PORT`. `dev:mobile` deve usar essa mesma porta, salvo configuração explícita de `EXPO_PUBLIC_API_PORT` ou `EXPO_PUBLIC_API_URL`. Variáveis exportadas no terminal prevalecem sobre as respectivas chaves no arquivo.
