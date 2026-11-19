# Estratégia de testes e evidências

Status: estratégia definida e 30 testes da fundação executados. Os IDs T01–T29 abaixo continuam sendo cenários do MVP; não devem ser marcados como concluídos pela existência de testes parciais. Resultados concretos em [evidência da fundação](evidence/foundation.md).

## Interfaces aprovadas

- Unitários: funções ou interfaces públicas das regras do domínio, especialmente transições, cancelamento, prioridade e validação.
- Integração: API HTTP com PostgreSQL real isolado e armazenamento temporário de teste.
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
| T03 | Integração                     | JPEG inválido, tipo disfarçado e limite em bytes; rejeitar sem publicação parcial. Valores dependem de C06.                      |
| T04 | Interface/integração           | Falha de envio mantém formulário; repetição idempotente não cria outra denúncia. AC02, C15.                                      |
| T05 | Unitário/interface/dispositivo | Coordenadas válidas e inválidas; GPS permitido, negado e indisponível; negar não envia ponto fictício. AC03.                     |
| T06 | Interface/dispositivo          | Selecionar ponto manual e consultar o mesmo ponto salvo; mapa e seleção funcionam no APK. AC03/AC08.                             |
| T07 | Integração/interface           | Feed/mapa/filtros e paginação obedecem visibilidade; canceladas não vazam, inclusive por foto direta. AC04/AC08, C04.            |
| T08 | Integração                     | B confirma A; repetir em paralelo mantém uma confirmação e uma contagem. AC05.                                                   |
| T09 | Unitário/integração            | Autor não confirma; estados finais bloqueiam novas confirmações. AC05.                                                           |
| T10 | Integração                     | Retirada afeta só a confirmação do solicitante; repetir é consistente; estado final depende de C08. AC05.                        |
| T11 | Unitário/integração            | Fixture conhecida: 3 confirmações precedem 2, empate favorece mais antiga; desempate por ID é estável. AC06.                     |
| T12 | Unitário/integração            | Todas as transições permitidas; saltos, regressões e reabertura falham sem efeito. AC07.                                         |
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

PostgreSQL de teste deve usar banco/credenciais separados da demonstração. Aplicar migrações reais e limpar somente o alvo de teste. Não executar testes destrutivos com a URL de produção. Não substituir banco por mock se estiver indisponível: reportar bloqueio antes de mudar a estratégia.

Mocks/stubs são permitidos nas fronteiras não avaliadas, como câmera/GPS no teste da tela e transporte HTTP no teste de interação visual. O teste de integração usa a API e o banco reais. Simular condições de armazenamento por dependência substituível ou falha controlada não autoriza mockar as regras de negócio. Conferir efeitos de rollback pela interface pública, não por asserção sobre chamada privada do Prisma.

Usar relógio controlado para polling, dados com IDs/datas estáveis e diretório temporário para fotos. Asserções de leitura usam identidade diferente quando necessário para detectar vazamento. O ambiente não deve ganhar regras de produção especiais por estar em teste.

Runners configurados: Vitest para contratos/API/web e Jest com jest-expo para mobile. C11 foi resolvido na fundação. Após escolher, documentar comandos reais no runbook e usar as pastas existentes. Não declarar uma ferramenta instalada antes de criar/verificar o workspace.

## Evidências e pendências manuais

| Verificação                           | Estado atual                   | Evidência exigida                                                                      |
| ------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Suítes unitárias/integração/interface | Parcial: 30 testes da fundação | Comando, versão/alteração, resultado e falhas sem ocultação                            |
| Cenário integrado                     | Não executado                  | Registro das ações e IDs da denúncia/eventos sem segredos                              |
| Android real                          | Pendente                       | Modelo/versão, APK usado, GPS negado/aceito, câmera, galeria, mapa e retorno do gestor |
| Qualidade das fotos                   | Pendente                       | Dimensões/tamanho antes/depois e inspeção das fotos no painel                          |
| Servidor/HTTPS/volumes                | Pendente                       | URL, configuração revisada e persistência após recriação                               |
| Visual e acessibilidade               | Aguardando referências         | Telas e estados relevantes revisados, incluindo vazio/erro/foco                        |

Antes da entrega, executar lint, typecheck, builds aplicáveis e a suíte completa disponível. Uma falha pendente ou verificação manual ausente deve aparecer no relatório como limitação, não como sucesso presumido.
