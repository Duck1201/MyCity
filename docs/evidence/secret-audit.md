# Auditoria de exposição de segredos

Auditoria em 18/11/2026, antes de continuar a implementação. Revisão publicada auditada: `b4f8d9b22657ed210fae6479d6361cf5d515dc24`. Valores de credenciais, chaves e URLs de autenticação não são reproduzidos neste relatório.

## Resultado

Não foram encontradas credenciais próprias do MyCity nos conteúdos públicos inspecionados. Foram encontrados metadados temporários de autenticação da infraestrutura de distribuição do Docker Hub em dois artefatos de diagnóstico de build. Esses dois artefatos foram removidos do GitHub.

## Escopo e evidência

| Superfície             | Verificação                                                                                   | Resultado                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Git público            | Mirror do GitHub, incluindo referências de PR; sete commits e 118 blobs                       | Gitleaks sem achados; nenhuma correspondência com os segredos conhecidos                            |
| GitHub Secret Scanning | Consulta da API de alertas                                                                    | Zero alertas retornados                                                                             |
| Logs Actions           | Onze execuções, incluindo cancelada e deploy ignorado                                         | Nenhum segredo conhecido encontrado; 30 alertas heurísticos eram tags públicas `mycity-api:sha-...` |
| GHCR                   | Nove tags publicadas de API/tools/web; quatro imagens distintas, 36 camadas e 38.183 arquivos | Nenhum segredo conhecido em configs/camadas; scanner dos arquivos do projeto sem achados            |
| Provenance             | Metadados das nove tags                                                                       | Nenhum segredo conhecido ou alerta do scanner                                                       |
| Artefatos de build     | 27 artefatos baixados, arquivos internos descompactados e inspecionados                       | Dois artefatos continham o achado descrito abaixo; os outros alertas eram tags de imagem            |
| EC2                    | Permissões do arquivo de configuração e resíduos de login no registry                         | `.env` com modo 600; nenhum diretório temporário `.registry.*` restante                             |

Foram comparados valores reais de senhas locais/EC2, as duas chaves SSH usadas nesta sessão e o token local do GitHub, incluindo variantes codificadas, sem imprimir esses valores. As credenciais efêmeras do `GITHUB_TOKEN` de execuções já encerradas não podem ser recuperadas para comparação exata; seus possíveis padrões foram buscados nos logs/artefatos.

## Achado nos diagnósticos Docker

Dois registros `.dockerbuild` continham URLs para `docker-images-prod.s3.dualstack.us-east-1.amazonaws.com`, com identificadores e tokens de sessão AWS temporários do serviço de distribuição do Docker Hub. Não eram credenciais configuradas para a EC2 ou para o MyCity. Não foi identificada chave secreta AWS; as URLs observadas não continham `X-Amz-Signature`.

Mesmo sem evidência de acesso à conta do responsável, esses metadados não precisam ficar públicos. Os artefatos `14492556604` e `14492970917` foram excluídos, e a API confirmou sua ausência. Restaram 25 artefatos anteriores sem esse achado na inspeção.

## Prevenção

O workflow passa a definir `DOCKER_BUILD_RECORD_UPLOAD: 'false'`, conforme a [documentação oficial da ação Docker](https://github.com/docker/build-push-action#environment-variables). Isso desativa o upload automático dos diagnósticos, preservando builds, publicação das imagens e logs normais.

O teste de regressão em `scripts/tests/workflow-security.test.ts` interpreta os YAMLs e verifica o ambiente efetivo de cada etapa `docker/build-push-action`. Antes da correção, identificou quatro etapas sem a proteção e falhou. A verificação em runtime consiste em confirmar que a nova CI não gera artefatos `.dockerbuild`.

## Limites

O resultado significa ausência de evidência de exposição dos segredos do projeto no escopo auditado, não uma garantia universal. IP, domínio, usuário de deploy, contas e senhas fictícias dos testes são informações públicas de configuração; não são as credenciais reais da demonstração. Não foi encontrada evidência que exigisse rotacionar as chaves SSH ou senhas do MyCity.

Esta auditoria não substitui a análise das vulnerabilidades de dependências já registradas em `concerns.md`.
