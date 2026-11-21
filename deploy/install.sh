#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

fail() { echo "$1" >&2; exit 2; }
usage='Uso: bash install.sh <diretório-absoluto> <domínio> [--registry-user <usuário>] (token pela entrada padrão)'
[[ $# -eq 2 || ( $# -eq 4 && $3 == --registry-user && $4 =~ ^[a-zA-Z0-9_-]+$ ) ]] || fail "$usage"
deploy_root=${1%/}
domain=${2,,}
label='[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?'
[[ "$deploy_root" =~ ^/[a-zA-Z0-9_-][a-zA-Z0-9/_-]*$ ]] || fail 'Informe um diretório absoluto de deploy, por exemplo /srv/mycity.'
[[ ${#domain} -le 253 && "$domain" =~ ^($label\.)+$label$ ]] || fail 'Informe um domínio DNS completo, sem protocolo, porta ou caminho.'

package_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
files=(compose.yaml Caddyfile provision-api.sql deploy.sh images.env)
for file in release-name "${files[@]}"; do
    [[ -f "$package_dir/$file" ]] || fail "Pacote incompleto: $file ausente."
done
release=$(<"$package_dir/release-name")
[[ "$release" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-[1-9][0-9]{0,8}$ ]] || fail 'Nome de release inválido no pacote.'
bash "$package_dir/deploy.sh" --check-manifest "$package_dir" || fail 'Manifesto de imagens inválido. Verifique o SHA-256 do pacote e extraia novamente.'
docker compose version >/dev/null || fail 'Instale o Docker com Compose antes de continuar.'

mkdir -p -- "$deploy_root/releases"
exec 8>"$deploy_root/.install.lock"
flock -n 8 || fail 'Outra instalação está em execução.'
staging=$(mktemp -d "$deploy_root/.install.XXXXXX")
trap 'rm -r -- "$staging"' EXIT
target="$deploy_root/releases/$release"
if [[ -e "$target" ]]; then
    for file in "${files[@]}"; do
        cmp -s -- "$package_dir/$file" "$target/$file" || fail "Os arquivos da release $release divergem dos já instalados."
    done
else
    mkdir -- "$staging/release"
    for file in "${files[@]}"; do cp -- "$package_dir/$file" "$staging/release/$file"; done
    mv -T -- "$staging/release" "$target"
fi

env_file="$deploy_root/.env.production"
override="$deploy_root/compose.override.yaml"
if [[ ! -e "$env_file" ]]; then
    [[ ! -e "$deploy_root/current-release" && ! -e "$deploy_root/.seeded" ]] || fail 'Restaure o .env.production da instalação existente antes de continuar.'
    project_hash=$(printf '%s' "$deploy_root" | sha256sum)
    {
        printf 'COMPOSE_PROJECT_NAME=mycity-server-%s\nWEB_ORIGIN=https://%s\nPUBLIC_HOST=%s\nEDGE_PORT=443\n' "${project_hash:0:12}" "$domain" "$domain"
        for key in POSTGRES_PASSWORD API_DATABASE_PASSWORD DEMO_CITIZEN_A_PASSWORD DEMO_CITIZEN_B_PASSWORD DEMO_MANAGER_PASSWORD; do
            password=$(openssl rand -hex 24)
            printf '%s=%s\n' "$key" "$password"
        done
    } > "$staging/config"
    unset password
    if [[ ! -e "$override" ]]; then
        printf 'services:\n    edge:\n        ports:\n            - "80:80"\n' > "$staging/compose.override.yaml"
        mv -T -- "$staging/compose.override.yaml" "$override"
    fi
    mv -T -- "$staging/config" "$env_file"
    echo 'Configuração criada. As senhas das contas estão no .env.production.'
else
    echo 'Usando o domínio e as credenciais do .env.production existente.'
fi

args=("$deploy_root" "$release")
if [[ $# -eq 4 ]]; then args+=("$4"); fi
bash "$target/deploy.sh" "${args[@]}"
