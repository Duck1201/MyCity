# Diretrizes de usabilidade

**Decisão confirmada:** seguir as 10 heurísticas de Jakob Nielsen como boa prática no aplicativo do cidadão e no painel do gestor, desde o desenho até a implementação e a revisão.

Referência: Jakob Nielsen, [10 Usability Heuristics for User Interface Design — Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/). A tabela abaixo aplica essas heurísticas ao escopo do MyCity; não é uma transcrição do artigo.

## Aplicação no projeto

| Heurística                                            | Aplicação no MyCity                                                                                                                                                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Visibilidade do estado do sistema                  | Indicar envio, carregamento, sucesso, erro e status da denúncia. Diferenciar dados já confirmados de uma ação em andamento. Atualizações por polling não devem roubar foco ou apagar o formulário.                                           |
| 2. Correspondência entre sistema e mundo real         | Usar termos familiares como “denúncia”, “bairro”, “Em análise” e “Iniciar atendimento”. Exibir datas, endereços e mensagens em linguagem compreensível, sem jargão de implementação.                                                         |
| 3. Controle e liberdade do usuário                    | Permitir voltar, fechar diálogos, ajustar o ponto e remover fotos antes do envio. Oferecer cancelamento conforme os estados permitidos; não introduzir reabertura ou reversão de status fora do contrato.                                    |
| 4. Consistência e padrões                             | Manter nomes, cores de status, ícones e ações equivalentes entre telas. Respeitar convenções da web e do Android, sem exigir que os componentes sejam visualmente idênticos.                                                                 |
| 5. Prevenção de erros                                 | Explicar campos obrigatórios e limites antes do envio. Impedir envio duplicado, transições inválidas e confirmação da própria denúncia. Confirmar cancelamento e exigir justificativa na rejeição.                                           |
| 6. Reconhecimento em vez de memorização               | Deixar filtros ativos, denúncia selecionada, status e ações disponíveis reconhecíveis. Exibir prévias das fotos e o histórico no contexto do atendimento; não depender de ícones sem rótulo.                                                 |
| 7. Flexibilidade e eficiência de uso                  | Facilitar tarefas recorrentes do gestor com busca, filtros, ordenação e navegação por teclado. Preservar contexto ao alternar entre lista e detalhes. Atalhos adicionais não devem ampliar o escopo sem decisão explícita.                   |
| 8. Estética e design minimalista                      | Priorizar a informação necessária à tarefa. Dar espaço a fotos, localização, histórico e próxima ação, evitando gráficos, ornamentos e avisos redundantes. Minimalismo não significa remover personalidade ou informação útil.               |
| 9. Reconhecimento, diagnóstico e recuperação de erros | Informar o que falhou e como agir: corrigir um campo, selecionar outro ponto, entrar novamente ou tentar enviar depois. Preservar os dados preenchidos conforme o contrato e explicar conflitos de status sem aplicar ações silenciosamente. |
| 10. Ajuda e documentação                              | Oferecer orientação curta e contextual sobre fotos, localização, confirmações e estados. Identificar os alertas simulados. Não depender de documentação técnica para que cidadão ou gestor completem uma tarefa.                             |

## Implementação e revisão

Antes de concluir uma tela ou fluxo:

1. Conferir as dez heurísticas no contexto da tarefa e dos papéis envolvidos.
2. Exercitar estados normal, carregando, vazio, erro e sucesso; incluir permissões negadas e conflito de atualização quando aplicáveis.
3. Registrar problemas observados, heurística relacionada, impacto na tarefa e correção necessária. Registrar também quando um item não se aplica, com motivo.
4. Automatizar os comportamentos verificáveis pela interface pública, seguindo TDD; complementar com inspeção no navegador e no Android real.
5. Registrar as limitações verificadas na [matriz de testes](testing.md#aceite-por-critério).

Essas heurísticas orientam decisões e revisões; não substituem testes com usuários, acessibilidade ou os requisitos aprovados. Aplicá-las não autoriza adicionar funcionalidades nem alterar regras de negócio por conta própria.

## Revisão da etapa 5

A revisão do painel e do app na etapa 5 incluiu navegação por teclado, estados vazios e de falha e expiração de sessão.

## Ajustes após o uso do painel

O retorno do responsável motivou os ajustes da lateral, do reset de filtros, do carregamento, do CPF e da identidade visual em azul e cinza.

A tipografia de interface do MyCity é Nunito no painel web e no aplicativo Android. Títulos, valores, campos e textos usam a mesma família, com hierarquia por peso e tamanho. As fontes são distribuídas com cada cliente.
