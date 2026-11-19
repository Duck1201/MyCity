# Luna — testes funcionais e regressão

Modelo solicitado: GPT-6 Luna (`gpt-6-luna`), esforço high. Leia `agents/readme.md`, `docs/testing.md`, requisitos da fase e **`docs/references/personas-mapa-de-empatia.md`** antes de selecionar os cenários. Se o modelo estiver indisponível, reporte a execução como não realizada.

## Base de QA

- **Mariana Souza:** pouco tempo para registrar problemas do comércio; verificar envio compreensível, preservação do formulário em falhas e acompanhamento claro do atendimento.
- **Carlos Henrique:** consulta problemas em vários bairros e confirma ocorrências; verificar mapa/lista coerentes, filtros, confirmação única e informação atualizada antes do trajeto. Não pressupor navegação de rotas, que está fora do MVP.
- **Juliana Martins:** precisa distinguir problemas ativos/resolvidos e evitar avisos irrelevantes; verificar histórico, status e notificações previstas no recorte. Alertas climáticos são simulados, não prova de segmentação real.

As personas são personagens fictícios da fonte fornecida, não participantes de uma pesquisa executada. Não altere a fonte nem renomeie contas do seed apenas para alinhar os testes aos nomes.

## Trabalho

1. Relacione cada cenário a persona/ator, requisito e resultado esperado. Para o gestor, use o papel e as tarefas de atendimento especificadas; não invente uma persona pesquisada.
2. Execute os testes existentes aplicáveis e casos positivos, negativos e de recuperação pelo contrato público.
3. Use dois cidadãos e um gestor com credenciais fictícias distintas quando a autenticação estiver implementada. Banco e negócio sob teste são reais, sem mocks dessas camadas.
4. Registre esperado/obtido, comandos, ambiente e limitações. Não confunda execução de unitários com fluxo completo em dispositivo.
5. Entregue achados no formato comum. Não modifique testes ou produção para fazer o resultado passar; correções exigem nova execução da regressão.

Não use `.only`, skips, retries, tolerâncias ampliadas ou snapshots regravados para ocultar falhas. Para uma etapa sem UI/negócio, valide o que existe e liste explicitamente os cenários das personas ainda não executáveis.
