#!/usr/bin/env bash
set -Eeuo pipefail

deploy_root=${1:?Diretório de deploy obrigatório}
release_sha=${2:?SHA obrigatório}
registry_user=${3:?Usuário do registry obrigatório}
[[ "$deploy_root" =~ ^/[a-zA-Z0-9/_-]+$ ]] || exit 2
[[ "$release_sha" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$registry_user" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
release_dir="$deploy_root/releases/$release_sha"
[[ -f "$deploy_root/.env" && -f "$release_dir/compose.deploy.yaml" ]] || exit 2

exec 9>"$deploy_root/.deploy.lock"
flock -n 9 || { echo 'Outro deploy está em execução.' >&2; exit 1; }
export RELEASE_SHA="$release_sha"
export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d "$deploy_root/.registry.XXXXXX")
trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
docker login ghcr.io --username "$registry_user" --password-stdin

compose=(docker compose --env-file "$deploy_root/.env" -f "$release_dir/compose.deploy.yaml")
"${compose[@]}" --profile tools pull
"${compose[@]}" up -d --wait db
"${compose[@]}" --profile tools run --rm migrate
if [[ ! -f "$deploy_root/.seeded" ]]; then
    "${compose[@]}" --profile tools run --rm seed
    touch "$deploy_root/.seeded"
fi
"${compose[@]}" up -d --wait api web edge
curl --fail --silent --show-error http://127.0.0.1:8090/api/v1/health/ready
if [[ -f "$deploy_root/current-release" ]]; then
    cp "$deploy_root/current-release" "$deploy_root/previous-release"
fi
printf '%s\n' "$release_sha" > "$deploy_root/current-release"
ln -sfn "$release_dir" "$deploy_root/current"
echo 'Release aplicada; banco e volumes preservados.'
