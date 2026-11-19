# Polling sem fila de processamento

Status: aceito na sessão de planejamento.

As telas ativas consultam atualizações a cada cinco segundos e ao retornar; notificações de status são registros no banco. Não haverá WebSocket, push ou fila de processamento no MVP.

O fluxo principal é curto e pode confirmar estado, histórico e notificação na mesma transação. As integrações que poderiam justificar tarefas de entrega em segundo plano são simuladas.

Consequências: o app fechado não recebe push; o intervalo de polling não é SLA de emergência. Consultas precisam respeitar ciclo de vida, falhas e sobreposição. Se futuramente houver envio externo com novas tentativas, reavaliar fila e mecanismo de entrega confiável sem alterar silenciosamente esta decisão.
