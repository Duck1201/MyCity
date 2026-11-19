# Diagrama de Casos de Uso - MyCity

Fonte original: Diagrama de Casos de Uso.pdf (PDF removido após extração), página 1.

Denúncia urbana e alertas climáticos.

Nota de extração: o PDF contém uma imagem sem camada de texto. A transcrição abaixo registra os atores, os casos de uso e as relações visíveis no diagrama. Todos os casos de uso estão dentro da fronteira **Sistema MyCity**; os atores estão fora dela.

## Atores e associações

| Ator | Casos de uso associados diretamente |
| --- | --- |
| Usuário (abstrato) | UC01 |
| Cidadão | UC02, UC04, UC07, UC05, UC09, UC13, UC12 |
| Gestor público | UC17, UC11, UC12 |
| Defesa Civil | UC16 |
| Fonte meteorológica (INMET / OpenWeather) | UC14 |

Cidadão, Gestor público e Defesa Civil são especializações de Usuário e herdam sua associação com UC01.

## Casos de uso

| ID | Caso de uso |
| --- | --- |
| UC01 | Cadastrar e autenticar usuário |
| UC02 | Registrar denúncia |
| UC03 | Capturar localização (GPS) |
| UC04 | Consultar feed de denúncias |
| UC05 | Confirmar denúncia (“também vi isso”) |
| UC06 | Calcular prioridade |
| UC07 | Visualizar mapa de denúncias |
| UC08 | Cancelar denúncia |
| UC09 | Acompanhar minhas denúncias |
| UC10 | Avaliar atendimento |
| UC11 | Atualizar status da denúncia |
| UC12 | Consultar histórico público de resolvidas |
| UC13 | Receber alerta climático |
| UC14 | Gerar alerta automático |
| UC15 | Notificar cidadão da atualização |
| UC16 | Emitir alerta manual |
| UC17 | Visualizar denúncias da sua região |
| UC18 | Enviar notificação segmentada |
| UC19 | Responder publicamente |
| UC20 | Rejeitar com justificativa |

## Relações «include»

A origem inclui o caso de uso de destino.

| Origem | Destino |
| --- | --- |
| UC02 - Registrar denúncia | UC03 - Capturar localização (GPS) |
| UC05 - Confirmar denúncia | UC06 - Calcular prioridade |
| UC11 - Atualizar status da denúncia | UC15 - Notificar cidadão da atualização |
| UC16 - Emitir alerta manual | UC18 - Enviar notificação segmentada |
| UC14 - Gerar alerta automático | UC18 - Enviar notificação segmentada |

## Relações «extend»

A origem estende o caso de uso de destino.

| Origem | Destino |
| --- | --- |
| UC08 - Cancelar denúncia | UC09 - Acompanhar minhas denúncias |
| UC10 - Avaliar atendimento | UC09 - Acompanhar minhas denúncias |
| UC19 - Responder publicamente | UC11 - Atualizar status da denúncia |
| UC20 - Rejeitar com justificativa | UC11 - Atualizar status da denúncia |
