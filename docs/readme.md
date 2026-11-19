# Documentação do MyCity

Especificação suplementar do MVP acadêmico, elaborada em 18/11/2026 a partir das referências e das decisões aprovadas na sessão de planejamento. A fundação executável já foi implementada e validada localmente; o fluxo completo ainda está pendente.

## Ordem de leitura

1. [Plano de implementação](../plan.md): etapas, dependências e critérios de entrega.
2. [Escopo](scope.md): entrega real, simulações e exclusões.
3. [Glossário](context.md): significado dos termos do domínio.
4. [Requisitos](requirements.md): RF/RNF conciliados e critérios de aceitação.
5. [Fluxos e estados](flows.md): jornadas, permissões, visibilidade e telas.
6. [Arquitetura](architecture.md): monorepo, módulos, transações e arquivos.
7. [Modelo de dados](data-model.md): entidades e invariantes.
8. [Contrato HTTP](api/contract.md): proposta de operações e formatos.
9. [Testes](testing.md): TDD, cenários e evidências.
10. [Operação e demonstração](runbook.md): preparação do ambiente e roteiro.
11. [Decisões](decisions/readme.md): registros das escolhas aprovadas.
12. [Concerns](../concerns.md): pendências, riscos e critérios de resolução.

## Como interpretar o status

Para desenhar, implementar ou revisar telas, consulte também as [diretrizes de usabilidade e as 10 heurísticas de Nielsen](usability.md), adotadas como boa prática do projeto.

Para autenticação, painel e uploads, siga a [política de acesso restrito](security.md). O repositório ser público não torna os dados ou as operações da aplicação públicos.

Para models, enums e migrações, siga as [convenções de Prisma e PostgreSQL](prisma.md).

- **Confirmado:** decisão expressamente aprovada na conversa ou requisito das referências preservado no recorte.
- **Proposto:** detalhamento elaborado para tornar a especificação revisável. Ainda não é um contrato congelado quando altera comportamento importante.
- **Pendente:** falta uma escolha ou informação externa; identificado por `Cxx` em concerns.
- **Verificado:** exige evidência real. Apenas os comportamentos listados na evidência da fundação estão verificados.

Decisões aprovadas do MVP prevalecem sobre os textos históricos para esta entrega. Contratos propostos não substituem decisões aprovadas. Mudanças importantes de comportamento exigem alinhamento antes do código correspondente; isso não impede documentar a proposta.

## Fontes e design

Os cinco documentos originais foram movidos, sem alteração de conteúdo, para [references/](references/readme.md). O antigo README foi movido e teve seus links ajustados. Nomes agora usam lowercase e kebab-case.

`refs/` mantém as cinco imagens de wireframe e o prompt da revisão visual do gestor. A [visão geral](../refs/wireframe-Geral.jpeg) e as telas de [feed](../refs/wireframe-1.jpeg), [criação](../refs/wireframe-2.jpeg), [mapa](../refs/wireframe-3.jpeg) e [alertas](../refs/wireframe-4.jpeg) são referências estruturais. Os conceitos próprios na raiz complementam essas referências; o acabamento será refinado no frontend.

## Escopo desta edição

A documentação acompanha agora a fundação executável. Consulte o [guia de execução](../README.md) e a [evidência da fundação](evidence/foundation.md) para distinguir o que já funciona do que permanece planejado. As rotas de saúde já têm OpenAPI gerado por swagger-autogen; endpoints de negócio continuam em especificação. O repositório público e a operação de deploy são descritos em [CI/CD](ci-cd.md). O contrato HTTP em Markdown é a fonte da proposta atual; novas rotas devem gerar seu OpenAPI a partir do código e dos refinamentos aprovados, sem manter contratos conflitantes.

## Agentes de QA e segurança

Papéis e gatilhos: [agents/readme.md](../agents/readme.md). Leia a [revisão inicial do Sol](evidence/qa/foundation-security-review.md), a [validação de personas pela Luna](evidence/qa/luna-personas-check.md) e a [evidência do firewall](evidence/firewall.md).
