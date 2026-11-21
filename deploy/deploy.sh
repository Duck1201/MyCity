#!/usr/bin/env bash
# Applies or rolls back a release on the server.
#
#   deploy.sh <deploy-root> <release-name> <registry-user>   apply a release (registry token on stdin)
#   deploy.sh <deploy-root> --rollback                       go back to the previous release
#
# Called by .github/workflows/release.yml, or by hand through the prod-vm skill.
# <deploy-root>/.env.production holds the server secrets; this script never prints it.
# <deploy-root>/compose.override.yaml (optional) holds host-specific settings.
set -Eeuo pipefail

deploy_root=${1:?Diretório de deploy obrigatório}
[[ "$deploy_root" =~ ^/[a-zA-Z0-9/_-]+$ ]] || exit 2
env_file="$deploy_root/.env.production"
[[ -f "$env_file" ]] || { echo "$env_file ausente." >&2; exit 2; }
release_pattern='^v[0-9]+\.[0-9]+\.[0-9]+-[1-9][0-9]{0,8}$'

load_digests() {
    local manifest index keys=(API_DIGEST TOOLS_DIGEST WEB_DIGEST)
    mapfile -t manifest < "$1/images.env"
    [[ ${#manifest[@]} -eq ${#keys[@]} ]] || exit 2
    for index in "${!keys[@]}"; do
        [[ "${manifest[index]}" =~ ^${keys[index]}=sha256:[a-f0-9]{64}$ ]] || exit 2
        export "${manifest[index]}"
    done
}

compose_for() {
    compose=(docker compose --env-file "$env_file" -f "$1/compose.yaml")
    [[ -f "$deploy_root/compose.override.yaml" ]] && compose+=(-f "$deploy_root/compose.override.yaml")
    return 0
}

activate() {
    local name=$1 previous=${2:-}
    curl --fail --silent --show-error http://127.0.0.1:8090/api/v1/health/ready
    if [[ -n "$previous" && "$previous" != "$name" ]]; then
        printf '%s\n' "$previous" > "$deploy_root/previous-release.next"
        mv -f "$deploy_root/previous-release.next" "$deploy_root/previous-release"
    fi
    printf '%s\n' "$name" > "$deploy_root/current-release.next"
    mv -f "$deploy_root/current-release.next" "$deploy_root/current-release"
    ln -sfn "$deploy_root/releases/$name" "$deploy_root/current"
}

exec 9>"$deploy_root/.deploy.lock"
flock -n 9 || { echo 'Outro deploy está em execução.' >&2; exit 1; }
current=$( [[ -f "$deploy_root/current-release" ]] && cat "$deploy_root/current-release" || true )

if [[ "${2:-}" == --rollback ]]; then
    [[ $# -eq 2 && -f "$deploy_root/previous-release" ]] || { echo 'Nenhuma release anterior registrada.' >&2; exit 2; }
    target=$(<"$deploy_root/previous-release")
    [[ "$target" =~ $release_pattern && -f "$deploy_root/releases/$target/compose.yaml" ]] || exit 2
    load_digests "$deploy_root/releases/$target"
    compose_for "$deploy_root/releases/$target"
    # Images of the previous release are still local; migrations only move forward, so none run here.
    "${compose[@]}" up -d --wait api web edge
    activate "$target" "$current"
    echo "Rollback para $target concluído; banco e volumes preservados."
    exit 0
fi

release_name=${2:?Nome da release obrigatório}
registry_user=${3:?Usuário do registry obrigatório}
[[ "$release_name" =~ $release_pattern ]] || exit 2
[[ "$registry_user" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
release_dir="$deploy_root/releases/$release_name"
[[ -f "$release_dir/compose.yaml" && -f "$release_dir/images.env" ]] || exit 2
load_digests "$release_dir"

export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d "$deploy_root/.registry.XXXXXX")
trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
IFS= read -r registry_token
[[ -n "$registry_token" ]] || exit 2
docker login ghcr.io --username "$registry_user" --password-stdin <<< "$registry_token"
unset registry_token

compose_for "$release_dir"
"${compose[@]}" --profile tools pull
"${compose[@]}" up -d --wait db
"${compose[@]}" --profile tools run --rm migrate
"${compose[@]}" --profile tools run --rm -T provision
if [[ -f "$deploy_root/.seeded" ]]; then
    "${compose[@]}" --profile tools run --rm -T seed npm run db:sync-deployment-passwords -w @mycity/api
else
    "${compose[@]}" --profile tools run --rm seed
    touch "$deploy_root/.seeded"
fi
"${compose[@]}" --profile tools run --rm -T thumbnails npm run photos:backfill-thumbnails -w @mycity/api
"${compose[@]}" up -d --wait api web edge
activate "$release_name" "$current"
echo "Release $release_name aplicada; banco e volumes preservados."
