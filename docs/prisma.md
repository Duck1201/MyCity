# Convenções Prisma e PostgreSQL

Padrão aprovado para o MyCity. Deve ser consultado antes de criar ou alterar models, enums, campos, índices e migrações. O schema executável é [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma); este documento define a convenção para sua evolução.

## Nomes no código e no banco

| Elemento                                  | Prisma / TypeScript              | PostgreSQL                                   | Convenção                                                                        |
| ----------------------------------------- | -------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| Model                                     | PascalCase singular, como `User` | snake_case plural, como `users`              | Declarar `@@map("users")`                                                        |
| Campo                                     | camelCase, como `createdAt`      | snake_case, como `created_at`                | Declarar `@map("created_at")`                                                    |
| Campo simples                             | `cpf`, `password`, `role`        | Mesmo nome minúsculo                         | Manter `@map` explícito para deixar o contrato físico claro                      |
| Enum                                      | PascalCase, como `Role`          | Nome contextual snake_case, como `user_role` | Declarar `@@map("user_role")`                                                    |
| Valor de enum                             | UPPER_SNAKE_CASE, como `CITIZEN` | snake_case, como `citizen`                   | Declarar `@map("citizen")`; preservar o valor de código consumido pela aplicação |
| Índice/constraint nomeados explicitamente | Nome lógico quando necessário    | snake_case, sem nomes físicos PascalCase     | Usar o argumento `map` da diretiva quando precisar nomear o objeto físico        |

`@map` e `@@map` separam o contrato do código do armazenamento; não renomear as propriedades TypeScript para snake_case. Não criar novas tabelas/colunas físicas `User`, `createdAt`, `CreatedAt` ou `passwordHash`.

Nomes padrão de índices/constraints que o Prisma deriva de tabelas e colunas já mapeadas são aceitáveis. Se houver nome físico específico, por exemplo `@@index([createdAt], map: "users_created_at_idx")`, usar `map`, não confundir com `name`, que pode alterar a API lógica do Prisma.

## Timestamps

Models persistidos e mutáveis devem seguir:

```prisma
createdAt  DateTime @default(now()) @map("created_at")
modifiedAt DateTime @default(now()) @updatedAt @map("modified_at")
```

- `createdAt` registra a criação e não é reescrito em atualizações comuns.
- `modifiedAt` registra alterações feitas pelo Prisma. O nome adotado é `modifiedAt`, não `updatedAt`.
- `@updatedAt` é comportamento do Prisma; não cria um trigger PostgreSQL. Scripts SQL que alterem registros devem tratar `modified_at` explicitamente quando aplicável.
- Usar UTC nas interfaces e conversões da aplicação. `TIMESTAMP` sem fuso não deve ser reinterpretado pelo fuso local de um driver de teste ao verificar preservação; comparar o valor SQL canônico quando esse for o objeto do teste.
- Entidades imutáveis ou eventos append-only podem exigir somente a data do evento. Essa exceção deve ser justificada na especificação; não adicionar timestamps sem significado para o domínio.

## Identidade e senha

- O identificador aprovado é `cpf`; não reintroduzir `email` como campo obrigatório ou credencial de login.
- Persistir CPF normalizado, como string de 11 dígitos, preservando zeros à esquerda. A coluna atual é `VARCHAR(11)`, única, com CHECK de dígitos ASCII na migração.
- Os identificadores do seed são sintéticos. Validação de formato não comprova existência civil ou validação oficial; não consultar gov.br nesta entrega.
- A propriedade e a coluna chamam-se `password`. Seu conteúdo continua sendo **hash seguro**, nunca senha em texto puro.
- Não mudar o algoritmo ou recalcular hashes apenas para renomear a coluna. O código atual usa scrypt; os hashes existentes são preservados na migração.
- Não serializar `password` em DTOs, respostas, logs ou documentação de exemplos. Selecionar explicitamente os campos retornados.
- Nomear o campo `password` não resolve o achado SEC-01 de senha compartilhada entre contas de demonstração. Credenciais distintas continuam obrigatórias antes do login HTTP.

## Relações e constraints

- IDs e propriedades de relação mantêm camelCase no código; chaves estrangeiras físicas usam snake_case (`authorId` → `author_id`).
- Declare unicidade, nulabilidade e relações conforme o domínio aprovado. Não usar `Cascade` por conveniência onde apagaria autoria, histórico ou evidências.
- Regras que também precisam valer em SQL direto devem existir no banco quando suportadas. Constraints que o Prisma não representa, como o CHECK atual de CPF, ficam na migração e precisam de testes de persistência.
- Prisma e acesso ao banco permanecem no backend; não exportar o client em `packages/contracts`.

## Migrações

1. Conferir o schema e os dados existentes antes de mudar nomes ou tipos.
2. Criar uma nova migração; preservar migrações já publicadas/aplicadas. Nunca editar a migração original para fazer parecer que o banco sempre teve o novo nome.
3. Revisar o SQL gerado. Renomeações usam `ALTER ... RENAME`; não aceitar `DROP` + recriação quando isso destruiria dados.
4. Ao transformar identificadores, fornecer mapeamento explícito. Dados desconhecidos devem interromper a migração, sem CPF inventado, truncamento silencioso ou exclusão de usuário.
5. Usar transação e locks quando necessários para manter preflight e transformação consistentes sob concorrência.
6. Testar instalação limpa e atualização do schema anterior com PostgreSQL real. Verificar dados preservados e casos de rejeição/rollback.
7. Fazer backup antes de migração incompatível no ambiente de demonstração. Documentar janela de indisponibilidade e recuperação; trocar somente a imagem da API pode não reverter o schema.

Se o esquema precisar de outro ajuste após aplicar a migração, registre o ajuste em uma nova migração. `migrate deploy` não reaplica o SQL de uma migração já registrada.

## Comandos do projeto

```bash
npm exec -w @mycity/api -- prisma format
npm run db:generate -w @mycity/api
npm run db:migrate
npm run typecheck
npm run format:check
```

`db:migrate` usa a configuração do ambiente; confirme o alvo antes de executá-lo. O Prisma Client gerado não é versionado.

## Critério de revisão

Antes de aprovar uma alteração Prisma, conferir: mapeamentos físicos, timestamps, hashes não expostos, compatibilidade do SQL, preservação de dados, recuperação e testes reais. Sol revisa riscos de migração/autorização; Luna e QA de integração verificam cenários e evidências conforme [agents/readme.md](../agents/readme.md).

Consulte o SQL da [migração de usuários para CPF](../apps/api/prisma/migrations/20261119040000_user_cpf_mapping/migration.sql).
