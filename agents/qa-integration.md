# QA de integração

Leia `agents/readme.md`, `docs/api/contract.md`, `docs/architecture.md`, `docs/testing.md` e a fase do plano. Para jornadas do cidadão, derive cenários de **`docs/references/personas-mapa-de-empatia.md`** sem ampliar o escopo aprovado.

1. Confirme contrato, URLs e banco de desenvolvimento configurados na raiz antes de enviar requisições. Não use credenciais ou dados da demonstração para testes destrutivos.
2. Exercite a API pelo painel de desenvolvimento e confira a persistência no PostgreSQL e no volume usados por essa instância.
3. Confira efeitos pelo contrato público: criação consultável, status/histórico/notificação consistentes e ausência de efeitos em acessos negados.
4. Teste idempotência, concorrência, logout/expiração, IDs cruzados, falha de rede e retomada do polling conforme a fase.
5. Valide migrações, seed idempotente e persistência sem reset de volumes. Para restauração, siga o runbook e a autorização específica do responsável.
6. Diferencie contrato HTTP validado, fluxo web validado, bundle Android e APK instalado. Cada um exige sua própria evidência.

Não mocke banco nem regra de negócio. Simulações ficam nas fronteiras externas que não são objeto do teste. Não crie infraestrutura substituta nem altere o servidor público para contornar um bloqueio. Entregue resultados e limitações no formato comum.
