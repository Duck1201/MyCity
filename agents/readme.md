# Agentes de validação do MyCity

Estes papéis são acionados pelo agente principal ao encerrar cada fase do [plano](../plan.md). A delegação é obrigatória antes de declarar a fase concluída ou avançar para a próxima. O principal informa a finalidade, aguarda resultados, confere evidências e registra pendências.

| Agente                                | Modelo               | Responsabilidade                                                | Quando executar                                      |
| ------------------------------------- | -------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| [Pentest Sol](pentest.md)             | `gpt-6.2-sol`, high  | Revisão de segurança e verificação dos controles implementados  | Toda fase; repetir após corrigir achados bloqueantes |
| [Luna](luna.md)                       | `gpt-6-luna`, high   | Testes funcionais, negativos e regressão guiados pelas personas | Toda fase, limitando os cenários ao que existe       |
| [QA de interface](qa-interface.md)    | Herdado do principal | Usabilidade, Nielsen, acessibilidade e estados reais das telas  | Fases com alterações de interface                    |
| [QA de integração](qa-integration.md) | Herdado do principal | API, PostgreSQL, arquivos, proxy e fluxo app–web                | Fases com alterações de integração ou infraestrutura |

Os papéis configurados em `.codex/agents/` são `pentest`, `luna`, `qa_interface` e `qa_integration`. Cada TOML aponta para o guia correspondente. Informe a indisponibilidade de um modelo e siga o procedimento alternativo abaixo.

## Entrada obrigatória

Acione cada agente na raiz do checkout de desenvolvimento e indique o papel da tabela. Informe fase, critérios de aceitação, commit e alterações locais relevantes, verificações já feitas e serviços locais disponíveis. Combine previamente quem pode escrever no banco ou nos uploads compartilhados. Use dados fictícios nos cenários e inclua apenas informações sanitizadas na delegação. Siga as regras de [ambiente de desenvolvimento](../AGENTS.md#ambiente-de-desenvolvimento).

## Saída comum

- Agente/modelo, fase, revisão e escopo realmente avaliado.
- Checks realizados e resultados: passou, falhou, não aplicável ou não executado.
- Achados com gravidade, arquivo/linha, evidência, impacto e indicação de hipótese quando faltar confirmação.
- Correções necessárias e bloqueios para a fase atual/próxima.
- Limitações e parecer: aprovado no escopo, bloqueado ou incompleto.

Entregar ao responsável a síntese da revisão com os resultados e as limitações, preservando o sigilo dos dados. Um relatório antigo não valida mudanças posteriores.

## Gate de fase

1. Rodar verificações automáticas e a suíte aplicável.
2. Delegar para Sol e Luna; adicionar os QAs especializados conforme a mudança.
3. Reproduzir achados, corrigir os bloqueantes com regressão e repetir a avaliação afetada.
4. Atualizar `concerns.md` e o plano com evidências, incluindo o que não pôde ser verificado.

Segredo exposto, acesso indevido, escrita sem autorização, risco de perda de dados e achados altos/críticos impedem concluir a fase. Falhas médias em fronteiras de autenticação, autorização ou upload também bloqueiam sua liberação. O agente não pode aceitar risco em nome do responsável.

O GitHub Actions executa scanners/testes, não esses modelos. A execução dos agentes é responsabilidade do orquestrador Codex, seguindo `AGENTS.md`; não depende de agendamento nem de um modelo rodando continuamente. CI verde não equivale a pentest aprovado.

## Execução local alternativa

Se o modelo exigido estiver indisponível entre os subagentes, confira se ele pode ser usado pelo CLI do Codex com a configuração e as permissões da sessão. Use a raiz do checkout existente. Exemplo de revisão somente leitura com Luna:

```bash
codex exec --ephemeral --model gpt-6-luna -c 'model_reasoning_effort="high"' --sandbox read-only 'Leia agents/luna.md e agents/readme.md. Avalie a fase e a revisão informadas pelo responsável a partir das evidências locais. Use somente o escopo e as permissões da tarefa.'
```

Antes de executar, inclua fase, revisão e critérios concretos no prompt. Para Sol, use `--model gpt-6.2-sol` e peça a leitura de `agents/pentest.md`. O sandbox `read-only` limita a escrita no sistema de arquivos. Para acessar banco, APIs ou outros serviços, respeite as permissões e os limites da tarefa. Registre como não executados os cenários que a execução alternativa não puder cobrir. Se faltar um modelo obrigatório ou uma verificação material, o gate continua incompleto.

Registro e herança de modelos foram conferidos na [documentação oficial de subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents). Os TOMLs não substituem as políticas de permissão da sessão.
