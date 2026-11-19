# User: CPF e mapeamento físico

Alteração solicitada em 19/11/2026: CPF substitui e-mail, `passwordHash` passa a `password` mantendo o hash, `modifiedAt` é atualizado pelo Prisma e os nomes físicos usam snake_case.

- Tabela `users`, enum `user_role` com valores físicos `citizen`/`manager`.
- Colunas `id`, `cpf`, `password`, `role`, `created_at`, `modified_at`.
- Identidade interna aceita CPF com ou sem máscara e devolve somente id/cpf/role; não devolve password. Não há login HTTP ainda.
- Seed usa os três identificadores sintéticos 00000000001, 00000000002 e 00000000003. Validação é de formato de demonstração, não de existência civil/dígitos verificadores.
- Migração transacional com lock exclusivo, preservando IDs/hashes/criação. Conta desconhecida interrompe o processo antes de qualquer transformação.

## Verificação

Os testes de identidade foram atualizados de e-mail para CPF conforme a mudança solicitada; falharam com a implementação anterior. Testes adicionais cobrem máscara, formatos malformados, nomes reais de colunas, papel persistido, atualização de modifiedAt e preservação de createdAt. O teste de CHECK de 11 dígitos também falhou antes da restrição ser adicionada.

A migração foi testada em PostgreSQL real: três contas legadas com IDs/hashes diferentes mantêm suas correspondências exatas; conjunto com contas conhecidas e uma desconhecida é rejeitado preservando todas as linhas. As datas sem fuso são comparadas como texto SQL para evitar que o parser local altere a representação esperada. O banco descartável foi recriado para testar a versão final da migração.

Sol e Luna revisaram os arquivos sem ler credenciais. A revisão identificou um caso de teste duplicado no hook, a necessidade de lock antes do preflight, a comparação de timestamp dependente de fuso e a cobertura individual das três contas; os pontos foram corrigidos. As expectativas de comportamento não foram enfraquecidas.

Suíte local: 67 testes, lint, tipos, builds, geração OpenAPI, formatação e checks de segurança aprovados. A senha comum do seed (SEC-01) continua pendente antes da autenticação HTTP.

## Operação

Preflight da EC2 conferiu exatamente as três contas conhecidas. Backup do banco antes da alteração: `/opt/mycity/backups/pre-cpf-20261119T040805Z.dump`, somente no servidor, modo 600. Um fingerprint privado permite conferir IDs, CPFs mapeados, hashes e datas após o deploy sem expor valores.

A migração é incompatível com a imagem anterior da API: pode haver indisponibilidade breve da readiness entre migração e troca de imagem. Rollback apenas da imagem não restaura o schema; recuperar a base exige procedimento explícito com o backup. Se o preflight rejeitar uma conta, interromper o deploy, definir seu mapeamento e resolver o estado da migração falha antes de reaplicar. Nunca resetar ou apagar usuários para contornar esse bloqueio.
