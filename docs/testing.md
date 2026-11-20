# Estratégia de testes e evidências

A matriz abaixo relaciona os critérios aprovados às jornadas locais e às provas reservadas ao destino.

## Interfaces aprovadas

- Unitários: funções ou interfaces públicas das regras do domínio, especialmente transições, cancelamento, prioridade e validação.
- Integração: painel e API do desenvolvimento com seu PostgreSQL e volume de fotos.
- Interface: ações e estados observáveis do app e da web.
- Ponta a ponta: criar como cidadão, atender como gestor e consultar retorno como cidadão.
- Manual no destino: APK instalado, permissões reais, câmera, galeria, mapas e servidor hospedado.

Não usar métodos privados como contrato. Não criar funções públicas artificiais só para alcançar detalhes internos em testes. Unitários de regras puras não precisam de banco; comportamento dependente de persistência deve usar PostgreSQL real.

## Ciclo TDD

Para cada comportamento especificado, escrever um teste, observá-lo falhar pela ausência/defeito correto, implementar o suficiente e executar novamente. Registrar uma evidência de falha inicial e do resultado posterior na alteração. Revisar estrutura depois do comportamento passar, mantendo a suíte. Não escrever toda a bateria antes de implementar fatias verticais.

Regressão acompanha a mesma alteração de feature/bug. Não apagar casos, reduzir asserções, usar `.only`, skips, retries ou aumentar timeout para esconder problemas. Falhas preexistentes e flakiness devem ser reportadas, não disfarçadas. Expectativas vêm do contrato, não de cálculos copiados da implementação.

## Catálogo

| ID  | Camadas                        | Cenário e resultado esperado                                                                                                     |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| T01 | Integração/interface           | Login válido, inválido e logout; hash nunca retornado; sessão revogada deixa de autorizar. AC01, RNF01.                          |
| T02 | Unitário/integração            | Criar com 1, 2 e 3 fotos válidas; status inicial Enviado e autor correto; 0/4 fotos falham. AC02.                                |
| T03 | Integração                     | JPEG inválido, tipo disfarçado e limite em bytes; rejeitar sem publicação parcial. Até 5 MiB por JPEG e 16 MiB por envio.        |
| T04 | Interface/integração           | Falha de envio mantém formulário; repetição idempotente não cria outra denúncia. AC02, C15.                                      |
| T05 | Unitário/interface/dispositivo | Coordenadas válidas e inválidas; GPS permitido, negado e indisponível; negar não envia ponto fictício. AC03.                     |
| T06 | Interface/dispositivo          | Selecionar ponto manual e consultar o mesmo ponto salvo; mapa e seleção funcionam no APK. AC03/AC08.                             |
| T07 | Integração/interface           | Feed/mapa/filtros e paginação obedecem visibilidade; canceladas não vazam, inclusive por foto direta. AC04/AC08, C04.            |
| T08 | Integração                     | B confirma A; repetir em paralelo mantém uma confirmação e uma contagem. AC05.                                                   |
| T09 | Unitário/integração            | Autor não confirma; estados finais bloqueiam novas confirmações. AC05.                                                           |
| T10 | Integração                     | Retirada afeta só a confirmação do solicitante; repetir é consistente; estado final preserva as confirmações. AC05.              |
| T11 | Unitário/integração            | Fixture conhecida: 3 confirmações precedem 2, empate favorece mais antiga; desempate por ID é estável. AC06.                     |
| T12 | Unitário/integração            | Testar avanço, um único desfazer e reabertura pelo gestor; saltos inválidos e versão defasada falham sem efeito. AC07.           |
| T13 | Unitário/integração/interface  | Rejeitar apenas Em análise com justificativa não branca; demais combinações falham. AC07.                                        |
| T14 | Integração                     | Mudança de status aparece com evento e aviso; falha transacional não deixa apenas parte desses efeitos. AC07/AC13.               |
| T15 | Integração/interface           | Resposta do gestor aparece no histórico; cidadão não publica resposta de gestor; repetição não duplica. AC07.                    |
| T16 | Integração/interface           | Resolvida aparece no histórico correto, preservando eventos e fotos. AC09, C04.                                                  |
| T17 | Interface/integração           | Três níveis climáticos, marcação simulated e nenhuma chamada meteorológica/envio real. AC10.                                     |
| T18 | Integração                     | Acesso direto a IDs alheios, papéis forjados e ausência de sessão não contornam autorização. AC11.                               |
| T19 | Unitário/integração            | Autor cancela Enviado/Em análise, outro cidadão não; Em andamento e finais bloqueiam. AC12.                                      |
| T20 | Integração concorrente         | Cancelamento disputa com avanço para Em andamento; só uma intenção vence, estado final válido e efeitos consistentes. AC12.      |
| T21 | Integração/interface           | Mudança gera um aviso ao autor; não aparece na conta B; avisos persistem entre sessões. AC13.                                    |
| T22 | Integração/interface           | Marcar aviso lido é idempotente e só destinatário altera; erro não simula sucesso. AC13.                                         |
| T23 | Interface                      | Relógio controlado: 5 s, retorno de tela, background, logout, resposta lenta e falha; sem sobreposição ou estado obsoleto. AC15. |
| T24 | Integração/interface           | Gestor atende regiões distintas; filtros não viram autorização regional. AC14.                                                   |
| T25 | Integração                     | Falha entre gravação de foto e commit; sem denúncia visível parcial e sem arquivo órfão acessível. C13.                          |
| T26 | Integração                     | Requisições repetidas e payload diferente na mesma chave; replay retorna original e conflito não altera dados. C15.              |
| T27 | Integração/operacional         | Seed repetido e recriação de containers preservam dados/fotos; backup restaurado mantém correspondência. AC16.                   |
| T28 | Unitário/interface/dispositivo | Compressão JPEG, proporção, 1.600 px, orientação e legibilidade com fotos reais; qualidade 80% avaliada visualmente. AC17.       |
| T29 | Ponta a ponta/dispositivo      | APK real → API HTTPS → web gestor → histórico/aviso no APK, sem bundler. AC18.                                                   |

## Dependências e isolamento

### Cenários adicionais de acesso restrito

- **T37 — AC19, rotas públicas:** verificar a última requisição permitida, a rejeição seguinte com HTTP 429 e `Retry-After`, a recuperação após a janela e o isolamento por IP e grupo. Validar readiness com PostgreSQL, os recursos do Swagger quando habilitado e o IP encaminhado pelos proxies.
- **T30 — AC19, integração:** sem token ou com token inválido, expirado ou revogado, enviar multipart real para a rota de criação. Verificar acesso negado, ausência de denúncia e nenhum arquivo criado no diretório temporário de upload/staging do teste.
- **T31 — AC11/AC19, integração e interface:** cidadão tenta entrar no painel e chamar diretamente endpoints de gestão, incluindo adulteração do papel no corpo. A API nega dados/ações administrativas e mantém o estado anterior.
- **T32 — AC19, integração:** requisitar uma foto diretamente por ID/URL sem autorização, incluindo caminhos estáticos e combinações de foto/denúncia incompatíveis. Nenhum arquivo protegido é entregue. Login não cria contas nem aceita senha de exemplo como credencial de demonstração.

Os testes de sessões, primeira denúncia e acesso a fotos exercitam essas fronteiras com PostgreSQL e arquivos isolados.

Na validação local, confira o destino da API e use registros fictícios da tarefa. Preserve os demais usuários, denúncias e fotos. Migração, reset e restauração exigem autorização específica para o destino.

Mocks/stubs são permitidos nas fronteiras não avaliadas, como câmera/GPS no teste da tela e transporte HTTP no teste de interação visual. O teste de integração usa a API e o banco reais. Simular condições de armazenamento por dependência substituível ou falha controlada não autoriza mockar as regras de negócio. Conferir efeitos de rollback pela interface pública, não por asserção sobre chamada privada do Prisma.

Usar relógio controlado para polling, dados com IDs/datas estáveis e diretório temporário para fotos. Asserções de leitura usam identidade diferente quando necessário para detectar vazamento. O ambiente não deve ganhar regras de produção especiais por estar em teste.

Runners configurados: Vitest para contratos/API/web e Jest com jest-expo para mobile. O [README](../README.md#testes-e-qualidade) distingue as verificações locais das executadas pela CI.

## Alertas simulados e revisão visual

A etapa 5 cobriu o cenário T17 nos clientes e a expiração da sessão do painel offline.

## Participação e consulta

A etapa 4 cobriu a integração com as duas contas, a ordenação na web e os critérios de visibilidade de feed, mapa, link e histórico.

## Atendimento

A etapa 3 cobriu testes de concorrência, rollback, respostas públicas, acesso pessoal aos avisos e persistência da leitura, além do percurso gestor–cidadão. A etapa 4 acrescenta a corrida entre cancelamento e avanço pelo gestor sobre a mesma versão.

## Primeira denúncia

O fluxo no proxy usa HTTP real com cookie e Bearer. As interfaces nativas de câmera, galeria, GPS e mapa são simuladas nos testes de componentes. A homologação física e hospedada foi dispensada pelo responsável nesta entrega.

## Aceite por critério

| Critérios              | Jornada                                                  | Ambiente e limite                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC01, AC11, AC19, AC20 | Sessão, upload autenticado, fotos protegidas e anonimato | Controles de acesso e limites na integração. No Galaxy com a EC2, publicação anônima por HTTPS e sessão preservada após atualizar e reiniciar o APK.                                           |
| AC02, AC04             | Criação, catálogo e filtros                              | Gestor no Chrome, cidadão em componente e integração com HTTP real.                                                                                                                            |
| AC03, AC08, AC17       | GPS, seleção manual, mapa e fotos                        | No Galaxy M32 com a EC2, câmera e galeria, GPS indisponível com alternativa manual, GPS autorizado e base Google carregada. Publicação em ponto público com dois JPEGs verificados pela API.   |
| AC05, AC06, AC09, AC12 | Confirmação, prioridade, resolvidas e cancelamento       | API e PostgreSQL com duas contas, painel no Chrome e componente mobile.                                                                                                                        |
| AC07, AC13, AC15       | Atendimento, retorno e polling                           | Escritas reais e componente cidadão; testes com relógio controlado cobrem o ciclo de atualização.                                                                                              |
| AC14                   | Acesso da gestão                                         | Consulta e atendimento globais por papel; região e geocodificação adiadas.                                                                                                                     |
| AC10                   | Lista e detalhe dos cenários                             | Componente com HTTP local, catálogo de simulação.                                                                                                                                              |
| AC16                   | Seed, persistência e restauração                         | Na EC2, denúncia e JPEG sobreviveram à recriação de API e painel. Em restauração isolada, o vínculo, o tamanho e o SHA-256 do JPEG coincidiram.                                                |
| AC18                   | APK independente, API HTTPS, atendimento e aviso         | Galaxy M32 com Android 13, APK assinado e API da demonstração na EC2. O autor abriu o aviso e o histórico após o atendimento no painel; a leitura e a sessão persistiram após reiniciar o app. |
| AC21                   | Swagger, opt-in e contrato gerado                        | Suíte de documentação e verificação de drift no check local.                                                                                                                                   |

Na EC2, a revisão `a0c2e8f` passou no percurso API → painel no Chrome → cidadão. A confirmação, o atendimento e o aviso corresponderam ao mesmo registro. Uma restauração isolada preservou o vínculo e o SHA-256 da foto. A cadeia pública respondeu 429 com `Retry-After` em readiness e manteve liveness disponível. As 11 migrações, os três perfis e os privilégios restritos do runtime foram conferidos no destino.

O APK de `bdd3cfb` publicou duas fotos e um ponto escolhido manualmente no parque público após o teste de GPS. A atualização para `c4ab4a7` preservou a sessão do segundo cidadão, que confirmou a ocorrência. O gestor avançou para **Em análise** no Chrome; o autor releu o histórico e o aviso no Galaxy. A inspeção das telas e dos rótulos acessíveis confirmou a ausência do UUID. SHA-256 do APK final: `388b363a5428b09d58c4538ec577a8d9b9fad98844426dcec703bfe00dd11db2`. O código mobile coincide com a revisão integrada `98698da`.

O ponto manual persistido coincidiu com as três casas decimais visíveis no aparelho; painel e API mostraram as mesmas coordenadas completas. A galeria do painel exibiu os dois JPEGs nas dimensões naturais esperadas, com orientação coerente e objeto reconhecível. A amostra da câmera não continha texto para avaliar legibilidade fina.

A EC2 manteve HTTPS disponível e o proxy recolheu os processos auxiliares após cinco sondas consecutivas. Sol, Luna e os QAs de interface e integração revisaram as evidências. Após o aceite, foram removidos somente as duas denúncias e os três anexos do ensaio. As três contas e os três perfis preexistentes foram preservados. A [rastreabilidade](requirements.md) registra o recorte das fontes acadêmicas, incluindo alertas simulados e as decisões sobre região, avaliação e emissão manual.

## QA independente após cada fase

O gate definido em [agents/readme.md](../agents/readme.md) é obrigatório. Sol revisa segurança; Luna valida cenários funcionais baseados nas personas; QA de interface aplica Nielsen e QA de integração verifica o fluxo real conforme a fase. Relatórios indicam a revisão e o ambiente, distinguem achados de hipóteses e registram o que não foi executado.

Comandos automáticos: `npm run security:check`, além da suíte funcional. Esses comandos não executam os modelos nem substituem seus relatórios. O principal aciona os agentes, aguarda os resultados e bloqueia avanço quando necessário.

## Cenários aprovados para CPF e identificação por denúncia

- **T33:** autenticar por CPF normalizado e senha própria, sem e-mail, com contas fictícias e credenciais distintas; não consultar gov.br.
- **T34:** formulário inicia “Quero mostrar minha cara” marcado; envio explícito true exibe nome e foto de perfil a leitores autorizados.
- **T35:** envio false oculta nome, foto, CPF, identificadores e URLs de perfil em feed, mapa, detalhes, histórico e painel do gestor. Vínculo interno continua garantindo propriedade e notificações.
- **T36:** omissão de showIdentity é rejeitada; anonimato não dispensa login nem permite que outro cidadão cancele a denúncia.

A suíte cobre CPF, escolha de identificação e projeção dos dados do autor. A suíte de documentação cobre Swagger local, bloqueio em produção, bind e atualização do OpenAPI.

## Desenvolvimento e ciclo do banco

Os testes locais cobrem inicialização conjunta, Ctrl+C, persistência e reexecução do seed, recuperação de falhas e reset em PostgreSQL descartável. O banco usado para desenvolvimento fica fora dos testes destrutivos.

No Galaxy M32, o ensaio do app integrado cobriu Voltar, teclado, fonte ampliada, movimento reduzido, câmera, galeria, GPS e envio à API local.

O ensaio de configuração local cobriu a troca de senha no reinício, a preservação de sessões e o login pelo proxy em portas personalizadas. Falta verificar em Android físico na mesma LAN que o app conecta à API após mudar `PORT` e reiniciar o Metro. O ADB não listou dispositivo durante o ensaio.
