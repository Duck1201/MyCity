#!/usr/bin/env bash
set -Eeuo pipefail

deploy_root=${1:?Diretório de deploy obrigatório}
release_sha=${2:?SHA obrigatório}
registry_user=${3:?Usuário do registry obrigatório}
[[ "$deploy_root" =~ ^/[a-zA-Z0-9/_-]+$ ]] || exit 2
[[ "$release_sha" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$registry_user" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
ci_number=${4:?Número da CI obrigatório}
ci_attempt=${5:?Tentativa da CI obrigatória}
[[ "$ci_number" =~ ^[1-9][0-9]{0,14}$ && "$ci_attempt" =~ ^[1-9][0-9]{0,8}$ ]] || exit 2
release_dir="$deploy_root/releases/$release_sha-$ci_number-$ci_attempt"
[[ -f "$deploy_root/.env" && -f "$release_dir/compose.deploy.yaml" ]] || exit 2

exec 9>"$deploy_root/.deploy.lock"
flock -n 9 || { echo 'Outro deploy está em execução.' >&2; exit 1; }
mapfile -t manifest < "$release_dir/images.env"
[[ ${#manifest[@]} -eq 6 && ${manifest[0]} == "RELEASE_SHA=$release_sha" && ${manifest[1]} == "CI_NUMBER=$ci_number" && ${manifest[2]} == "CI_ATTEMPT=$ci_attempt" ]] || exit 2
keys=(API_DIGEST TOOLS_DIGEST WEB_DIGEST)
for index in "${!keys[@]}"; do
    entry=${manifest[index + 3]}
    [[ "$entry" =~ ^${keys[index]}=sha256:[a-f0-9]{64}$ ]] || exit 2
    export "$entry"
done

# Reserve the sequence before schema changes, including when a later step fails.
watermark="$deploy_root/deploy-sequence"
fingerprint=$(sha256sum < "$release_dir/images.env")
fingerprint=${fingerprint%% *}
if [[ -f "$watermark" ]]; then
    read -r last_number last_attempt last_fingerprint < "$watermark"
    [[ "$last_number" =~ ^[1-9][0-9]{0,14}$ && "$last_attempt" =~ ^[1-9][0-9]{0,8}$ && "$last_fingerprint" =~ ^[a-f0-9]{64}$ ]] || exit 2
    if (( ci_number < last_number || (ci_number == last_number && ci_attempt < last_attempt) )); then
        echo 'Execução de CI anterior à sequência reservada.' >&2
        exit 1
    fi
    if (( ci_number == last_number && ci_attempt == last_attempt )); then
        [[ "$fingerprint" == "$last_fingerprint" ]] || exit 2
    fi
fi
printf '%s %s %s\n' "$ci_number" "$ci_attempt" "$fingerprint" > "$watermark.next"
mv -f "$watermark.next" "$watermark"
export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d "$deploy_root/.registry.XXXXXX")
trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
docker login ghcr.io --username "$registry_user" --password-stdin

compose=(docker compose --env-file "$deploy_root/.env" -f "$release_dir/compose.deploy.yaml")
"${compose[@]}" --profile tools pull
"${compose[@]}" up -d --wait db
"${compose[@]}" --profile tools run --rm migrate
"${compose[@]}" --profile tools run --rm -T provision
if [[ ! -f "$deploy_root/.seeded" ]]; then
    "${compose[@]}" --profile tools run --rm seed
    touch "$deploy_root/.seeded"
fi
"${compose[@]}" up -d --wait api web edge
curl --fail --silent --show-error http://127.0.0.1:8090/api/v1/health/ready
if [[ -f "$deploy_root/current-release" && $(<"$deploy_root/current-release") != "$release_sha" ]]; then
    cp "$deploy_root/current-release" "$deploy_root/previous-release"
fi
printf '%s\n' "$release_sha" > "$deploy_root/current-release.next"
mv -f "$deploy_root/current-release.next" "$deploy_root/current-release"
ln -sfn "$release_dir" "$deploy_root/current"
echo 'Release aplicada; banco e volumes preservados.'
