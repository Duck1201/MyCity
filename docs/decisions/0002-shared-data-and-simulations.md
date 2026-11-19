# Dados compartilhados e simulações

Status: aceito na sessão de planejamento.

O MVP usa PostgreSQL real, fotos em volume persistente e ações reais de denúncia/atendimento, alimentados por seed fictício. Meteorologia e alertas são simulados, sem integração ou envio emergencial real. O objetivo é demonstrar cidadão → gestor → cidadão no mesmo estado persistido.

Mocks isolados nas telas não demonstrariam esse ciclo. Em contrapartida, implementar operação meteorológica e infraestrutura emergencial ampliaria o produto além da demonstração aprovada.

Consequências: dados fictícios não eliminam necessidade de autorização, integridade, backup ou testes com banco real. A tela de alertas precisa indicar simulação; RNF03/RNF04 não serão apresentados como garantias verificadas.
