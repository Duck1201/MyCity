# Firewall da EC2

Aplicado em 19/11/2026 por solicitação explícita, usando como allowlist a imagem das regras de entrada fornecida pelo responsável.

| Protocolo | Portas de entrada permitidas         |
| --------- | ------------------------------------ |
| TCP       | 22, 80, 443, 8080, 9000, 40000–40100 |
| UDP       | 51820, 40000–40100                   |

UFW permanece ativo com entrada negada por padrão, saída permitida e política de encaminhamento negada. Loopback, respostas de conexões e tráfego operacional padrão do UFW são preservados. As permissões genéricas antigas de 3000, 51821 e 8787 foram removidas; as demais foram especificadas por protocolo.

## Docker e persistência

O tráfego encaminhado por Docker recebe um salto de `DOCKER-USER` para `MYCITY-INGRESS` somente quando entra pela interface `ens5`. São preservadas conexões estabelecidas/relacionadas; portas permitidas são comparadas com o destino original do conntrack e retornam à avaliação normal do Docker. O restante é descartado.

- Configuração: `/etc/mycity-firewall/docker-ingress.rules`.
- Aplicador idempotente com lock `flock` e verificação de interface: `/usr/local/sbin/mycity-docker-ingress`.
- Reaplicação: hook `start` de `/etc/ufw/after.init` e `ExecStartPost` em `/etc/systemd/system/docker.service.d/mycity-firewall.conf`.
- Fontes revisáveis: `infra/firewall/` e `scripts/security/firewall-policy.mjs`.
- Backup e rollback manual: `/root/mycity-firewall-backup-20261119T030924Z/rollback.sh`.

O rollback temporizado foi preparado antes das mudanças e cancelado somente após novas conexões e verificações. Docker e a VM não foram reiniciados.

## Evidência observada

- Nova conexão SSH, sem multiplexação, funcionou antes e depois de `ufw reload`.
- API do MyCity respondeu `ready` por HTTPS em 8080.
- TCP 22, 80, 443, 8080 e 9000 aceitaram conexão externa.
- Tentativas em 3000, 8787 e 51821 expiraram. Como o Security Group também as bloqueia, esse teste sozinho não isola o efeito do UFW.
- Após reload, existe exatamente um salto para a cadeia em IPv4/IPv6, e `FORWARD` passa por `DOCKER-USER`.
- Containers do MyCity e dos demais sistemas permaneceram ativos, sem reinício.
- Regras UDP e faixa 40000–40100 foram conferidas na configuração; não houve handshake de aplicação nessas portas nem teste externo IPv6. Um serviço não estar escutando não significa erro na regra.
- Os testes do gerador falharam antes da implementação e passaram depois, cobrindo a lista exata e rejeição de interface inválida.

O Sol revisou o método de firewall sem executar comandos na VM. A implementação foi ajustada para não limpar a cadeia `DOCKER-USER` nem duplicar saltos. [Referência Docker](https://docs.docker.com/engine/network/firewall-iptables/).
