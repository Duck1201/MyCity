#!/usr/bin/env bash
set -euo pipefail

network_interface=${1:-ens5}
[[ $EUID -eq 0 && "$network_interface" =~ ^[a-zA-Z0-9_.:-]{1,15}$ ]] || exit 2
ip link show dev "$network_interface" >/dev/null
exec 9>/run/lock/mycity-firewall.lock
flock -x 9
for family in iptables ip6tables; do
    "${family}-restore" --wait 5 --noflush < /etc/mycity-firewall/docker-ingress.rules
    if ! "$family" --wait 5 -S DOCKER-USER >/dev/null 2>&1; then
        echo "$family: DOCKER-USER ainda não existe; reaplicação ocorrerá no início do Docker." >&2
        continue
    fi
    if ! "$family" --wait 5 -C DOCKER-USER -i "$network_interface" -j MYCITY-INGRESS 2>/dev/null; then
        "$family" --wait 5 -I DOCKER-USER 1 -i "$network_interface" -j MYCITY-INGRESS
    fi
done
