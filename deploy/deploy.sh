#!/usr/bin/env bash
# Applies one release on the server. Called by .github/workflows/release.yml:
#   deploy.sh <deploy-root> <release-name> <registry-user>   (registry token on stdin)
# <deploy-root>/.env holds the server secrets and never leaves the server.
# <deploy-root>/compose.override.yaml (optional) holds host-specific settings.
set -Eeuo pipefail

deploy_root=${1:?Diretório de deploy obrigatório}
release_name=${2:?Nome da release obrigatório}
registry_user=${3:?Usuário do registry obrigatório}
[[ "$deploy_root" =~ ^/[a-zA-Z0-9/_-]+$ ]] || exit 2
[[ "$release_name" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-[1-9][0-9]{0,8}$ ]] || exit 2
[[ "$registry_user" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
release_dir="$deploy_root/releases/$release_name"
[[ -f "$deploy_root/.env" && -f "$release_dir/compose.yaml" && -f "$release_dir/images.env" ]] || exit 2

exec 9>"$deploy_root/.deploy.lock"
flock -n 9 || { echo 'Outro deploy está em execução.' >&2; exit 1; }

mapfile -t manifest < "$release_dir/images.env"
keys=(API_DIGEST TOOLS_DIGEST WEB_DIGEST)
[[ ${#manifest[@]} -eq ${#keys[@]} ]] || exit 2
for index in "${!keys[@]}"; do
    [[ "${manifest[index]}" =~ ^${keys[index]}=sha256:[a-f0-9]{64}$ ]] || exit 2
    export "${manifest[index]}"
done

export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d "$deploy_root/.registry.XXXXXX")
trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
IFS= read -r registry_token
[[ -n "$registry_token" ]] || exit 2
docker login ghcr.io --username "$registry_user" --password-stdin <<< "$registry_token"
unset registry_token

compose=(docker compose --env-file "$deploy_root/.env" -f "$release_dir/compose.yaml")
[[ -f "$deploy_root/compose.override.yaml" ]] && compose+=(-f "$deploy_root/compose.override.yaml")

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
"${compose[@]}" up -d --wait api web edge
curl --fail --silent --show-error http://127.0.0.1:8090/api/v1/health/ready

if [[ -f "$deploy_root/current-release" && $(<"$deploy_root/current-release") != "$release_name" ]]; then
    cp "$deploy_root/current-release" "$deploy_root/previous-release"
fi
printf '%s\n' "$release_name" > "$deploy_root/current-release.next"
mv -f "$deploy_root/current-release.next" "$deploy_root/current-release"
ln -sfn "$release_dir" "$deploy_root/current"
echo "Release $release_name aplicada; banco e volumes preservados."
