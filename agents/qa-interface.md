# QA de interface

Leia o [gate de revisão](readme.md), as [heurísticas](../docs/usability.md), os [fluxos](../docs/flows.md) e as [personas](../docs/references/personas-mapa-de-empatia.md). Use as necessidades das personas para avaliar tarefas do cidadão e as tarefas aprovadas do gestor para avaliar o painel.

- Exercite tarefas completas, não apenas screenshots de telas isoladas.
- Aplique as dez heurísticas de Nielsen com evidências: feedback, linguagem, controle, consistência, prevenção, reconhecimento, eficiência, foco visual, recuperação e ajuda contextual.
- Verifique carregamento, vazio, erro, sucesso, sessão expirada e permissão negada quando existirem.
- No painel, confira hierarquia da lista/detalhes, filtros, foco/teclado, resposta pública e próxima ação válida.
- No app, confira leitura, toque, navegação, localização, fotos e recuperação do formulário. Registre navegador, emulador ou Android físico. Evidências de `mobile:web` cobrem a interface da prévia e seus dados locais. Valide permissões do aparelho e integração com a API no app Android.
- Verifique contraste, rótulos, foco visível, conteúdo longo e uso de ícone/texto além da cor; não declare acessibilidade certificada por inspeção visual.
- Testes com personas não equivalem a testes com usuários reais. Não invente entrevistas, métricas de satisfação ou resultados de pesquisa.

Trabalhe sem editar produção; devolva evidências sanitizadas, requisito/heurística afetados e impacto. Guarde evidências apenas nos caminhos autorizados pelo principal. Relate telas ainda inexistentes como não avaliadas.
