# Monorepo e monólito modular

Status: aceito na sessão de planejamento.

App Android, web e backend ficam no mesmo monorepo TypeScript, com contratos compartilhados. O backend Express/Prisma é um processo único dividido em Identidade, Denúncias, Notificações e Alertas, com interfaces explícitas e chamadas diretas em memória.

O responsável pediu módulos isolados sem chamadas de rede interna. Por isso não haverá microserviços para esses módulos. A API continua atendendo clientes por HTTP e acessando PostgreSQL pela conexão de banco.

Consequências: a implantação é conjunta; isolamento depende da disciplina de imports e das interfaces dos módulos. Compartilhar o repositório não autoriza compartilhar Prisma com o frontend nem escrever diretamente nas tabelas de outro módulo. A operação de status pode compartilhar uma transação com Notificações pela composição do backend.
