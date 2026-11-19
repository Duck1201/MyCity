# MyCity — Plano de implementação do MVP

Status: planejamento aprovado; fundação do monorepo implementada. Fluxo funcional do MVP ainda pendente.

Este documento consolida as decisões do projeto acadêmico MyCity. A entrega apresenta um aplicativo Android para cidadãos e uma interface web para o gestor, conectados a um backend real. Dados iniciais e alertas climáticos são fictícios; o fluxo de denúncias funciona de ponta a ponta.

A apresentação foi informada para 25 de novembro de 2026. Por orientação do responsável, este plano é organizado por dependências e critérios de conclusão, sem usar o prazo como justificativa para reduzir o escopo acordado.

## 1. Objetivo e demonstração principal

Demonstrar o ciclo:

1. Um cidadão entra no aplicativo com uma conta de demonstração.
2. Cria uma denúncia com categoria, descrição, localização e uma a três fotos.
3. A denúncia aparece no feed, no mapa e no painel web do gestor.
4. Outro cidadão pode confirmar que também presenciou o problema.
5. O gestor analisa a denúncia, publica respostas e avança seu status.
6. O autor acompanha o histórico e recebe notificações dentro do aplicativo.
7. O gestor resolve a denúncia; o registro permanece consultável no histórico.

O cidadão usa React Native; o gestor usa React. As alterações são persistidas no mesmo backend e banco de dados. Mocks independentes nas duas interfaces não atendem ao objetivo.

## 2. Referências e processo SDD

Fontes textuais preservadas em `docs/references/`; referências visuais em `refs/`:

- [Escopo do Projeto](docs/references/escopo-do-projeto.md).
- [Requisitos](docs/references/requisitos.md).
- [Diagrama de Casos de Uso](docs/references/diagrama-de-casos-de-uso.md).
- [Casos de Uso Estendidos](docs/references/casos-de-uso-estendidos.md).
- [Personas e Mapa de Empatia](docs/references/personas-mapa-de-empatia.md).
- Wireframes mobile: `refs/wireframe-Geral.jpeg` e `refs/wireframe-1.jpeg` a `refs/wireframe-4.jpeg`.

SDD significa aqui Spec-Driven Development. Antes do código de produção, consolidar a especificação do MVP, suas diferenças em relação às referências e os critérios de aceitação. Este plano orienta a execução e não substitui os contratos detalhados.

A rastreabilidade deve seguir: referência → requisito do MVP → regra de negócio → critério de aceitação → teste → evidência de validação.

As decisões aprovadas nesta conversa orientam o recorte do MVP. Divergências com as referências devem ser registradas na documentação, preservando os arquivos originais. Novas decisões que mudem comportamento ou contrato devem ser discutidas antes da implementação correspondente.

### Documentação complementar

| Artefato               | Conteúdo                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `docs/readme.md`       | Índice e orientação de leitura.                                                                |
| `docs/scope.md`        | Objetivo, atores, jornadas, escopo funcional, simulações e exclusões.                          |
| `docs/context.md`      | Glossário do domínio, sem detalhes de implementação.                                           |
| `docs/requirements.md` | Requisitos conciliados, regras, critérios de aceitação e rastreabilidade dos RF/RNF originais. |
| `docs/flows.md`        | Jornadas, estados, permissões, visibilidade proposta e inventário de telas.                    |
| `docs/architecture.md` | Monorepo, módulos, dependências, transações, armazenamento e implantação.                      |
| `docs/data-model.md`   | Entidades, relações, invariantes, índices e política de exclusão/retenção no MVP.              |
| `docs/api/`            | Contrato HTTP: autenticação, operações, schemas, erros, paginação e uploads.                   |
| `docs/testing.md`      | TDD, interfaces de teste, cenários, dados e verificações manuais.                              |
| `docs/decisions/`      | Registros das decisões arquiteturais e dos trade-offs relevantes.                              |
| `docs/runbook.md`      | Configuração, execução local, Compose, migrações, seed, APK e demonstração.                    |
| `concerns.md`          | Problemas conhecidos, propostas ainda abertas e critérios de resolução.                        |

A documentação acima já foi criada e é acessível pelo [índice](docs/readme.md). Contém decisões confirmadas e detalhes técnicos explicitamente propostos, ainda sujeitos à resolução dos concerns antes do código correspondente. Os textos estão em português do Brasil, os nomes de arquivo estão em lowercase e as fontes originais foram preservadas em `docs/references/`.

## 3. Decisões confirmadas

| Área                  | Decisão                                                                             |
| --------------------- | ----------------------------------------------------------------------------------- |
| Linguagem             | TypeScript no app, na web e no backend.                                             |
| App                   | React Native com Expo; entrega de APK Android conectado à API hospedada.            |
| Estilo mobile         | Componentes nativos com `StyleSheet`, reutilizados dentro do app.                   |
| Web                   | React com Tailwind CSS e shadcn/ui.                                                 |
| Backend               | Express com Prisma, executado como um monólito modular.                             |
| Banco                 | PostgreSQL real e compartilhado entre as interfaces.                                |
| Repositório           | Monorepo modular, com contratos compartilhados e módulos encapsulados.              |
| Comunicação interna   | Chamadas diretas em memória entre módulos do backend, sem HTTP interno.             |
| Comunicação externa   | App e web acessam a API por HTTP/HTTPS; Prisma conecta ao PostgreSQL.               |
| Hospedagem            | Servidor do responsável, com Docker Compose para web, API e banco.                  |
| Persistência          | Volumes persistentes para PostgreSQL e fotos.                                       |
| Dados iniciais        | Seed com duas contas de cidadão, uma de gestor e dados fictícios.                   |
| Login                 | E-mail e senha reais, com hash seguro e autorização no backend.                     |
| Gestor                | Pode atender denúncias de todas as regiões da demonstração.                         |
| Atualizações          | Polling a cada cinco segundos nas telas ativas e atualização ao retornar.           |
| Fila de processamento | Não será usada no MVP.                                                              |
| Notificações          | Persistidas dentro do app, com estado de leitura; sem push.                         |
| Alertas climáticos    | Simulados, sem consulta meteorológica real.                                         |
| Processo              | SDD antes da implementação; TDD com testes unitários, de integração e de interface. |

A direção visual usa os conceitos próprios `mycity-conceito-visual.png` e `mycity-gestor-v2.png`. A versão 2 foi considerada no caminho, mas ainda exige refinamento no frontend. Não se aguarda mais uma referência externa como pré-condição; os wireframes continuam orientando os fluxos.

## 4. Escopo funcional

### 4.1 Identidade e acesso

- Login funcional com contas criadas pelo seed; cadastro e recuperação de senha ficam fora desta entrega.
- Separar os papéis cidadão e gestor, com autorização aplicada no backend.
- O cidadão cancela apenas suas próprias denúncias e acessa apenas suas próprias notificações.
- O gestor pode consultar e atender denúncias de qualquer região.
- Especificar sessão, expiração, logout e armazenamento das credenciais de sessão antes de implementar autenticação.

### 4.2 Criação e consulta de denúncias

- Categoria, descrição curta, localização e fotos são obrigatórias.
- Manter as seis categorias das referências: buraco, lixo não coletado, iluminação, entulho, vazamento e poda/risco de árvore.
- Capturar coordenadas reais pelo GPS.
- Permitir seleção manual de um ponto no mapa se houver negativa de permissão ou indisponibilidade do GPS.
- Nunca enviar uma denúncia sem localização; informar erros sem perder os dados já preenchidos.
- Publicar a denúncia com status `Enviado`.
- Oferecer feed, mapa, detalhes, acompanhamento das próprias denúncias e histórico.
- Especificar a visibilidade de cada estado no feed, mapa e histórico; denúncias canceladas saem do feed e do mapa e permanecem no histórico do autor.
- Definir limites da descrição, dados públicos do autor, paginação e filtros na especificação.

### 4.3 Fotos

- Aceitar de uma a três fotos por denúncia, da câmera ou da galeria.
- Comprimir no celular antes do upload, convertendo para JPEG.
- Limitar o maior lado a 1.600 px, preservando a proporção e evitando ampliar imagens menores.
- Começar com qualidade de 80%; validar legibilidade com imagens representativas antes de fechar o comportamento.
- Validar quantidade, formato efetivo e tamanho no backend; não confiar apenas na extensão ou no MIME declarado pelo cliente.
- Guardar arquivos em volume persistente e metadados no PostgreSQL.
- Definir limite em bytes por foto e por requisição na especificação. Qualidade JPEG não garante um tamanho fixo.
- Tratar uploads interrompidos e arquivos órfãos. Uma transação do PostgreSQL não desfaz automaticamente operações no sistema de arquivos.
- Exibir as imagens no app e nos detalhes do gestor.

### 4.4 Confirmações e prioridade

- Uma confirmação ativa por cidadão em cada denúncia.
- Impedir confirmação da própria denúncia.
- Permitir retirar a própria confirmação.
- Bloquear novas confirmações em denúncias resolvidas, rejeitadas ou canceladas, conforme os casos de uso de referência.
- Definir explicitamente o comportamento da retirada após encerramento na especificação.
- Ordenar denúncias pendentes pelo número de confirmações, do maior para o menor.
- Em empate, apresentar primeiro as mais antigas; adotar um desempate final estável para paginação.
- Não introduzir faixas arbitrárias de prioridade baixa, média ou alta.
- Garantir a unicidade no banco e tratar repetição de requisições sem duplicar confirmações.

### 4.5 Atendimento, respostas e cancelamento

Transições permitidas:

| Estado atual          | Próximo estado | Responsável e condição                         |
| --------------------- | -------------- | ---------------------------------------------- |
| Enviado               | Em análise     | Gestor.                                        |
| Em análise            | Em andamento   | Gestor.                                        |
| Em andamento          | Resolvido      | Gestor.                                        |
| Em análise            | Rejeitado      | Gestor, com justificativa pública obrigatória. |
| Enviado ou Em análise | Cancelado      | Cidadão autor, após confirmação.               |

- Impedir saltos, regressões e reabertura dos estados finais.
- Permitir respostas públicas em texto pelo gestor, exibidas no histórico; não haverá chat.
- Registrar autoria e data das mudanças de status e respostas.
- Persistir mudança de status, evento de histórico e notificação do autor na mesma transação de banco.
- Validar o estado atual ao gravar, incluindo conflitos entre cancelamento e atendimento simultâneos.
- Definir se respostas poderão ser publicadas depois do encerramento; não presumir uma regra sem registrá-la.

### 4.6 Notificações e polling

- Cada mudança de status gera uma notificação persistida para o autor.
- Exibir estado lido/não lido e navegação para a denúncia.
- Atualizar a lista do gestor e o acompanhamento do cidadão a cada cinco segundos enquanto as telas estiverem ativas.
- Consultar novamente ao retornar à tela ou ao aplicativo.
- Suspender polling em segundo plano e evitar requisições sobrepostas.
- Tratar falha de rede sem apagar o estado já apresentado ou marcar notificações como lidas indevidamente.
- Atualizações após ações do próprio usuário devem refletir a resposta da API sem aguardar o próximo intervalo.
- Não implementar WebSocket, push, e-mail ou processamento por fila nesta entrega.

### 4.7 Alertas climáticos simulados

- Exibir cenários fictícios com níveis Atenção, Alerta e Emergência.
- Usar dados determinísticos e identificar o contexto de demonstração.
- Não consultar INMET/OpenWeather nem emitir alertas reais.
- A simulação não comprova segmentação geográfica real, entrega emergencial em um minuto ou disponibilidade contínua.
- Definir na especificação o conteúdo dos cenários e as interações da tela. Um painel operacional da Defesa Civil não faz parte do fluxo funcional aprovado.

### 4.8 Painel web

- Login do gestor.
- Lista de denúncias com filtros por status, categoria e região, ordenada por prioridade.
- Contadores por status, sem dashboard separado com gráficos.
- Detalhes com fotos, localização, histórico, respostas e ações válidas para o estado atual.
- Estados de carregamento, ausência de resultados, erro e sessão expirada.
- A definição de região para exibição e filtragem depende da decisão sobre endereço/geocodificação.

## 5. Ajustes em relação às referências

| Referência  | Tratamento no MVP                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| RF01        | Login real; cadastro público adiado.                                                                                     |
| RF02–RF07   | Funcionais; criação ampliada para uma a três fotos e prioridade definida por confirmações/antiguidade.                   |
| RF08–RF09   | Mapa e histórico previstos; filtros de visibilidade serão especificados por estado.                                      |
| RF10–RF11   | Alertas simulados; integração meteorológica e distribuição real por área não implementadas.                              |
| RF12        | Autorização real para cidadão e gestor.                                                                                  |
| RF13        | Operação da Defesa Civil fora do fluxo funcional desta entrega.                                                          |
| RF14–RF15   | Cancelamento funcional e notificações internas persistidas.                                                              |
| RF16        | Avaliação do atendimento adiada, sem botão funcional nesta versão.                                                       |
| RF17        | Restrição regional adiada; gestor atende todas as regiões.                                                               |
| RNF01–RNF02 | Hash de senha e HTTPS previstos; configuração do servidor ainda precisa ser definida.                                    |
| RNF03–RNF04 | Não prometer SLA de emergência nem disponibilidade 24/7 para a demonstração acadêmica.                                   |
| RNF05       | Android é a plataforma de entrega e validação; iOS não terá homologação nesta etapa.                                     |
| RNF06       | Documentar tratamento de fotos, localização e dados pessoais; não declarar conformidade apenas por usar dados fictícios. |
| RNF07       | Demonstração com dados fictícios e sem envio de alertas reais à população.                                               |

## 6. Estrutura e isolamento

Estrutura proposta:

```text
apps/
  api/
    src/modules/
      identity/
      reports/
      notifications/
      alerts/
  web/
  mobile/
packages/
  contracts/
docs/
refs/
plan.md
compose.yaml
```

- **Identidade:** autenticação, contas e permissões.
- **Denúncias:** criação, fotos, localização, confirmações, prioridade, status, respostas e histórico.
- **Notificações:** avisos ao cidadão, consulta e leitura.
- **Alertas:** consulta de cenários climáticos simulados.

Cada módulo oferece uma interface pequena e explícita. Outros módulos não importam seus arquivos internos nem alteram diretamente seus dados. Status, confirmações e histórico permanecem dentro de Denúncias, pois pertencem às mesmas operações de negócio.

Definir na arquitetura como Denúncias participa de uma transação conjunta com Notificações por suas interfaces públicas. O compartilhamento da transação não deve expor Prisma aos clientes nem permitir acessos arbitrários às tabelas de outro módulo.

`packages/contracts` contém formatos de requisição/resposta e validações compartilháveis. Não deve exportar Prisma, segredos, acesso ao banco ou a implementação das regras do backend. Compartilhar tipos não substitui validar dados recebidos em execução.

Compartilhar apenas o que tiver uso concreto. Web e mobile podem compartilhar identidade visual e contratos, mantendo componentes próprios para suas plataformas. Escolher o gerenciador de pacotes, ferramentas de build e versões compatíveis durante a especificação técnica e registrar um único lockfile do workspace.

## 7. Estratégia TDD e verificação

Interfaces de teste aprovadas: interface HTTP da API, interfaces visíveis do app/web e fluxo integrado entre cidadão e gestor. O responsável também exigiu testes unitários das regras de negócio por funções ou interfaces públicas dos módulos.

### Camadas

| Camada           | Verificação                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Unitária         | Transições, cancelamento, cálculo/ordenação de prioridade e validações puras, sem banco quando a regra não depende dele.          |
| Integração       | API e persistência com PostgreSQL real de teste: sessão, autorização, uploads, unicidade, histórico, notificações e concorrência. |
| Interface        | Formulários, estados, permissões de dispositivo, polling e ações acessíveis aos usuários no app e na web.                         |
| Ponta a ponta    | Criar no contexto do cidadão, atender no contexto do gestor e observar o resultado pelo cidadão.                                  |
| Dispositivo real | APK instalado, GPS, permissão negada, seleção manual no mapa, câmera, galeria, compressão e acesso à API hospedada.               |

### Regras de execução

1. Especificar o comportamento e o resultado esperado.
2. Escrever um teste que falhe pelo comportamento ainda ausente.
3. Confirmar a falha antes de implementar a mudança.
4. Implementar o suficiente para passar e revisar a solução.
5. Repetir por uma fatia funcional de cada vez; não escrever todos os testes antes de toda a implementação.

- Não mockar regras de negócio nem banco sob teste. Usar banco isolado de teste, nunca o banco da demonstração.
- Simulações ficam nas fronteiras externas, como GPS, câmera, fonte meteorológica e transporte quando este não for o objeto do teste.
- Confirmar efeitos pela interface pública correspondente, sem acoplar asserções a métodos privados ou detalhes internos.
- Usar expectativas independentes da implementação e cenários negativos de autorização e integridade.
- Toda feature e correção deve incluir regressão na mesma alteração. Em bugs, reproduzir primeiro a falha.
- Não enfraquecer testes, aumentar tolerâncias, usar skips/retries ou atualizar snapshots para ocultar defeitos.
- Escolher os runners durante a especificação técnica; depois reutilizar a estrutura definida, sem adicionar frameworks redundantes.
- Executar verificações do projeto e a suíte inteira disponível antes da entrega; registrar falhas e limitações reais.
- Manter em `docs/testing.md` as verificações manuais e os comportamentos não alcançados pela automação.

## 8. Etapas de implementação

### Etapa 0 — Especificação e decisões restantes

- Produzir os documentos SDD listados neste plano.
- Resolver ambiguidades de comportamento, visibilidade, upload e localização.
- Especificar contratos HTTP, modelo de dados, cenários de seed e interfaces de teste.
- Receber as referências visuais e definir os estados e fluxos das telas antes de implementá-las.
- Consolidar o entendimento com o responsável antes de começar o código de produção.

Conclusão: requisitos rastreáveis, contratos revisáveis e pendências que afetem a primeira fatia resolvidas.

### Etapa 1 — Fundação do monorepo e ambiente

- Configurar os três aplicativos, o workspace e os contratos compartilhados.
- Configurar TypeScript, formatação, lint, runners e comandos de verificação.
- Criar Compose, configuração de ambiente documentada e volumes persistentes.
- Preparar PostgreSQL de desenvolvimento/teste, schema, migrações e seed repetível.
- Evitar que o seed apague dados da demonstração ou redefina credenciais a cada reinício.

Conclusão: ambiente executável a partir das instruções, testes usando banco isolado e persistência verificada após recriar containers.

### Etapa 2 — Acesso e primeira denúncia de ponta a ponta

- Implementar login e autorização com testes.
- Implementar captura/seleção de fotos, compressão e localização com alternativa manual.
- Implementar criação, persistência, consulta e apresentação da denúncia no app e na lista do gestor.
- Tratar erros de formulário, upload e rede, incluindo preservação dos dados preenchidos.

Conclusão: uma denúncia criada no APK aparece na web hospedada com imagens e coordenadas corretas.

### Etapa 3 — Atendimento e retorno ao cidadão

- Implementar transições, justificativa de rejeição e respostas públicas.
- Registrar histórico e notificações de maneira consistente.
- Implementar acompanhamento, leitura de notificações e polling.
- Testar permissões, transições inválidas e conflitos de atualização.

Conclusão: o gestor atende pela web e o autor observa status, histórico e notificação no app.

### Etapa 4 — Participação, consulta e cancelamento

- Implementar confirmação, retirada e ordenação por prioridade.
- Implementar cancelamento e restrições por autor/estado.
- Completar feed, mapa, histórico, filtros e contadores.
- Testar estados finais, unicidade e visibilidade dos registros.

Conclusão: as duas contas de cidadão demonstram participação, prioridade e cancelamento sem violar permissões.

### Etapa 5 — Alertas simulados e revisão visual

- Adicionar cenários climáticos fictícios e suas telas.
- Finalizar a identidade visual conforme as referências fornecidas.
- Revisar carregamento, vazio, erro, sessão expirada, permissões e acessibilidade básica.
- Conferir textos, navegação e consistência entre todos os estados relevantes.

Conclusão: as telas previstas estão completas, e as simulações estão identificadas e separadas do fluxo real de denúncias.

### Etapa 6 — Hospedagem, APK e validação final

- Configurar domínio, HTTPS e proxy conforme a infraestrutura existente do servidor.
- Aplicar migrações e seed de forma explícita, documentada e preservando dados existentes.
- Gerar o APK com a URL pública correta da API, independente do servidor de desenvolvimento.
- Validar API e web pelo domínio real e APK em Android físico.
- Executar a suíte disponível, verificar persistência e realizar o roteiro completo da demonstração.
- Documentar como reiniciar, consultar logs, fazer backup dos volumes e restaurar o cenário de demonstração quando solicitado.

Conclusão: aplicação acessível, APK instalado, fluxo principal observado no ambiente de destino e evidências registradas.

## 9. Pendências que precisam ser fechadas na especificação

- Referências visuais adicionais do responsável e identidade visual final.
- Provedor/biblioteca de mapas, requisitos de chave e forma de seleção manual do ponto.
- Conversão de coordenadas em endereço/bairro/região, fallback sem geocodificação e filtros correspondentes.
- Visibilidade de resolvidas/rejeitadas, acesso público versus autenticado e dados do autor exibidos.
- Limites de texto e arquivos; tratamento de orientação/metadata de fotos e limpeza de uploads incompletos.
- Política de sessão, armazenamento no Android/web e expiração.
- Regras restantes de respostas e retirada de confirmação após encerramento.
- Ferramentas de build, gerenciador de pacotes, runners e versões compatíveis.
- Infraestrutura do servidor: domínio, proxy existente, HTTPS, arquitetura e configuração de deploy.
- Procedimento de geração/assinatura do APK e acesso aos recursos necessários.

Detalhes rotineiros e reversíveis podem ser resolvidos durante a especificação. Mudanças de comportamento, escopo ou contratos importantes devem voltar à discussão com o responsável.

## 10. Critério de entrega

- [ ] Documentação SDD reconciliada com as referências e decisões aprovadas.
- [ ] Conta de cidadão e conta de gestor autenticam com permissões efetivas no backend.
- [ ] Uma a três fotos reais são comprimidas, persistidas e exibidas corretamente.
- [ ] GPS e seleção manual funcionam no Android real.
- [ ] Denúncia criada no app aparece no painel web conectado ao mesmo backend.
- [ ] Confirmações, prioridade, cancelamento e restrições de estado funcionam.
- [ ] Respostas e mudanças de status aparecem no histórico do cidadão.
- [ ] Notificações persistidas e polling funcionam sem duplicar operações.
- [ ] Feed, mapa, histórico e filtros respeitam a visibilidade especificada.
- [ ] Alertas climáticos são demonstrados com dados fictícios e sem emissão real.
- [ ] PostgreSQL e fotos sobrevivem à recriação dos containers.
- [ ] APK acessa a API hospedada sem depender do servidor de desenvolvimento.
- [ ] Testes unitários, integração, interface e fluxo integrado executados, com resultados registrados.
- [ ] Verificações manuais relevantes concluídas no destino ou explicitamente registradas como pendentes.
- [ ] Nenhuma pendência ou simulação é apresentada como funcionalidade real validada.

## 11. Estado atual

- Documentação SDD complementar em [docs/readme.md](docs/readme.md), com propostas e pendências em [concerns.md](concerns.md).
- Fundação implementada: npm workspaces, contratos, quatro módulos do backend, clientes React/Expo, Prisma/PostgreSQL, Compose, seed de contas e runners.
- Verificado: lint, typecheck, 40 testes, build web/API, compatibilidade Expo e exportação do bundle Android. Evidência: [fundação](docs/evidence/foundation.md).
- Regras puras de transição e localização implementadas; isso ainda não significa atendimento persistido por API.
- Ainda pendentes: sessão/login HTTP, denúncias/fotos/mapas, atendimento, notificações, frontend do gestor e APK em dispositivo. A fundação possui pipeline de publicação/deploy; consultar [CI/CD](docs/ci-cd.md) para configuração e evidências.
- O seed atual cria somente as três contas; dados fictícios de denúncias acompanham as próximas fatias.
- Próximo passo: fechar o contrato de sessão e implementar login/permissões de ponta a ponta, mantendo as demais pendências rastreadas.

- Repositório público: https://github.com/Duck1201/MyCity; Apache 2.0, Conventional Commits e proteção de `main` por PR/checks.
