#!/usr/bin/env bash
set -Eeuo pipefail

[[ $# -eq 5 ]] || { echo 'Uso: package-release.sh <saída> <release> <digest-api> <digest-tools> <digest-web>' >&2; exit 2; }
output=$1
release=$2
[[ "$release" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-[1-9][0-9]{0,8}$ ]] || { echo 'Nome de release inválido.' >&2; exit 2; }
for digest in "${@:3}"; do
    [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Digest de imagem inválido.' >&2; exit 2; }
done

source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
staging=$(mktemp -d)
trap 'rm -r -- "$staging"' EXIT
printf '%s\n' "$release" > "$staging/release-name"
printf 'API_DIGEST=%s\nTOOLS_DIGEST=%s\nWEB_DIGEST=%s\n' "$3" "$4" "$5" > "$staging/images.env"
mkdir -p -- "$output"
tar -czf "$output/mycity-server.tar.gz" -C "$source_dir" install.sh deploy.sh compose.yaml Caddyfile provision-api.sql -C "$staging" release-name images.env
cd -- "$output"
sha256sum mycity-server.tar.gz > mycity-server.tar.gz.sha256
